import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { extractJDFromUrl, extractKeywords } from '../../../lib/jd'
import { atsCheck } from '../../../lib/ats'
import { buildDiffs } from '../../../lib/diff'
import { integrityCheck } from '../../../lib/integrity'
import { createSession } from '../../../lib/sessions'
import { ResumeJSON, TailoredResult, Tone } from '../../../lib/types'
import { enforceGuards, sessionID } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { detectLocale } from '../../../lib/locale'
import { startTrace, logError, logSessionActivity } from '../../../lib/telemetry'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { ocrExtractText } from '../../../lib/ocr'

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
  
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ code: 'no_openai_key', message: 'Server not configured' }, { status: 503 })
  }

  // Declare variables outside try block for error handling
  let resume_file: File | null = null
  let jd_text_raw = ''
  let tone: Tone = 'professional'
  let trace: any = null
  
  try {
    console.log('Starting guard check...')
    const guard = enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    const cfg = getConfig()
    if (cfg.pauseTailor) {
      return NextResponse.json({ code: 'paused', message: 'Tailoring is paused' }, { status: 503 })
    }
    console.log('Guard check passed')

    console.log('Starting trace...')
    trace = startTrace({ route: 'tailor' })
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
        return NextResponse.json({ code: 'fetch_failed', message: e?.message || 'Fetch failed' }, { status: 400 })
      }
    }

  resume_file = form.get('resume_file') as unknown as File | null
  jd_text_raw = form.get('jd_text')?.toString() || ''
  tone = (form.get('tone')?.toString() as Tone) || 'professional'
  const resume_text_fallback = form.get('resume_text')?.toString() || ''

  console.log('Processing request:', { 
    hasResumeFile: !!resume_file, 
    jdTextLength: jd_text_raw.length,
    tone 
  })

  if (!resume_file && !resume_text_fallback) return NextResponse.json({ code: 'missing_resume', message: 'Missing resume input' }, { status: 400 })
  if (!jd_text_raw) return NextResponse.json({ code: 'missing_jd', message: 'Missing jd_text' }, { status: 400 })

  let resumeText = ''
  let ext = 'txt'
  if (resume_file) {
    const parsed = await extractTextFromFile(resume_file)
    resumeText = parsed.text
    ext = parsed.ext
  } else if (resume_text_fallback) {
    resumeText = resume_text_fallback
  }
  if (resume_file && ext==='pdf' && (!resumeText || resumeText.trim().length < 50)) {
    // Attempt server-side OCR fallback when configured; prefer external worker
    try {
      const text = await ocrExtractText(resume_file as Blob, { maxPages: 4, lang: 'eng', denoise: true, deskew: true })
      if (text && text.trim().length >= 50) {
        resumeText = text
      } else {
        return NextResponse.json({ code: 'scanned_pdf', message: 'Your PDF appears to be image-only (scanned). Please upload a DOCX or a text-based PDF.' }, { status: 400 })
      }
    } catch (e) {
      return NextResponse.json({ code: 'scanned_pdf', message: 'Your PDF appears to be image-only (scanned). Please upload a DOCX or a text-based PDF.' }, { status: 400 })
    }
  }

  const original: ResumeJSON = heuristicParseResume(resumeText)

  let jdText = jd_text_raw
  if (/^https?:\/\//i.test(jdText)) {
    try { jdText = await extractJDFromUrl(jdText) } catch {}
  }

  if ((jdText||'').trim().length < 60) {
    return NextResponse.json({ code: 'jd_too_short', message: 'Job description is too short/invalid. Paste the full responsibilities & requirements.' }, { status: 400 })
  }

  const locale = detectLocale(resumeText + '\n' + jdText)
  
  // Use the new robust AI response parser
  let tailored: TailoredResult
  try {
    const t0 = Date.now()
    tailored = await getTailoredResume(original, jdText + '\n\nLOCALE:' + locale, tone)
    const ms = Date.now() - t0
    try { trace.end(true, { tailor_ms: ms }) } catch {}
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

  const payload = {
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
  }
  const sid = sessionID(req)
  if (sid === 'anon') {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    const res = NextResponse.json(payload)
    res.headers.append('Set-Cookie', `sid=${randomUUID()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`)
    return res
  }
  return NextResponse.json(payload)
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
    
    if (trace) trace.end(false, { error: String(error) })
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'server_error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
