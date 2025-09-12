import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { extractJDFromUrl, extractKeywords } from '../../../lib/jd'
import { atsCheck } from '../../../lib/ats'
import { buildDiffs } from '../../../lib/diff'
import { integrityCheck } from '../../../lib/integrity'
import { createSession } from '../../../lib/sessions'
import { ResumeJSON, TailoredResult, Tone } from '../../../lib/types'
import { enforceGuards } from '../../../lib/guards'
import { detectLocale } from '../../../lib/locale'
import { startTrace, logError, logSessionActivity } from '../../../lib/telemetry'
import { getTailoredResume } from '../../../lib/ai-response-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    error: 'Method not allowed', 
    message: 'This endpoint only accepts POST requests',
    method: req.method
  }, { status: 405 })
}

export async function POST(req: NextRequest) {
  console.log('Tailor API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    hasFormData: !!req.formData
  })
  
  // Declare variables outside try block for error handling
  let resume_file: File | null = null
  let jd_text_raw = ''
  let tone: Tone = 'professional'
  
  try {
    console.log('Starting guard check...')
    const guard = enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    console.log('Guard check passed')

    console.log('Starting trace...')
    const trace = startTrace({ route: 'tailor' })
    console.log('Trace started')

      console.log('Parsing form data...')
    const form = await req.formData()
    console.log('Form data parsed successfully')
    
    const mode = form.get('mode')?.toString()
    console.log('Mode:', mode)

    const jd_url = form.get('jd_url')?.toString()
    if (mode === 'fetchOnly' && jd_url) {
      try {
        console.log('Fetching JD from URL:', jd_url)
        const jd_text = await extractJDFromUrl(jd_url)
        return NextResponse.json({ jd_text })
      } catch (e:any) {
        console.error('JD fetch failed:', e)
        return NextResponse.json({ error: e?.message || 'Fetch failed' }, { status: 400 })
      }
    }

  resume_file = form.get('resume_file') as unknown as File | null
  jd_text_raw = form.get('jd_text')?.toString() || ''
  tone = (form.get('tone')?.toString() as Tone) || 'professional'

  console.log('Processing request:', { 
    hasResumeFile: !!resume_file, 
    jdTextLength: jd_text_raw.length,
    tone 
  })

  if (!resume_file) return NextResponse.json({ error: 'Missing resume_file' }, { status: 400 })
  if (!jd_text_raw) return NextResponse.json({ error: 'Missing jd_text' }, { status: 400 })

  const { text: resumeText, ext } = await extractTextFromFile(resume_file)
  if (ext==='pdf' && (!resumeText || resumeText.trim().length < 50)) {
    return NextResponse.json({ error: 'Your PDF appears to be image-only (scanned). Please upload a DOCX or a text-based PDF.', code:'scanned_pdf' }, { status: 400 })
  }

  const original: ResumeJSON = heuristicParseResume(resumeText)

  let jdText = jd_text_raw
  if (/^https?:\/\//i.test(jdText)) {
    try { jdText = await extractJDFromUrl(jdText) } catch {}
  }

  if ((jdText||'').trim().length < 60) {
    return NextResponse.json({ error: 'Job description is too short/invalid. Paste the full responsibilities & requirements.', code:'jd_too_short' }, { status: 400 })
  }

  const locale = detectLocale(resumeText + '\n' + jdText)
  
  // Use the new robust AI response parser
  let tailored: TailoredResult
  try {
    tailored = await getTailoredResume(original, jdText + '\n\nLOCALE:' + locale, tone)
  } catch (error) {
    console.error('Failed to get tailored resume:', error)
    logError(error as Error, { original, jdText, tone })
    return NextResponse.json({ 
      error: 'Failed to tailor resume', 
      code: 'tailoring_failed',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }

  const jdKeywords = extractKeywords(jdText, 30)
  const integ = integrityCheck(original.experience || [], tailored.experience || [], jdKeywords)
  if (!integ.ok) {
    console.warn('Integrity check failed, attempting retry with stricter rules')
    try {
      // Retry with stricter integrity rules
      tailored = await getTailoredResume(original, jdText + '\n\nLOCALE:' + locale + '\n\nSTRICT RULE: Do not add any tools, companies, or products not present in the original resume.', tone)
    } catch (retryError) {
      console.warn('Retry with stricter rules also failed:', retryError)
      // Continue with the original response
    }
  }

  const diffs = buildDiffs(original.experience || [], tailored.experience || [])
  const keyword_stats = atsCheck(tailored, jdText)

  const session = createSession(original, tailored, jdText, keyword_stats)

  // Log session creation
  logSessionActivity(session.id, 'created', { 
    hasResume: !!resume_file, 
    jdLength: jdText.length,
    tone,
    integrityOk: integ.ok
  })

  trace.end(true, { 
    sessionId: session.id,
    integrityOk: integ.ok,
    experienceCount: tailored.experience?.length || 0
  })

  return NextResponse.json({
    session_id: session.id,
    preview_sections_json: {
      summary: tailored.summary,
      skills: tailored.skills_section,
      experience: tailored.experience,
      education: original.education,
      certifications: original.certifications
    },
    original_sections_json: original,
    diffs,
    keyword_stats
  })
  } catch (error) {
    console.error('Tailor API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Log the error with context
    logError(error as Error, {
      route: 'tailor',
      hasResume: !!resume_file,
      jdLength: jd_text_raw?.length || 0,
      tone,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasInviteCodes: !!process.env.INVITE_CODES,
        hasAdminKey: !!process.env.ADMIN_KEY
      }
    })
    
    trace.end(false, { error: String(error) })
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'server_error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
