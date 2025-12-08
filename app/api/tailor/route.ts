import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { createSession } from '../../../lib/sessions'
import { enforceGuards } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { startTrace, logRequestTelemetry, logError } from '../../../lib/telemetry'
import { createUserFriendlyError, logAIError } from '../../../lib/ai-error-handler'
import { validateParsingResult, shouldShowExperienceBanner } from '../../../lib/parsing-validation'
import { Tone } from '../../../lib/types'
import { honestyScan } from '../../../lib/honesty'
import { extractJDFromUrl, validateUrl } from '../../../lib/jd'
import { enforceUrlFetchRateLimit } from '../../../lib/guards'
import { logUrlFetch } from '../../../lib/telemetry'
import { requireAuth } from '../../../lib/auth/utils'
import { deductCredit, NoCreditsError } from '../../../lib/billing/deduct-credit'
import { createHash } from 'crypto'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  console.log('tailora API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })

  let session_id: string | undefined
  let resume_file: File | null = null
  let jd_text_raw: string = ''
  let tone: Tone = 'professional'

  try {
    const guard = enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    const cfg = getConfig()
    if (cfg.pauseTailor) {
      return NextResponse.json({ code: 'tailor_paused', message: 'Tailoring functionality is temporarily disabled' }, { status: 503 })
    }
    console.log('Guard check passed')

    // Authenticate user and check credits
    let user
    try {
      user = await requireAuth()
    } catch (error) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'Authentication required. Please sign in to tailor your resume.' },
        { status: 401 }
      )
    }

    const trace = startTrace({ route: 'tailor' })
    console.log('Trace started')

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json({ code: 'invalid_content_type', message: 'Request must be multipart/form-data' }, { status: 415 })
    }

    const form = await req.formData()
    session_id = form.get('session_id')?.toString()
    const mode = form.get('mode')?.toString()
    const jd_url = form.get('jd_url')?.toString()
    resume_file = form.get('resume_file') as unknown as File | null
    jd_text_raw = form.get('jd_text')?.toString() || ''
    tone = (form.get('tone')?.toString() as Tone) || 'professional'

    if (mode === 'fetchOnly') {
      if (!jd_url) {
        return NextResponse.json({ code: 'missing_jd_url', message: 'Job description URL is required' }, { status: 400 })
      }

      // Apply rate limiting for URL fetching
      const rateLimitCheck = enforceUrlFetchRateLimit(req)
      if (!rateLimitCheck.ok) {
        return rateLimitCheck.res
      }

      try {
        console.log('Fetch-only mode: fetching JD from URL', { jd_url })
        
        // Validate URL security
        try {
          validateUrl(jd_url)
        } catch (validationError) {
          return NextResponse.json({
            code: 'invalid_url',
            message: validationError instanceof Error ? validationError.message : 'Invalid or unsafe URL'
          }, { status: 400 })
        }

        // Extract job description with new enhanced extraction
        const extractionResult = await extractJDFromUrl(jd_url)
        
        if (!extractionResult.text || extractionResult.text.trim().length < 50) {
          return NextResponse.json({ 
            code: 'empty_jd_text', 
            message: 'Could not extract meaningful content from the provided URL. The page may not contain a job description.' 
          }, { status: 422 })
        }

        // Return enhanced response with validation info
        return NextResponse.json({
          success: true,
          mode: 'fetchOnly',
          jd_text: extractionResult.text,
          truncated: extractionResult.truncated,
          originalLength: extractionResult.originalLength,
          validation: {
            valid: extractionResult.validation.valid,
            score: extractionResult.validation.score,
            issues: extractionResult.validation.issues
          }
        })
      } catch (fetchError) {
        console.error('Failed to fetch JD text:', fetchError)
        
        // Provide better error messages based on error type
        let errorCode = 'jd_fetch_failed'
        let statusCode = 500
        let errorMessage = 'Failed to fetch job description'
        
        if (fetchError instanceof Error) {
          errorMessage = fetchError.message
          
          if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            errorCode = 'timeout'
            statusCode = 408
          } else if (errorMessage.includes('HTTP 4')) {
            errorCode = 'http_error'
            statusCode = 422
          } else if (errorMessage.includes('security') || errorMessage.includes('Invalid URL')) {
            errorCode = 'invalid_url'
            statusCode = 400
          } else if (errorMessage.includes('Could not find')) {
            errorCode = 'no_content'
            statusCode = 422
          }
        }
        
        return NextResponse.json({
          code: errorCode,
          message: errorMessage
        }, { status: statusCode })
      }
    }

    console.log('Processing request:', { 
      hasResumeFile: !!resume_file, 
      jdTextLength: jd_text_raw.length,
      tone 
    })

    if (!resume_file) return NextResponse.json({ code: 'missing_resume', message: 'Missing resume input' }, { status: 400 })
    if (!jd_text_raw) return NextResponse.json({ code: 'missing_jd', message: 'Missing jd_text' }, { status: 400 })

    const parsed = await extractTextFromFile(resume_file)
    
    // Check for scanned PDF error
    if (parsed.error === 'scanned_pdf') {
      return NextResponse.json({ 
        code: 'scanned_pdf', 
        message: parsed.message || 'Your PDF appears to be scanned. Please upload DOCX or a text-based PDF (File → Save as PDF).' 
      }, { status: 400 })
    }
    
    const resumeText = parsed.text
    const ext = parsed.ext

    console.log('Parsing resume...')
    const original = heuristicParseResume(resumeText)
    console.log('Resume parsed successfully:', {
      hasSummary: !!original.summary,
      skillsCount: original.skills?.length || 0,
      experienceCount: original.experience?.length || 0,
      educationCount: original.education?.length || 0,
      certificationsCount: original.certifications?.length || 0
    })

    // Validate parsing results
    const validation = validateParsingResult(original)
    console.log('Parsing validation:', validation)

    // Check if we should block due to missing experience
    if (shouldShowExperienceBanner(validation)) {
      return NextResponse.json({
        code: 'missing_experience',
        message: 'No work experience detected in your resume',
        validation,
        original_sections_json: original,
        suggestions: [
          'Paste your work history manually',
          'Try uploading a different resume format',
          'Check if your resume has experience section headings'
        ]
      }, { status: 422 }) // Unprocessable Entity
    }

    // Deduct credit before AI processing
    const resumeHash = createHash('sha256').update(resumeText).digest('hex')
    try {
      await deductCredit(user.id, resumeHash)
      console.log('Credit deducted successfully for user:', user.id)
    } catch (error) {
      if (error instanceof NoCreditsError) {
        return NextResponse.json(
          {
            code: 'no_credits',
            message: 'You have no credits remaining. Please purchase credits to continue.',
            creditsRemaining: user.creditsRemaining,
          },
          { status: 402 } // Payment Required
        )
      }
      throw error
    }

    console.log('Tailoring resume...')
    console.log('About to call getTailoredResume...')
    const deadline = Date.now() + 25000
    const { tailored, tokens, ats } = await getTailoredResume(original, jd_text_raw, tone, { deadline })
    console.log('getTailoredResume completed successfully')
    console.log('Resume tailored successfully:', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0,
      atsOriginal: ats.original.coverage,
      atsTailored: ats.tailored.coverage
    })

    console.log('Creating session...')
    const session = createSession(original, tailored, jd_text_raw, ats, resumeText)
    console.log('Session created:', session.id)

    // Log successful request telemetry
    logRequestTelemetry({
      req_id: trace.id,
      route: 'tailor',
      timing: Date.now() - (trace as any).startTime,
      final_status: 'success',
      additional_metrics: { 
        resume_length: resumeText.length,
        jd_length: jd_text_raw.length,
        tone,
        tokens_used: tokens,
        ats_original_coverage: ats.original.coverage,
        ats_tailored_coverage: ats.tailored.coverage,
        ats_coverage_gain: ats.deltas.coverage,
        original_experience_count: original.experience?.length || 0,
        tailored_experience_count: tailored.experience?.length || 0,
        validation_errors: validation.errors.length,
        validation_warnings: validation.warnings.length
      }
    })

    // Run honesty scan to detect fabricated content
    const honestyResult = honestyScan(original.experience || [], tailored.experience || [])
    
    trace.end(true, { session_id: session.id, tokens, ats_original: ats.original.coverage, ats_tailored: ats.tailored.coverage })
    
    // Get updated credit balance
    const { getUserCredits } = await import('../../../lib/auth/utils')
    const updatedCredits = await getUserCredits(user.id)
    
    return NextResponse.json({
      session_id: session.id,
      version: session.version,
      original_sections_json: original,
      original_raw_text: resumeText,
      preview_sections_json: tailored,
      keyword_stats: ats,
      tokens_used: tokens,
      message: 'Resume tailored successfully',
      credits_remaining: updatedCredits,
      credit_used: true,
      validation,
      honesty_scan: {
        flags: honestyResult.flags,
        results: honestyResult.results,
        flagged_count: honestyResult.flags.length,
        has_concerns: honestyResult.flags.length > 0
      },
      parsing_details: {
        original_sections_found: {
          summary: !!original.summary,
          skills: (original.skills?.length || 0) > 0,
          experience: (original.experience?.length || 0) > 0,
          education: (original.education?.length || 0) > 0,
          certifications: (original.certifications?.length || 0) > 0
        },
        tailored_sections_generated: {
          summary: !!tailored.summary,
          skills: (tailored.skills_section?.length || 0) > 0,
          experience: (tailored.experience?.length || 0) > 0
        }
      }
    })

  } catch (error) {
    console.error('tailora API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)
    
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isTimeoutError = /time budget|timeout/i.test(errorMessage)
    
    // Create detailed error information
    const errorDetails = {
      route: 'tailor',
      session_id: session_id || 'unknown',
      hasResumeFile: !!resume_file,
      jdLength: jd_text_raw.length,
      tone: tone || 'unknown',
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined
    }
    
    // Log the error with context
    logError(error as Error, errorDetails)
    
    // Create user-friendly error message
    const userMessage = createUserFriendlyError(error as Error, errorDetails)
    
    if (isTimeoutError) {
      return NextResponse.json({
        code: 'function_timeout',
        message: 'Tailoring took too long and was cancelled. Please try again with a shorter resume or job description.',
        timestamp: new Date().toISOString(),
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
      }, { status: 504 })
    }
    
    // Ensure we always return a proper JSON response
    try {
      return NextResponse.json({ 
        code: 'server_error', 
        message: userMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        timestamp: new Date().toISOString(),
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
      }, { status: 500 })
    } catch (jsonError) {
      console.error('Failed to create JSON response:', jsonError)
      // Fallback to JSON response even if JSON creation fails
      return NextResponse.json({ 
        code: 'server_error', 
        message: 'An unexpected error occurred'
      }, { status: 500 })
    }
  }
}
