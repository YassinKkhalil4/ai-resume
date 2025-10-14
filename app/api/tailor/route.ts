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
import { extractJDFromUrl } from '../../../lib/jd'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  console.log('Tailor API called:', {
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

      try {
        console.log('Fetch-only mode: fetching JD from URL', { jd_url })
        const jdText = await extractJDFromUrl(jd_url)
        if (!jdText) {
          return NextResponse.json({ code: 'empty_jd_text', message: 'Could not extract text from the provided URL' }, { status: 422 })
        }

        return NextResponse.json({
          success: true,
          mode: 'fetchOnly',
          jd_text: jdText
        })
      } catch (fetchError) {
        console.error('Failed to fetch JD text:', fetchError)
        return NextResponse.json({
          code: 'jd_fetch_failed',
          message: fetchError instanceof Error ? fetchError.message : 'Failed to fetch job description'
        }, { status: 500 })
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
    
    return NextResponse.json({
      session_id: session.id,
      version: session.version,
      original_sections_json: original,
      original_raw_text: resumeText,
      preview_sections_json: tailored,
      keyword_stats: ats,
      tokens_used: tokens,
      message: 'Resume tailored successfully',
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
    console.error('Tailor API error:', error)
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
