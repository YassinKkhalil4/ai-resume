import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { atsCheck } from '../../../lib/ats'
import { createSession } from '../../../lib/sessions'
import { enforceGuards } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { startTrace, logRequestTelemetry, logError } from '../../../lib/telemetry'
import { createUserFriendlyError, logAIError } from '../../../lib/ai-error-handler'
import { Tone } from '../../../lib/types'

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
    resume_file = form.get('resume_file') as unknown as File | null
    jd_text_raw = form.get('jd_text')?.toString() || ''
    tone = (form.get('tone')?.toString() as Tone) || 'professional'
    console.log('Processing request:', { 
      hasResumeFile: !!resume_file, 
      jdTextLength: jd_text_raw.length,
      tone 
    })

    if (!resume_file) return NextResponse.json({ code: 'missing_resume', message: 'Missing resume input' }, { status: 400 })
    if (!jd_text_raw) return NextResponse.json({ code: 'missing_jd', message: 'Missing jd_text' }, { status: 400 })

    const parsed = await extractTextFromFile(resume_file)
    const resumeText = parsed.text
    const ext = parsed.ext
    
    if (ext === 'pdf' && (!resumeText || resumeText.trim().length < 50)) {
      return NextResponse.json({ code: 'scanned_pdf', message: 'Your PDF appears to be image-only (scanned). Please upload a DOCX or a text-based PDF.' }, { status: 400 })
    }

    console.log('Parsing resume...')
    const original = heuristicParseResume(resumeText)
    console.log('Resume parsed successfully:', {
      hasSummary: !!original.summary,
      skillsCount: original.skills?.length || 0,
      experienceCount: original.experience?.length || 0,
      educationCount: original.education?.length || 0,
      certificationsCount: original.certifications?.length || 0
    })

    console.log('Tailoring resume...')
    const { tailored, tokens } = await getTailoredResume(original, jd_text_raw, tone)
    console.log('Resume tailored successfully:', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0
    })

    console.log('Running ATS check...')
    const keywordStats = atsCheck(original, jd_text_raw)
    console.log('ATS check completed:', {
      coverage: keywordStats.coverage,
      matchedKeywords: keywordStats.matched?.length || 0,
      missingKeywords: keywordStats.missing?.length || 0
    })

    console.log('Creating session...')
    const session = createSession(original, tailored, jd_text_raw, keywordStats)
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
        ats_coverage: keywordStats.coverage,
        original_experience_count: original.experience?.length || 0,
        tailored_experience_count: tailored.experience?.length || 0
      }
    })

    trace.end(true, { session_id: session.id, tokens, ats_coverage: keywordStats.coverage })
    
    return NextResponse.json({
      session_id: session.id,
      version: session.version,
      original_sections_json: original,
      preview_sections_json: tailored,
      keyword_stats: keywordStats,
      tokens_used: tokens,
      message: 'Resume tailored successfully',
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
    
    // Create detailed error information
    const errorDetails = {
      route: 'tailor',
      session_id: session_id || 'unknown',
      hasResumeFile: !!resume_file,
      jdLength: jd_text_raw.length,
      tone: tone || 'unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    }
    
    // Log the error with context
    logError(error as Error, errorDetails)
    
    // Create user-friendly error message
    const userMessage = createUserFriendlyError(error as Error, errorDetails)
    
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
