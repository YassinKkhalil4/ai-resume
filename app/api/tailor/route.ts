import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { extractJDFromUrl, extractKeywords } from '../../../lib/jd'
import { getOpenAI, OPENAI_MODEL } from '../../../lib/openai'
import { SYSTEM_PROMPT, makeUserPrompt } from '../../../lib/prompts'
import { atsCheck } from '../../../lib/ats'
import { buildDiffs } from '../../../lib/diff'
import { integrityCheck } from '../../../lib/integrity'
import { createSession } from '../../../lib/sessions'
import { ResumeJSON, TailoredResult, Tone } from '../../../lib/types'
import { enforceGuards } from '../../../lib/guards'
import { detectLocale } from '../../../lib/locale'
import { TailoredResultSchema } from '../../../lib/schemas'
import { startTrace } from '../../../lib/telemetry'

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

  const resume_file = form.get('resume_file') as unknown as File | null
  const jd_text_raw = form.get('jd_text')?.toString() || ''
  const tone = (form.get('tone')?.toString() as Tone) || 'professional'

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
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: makeUserPrompt({ resume_json: original, job_text: jdText + '\n\nLOCALE:' + locale, tone }) }
  ]

  const chat = await getOpenAI().chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' }
  })

  const raw = chat.choices[0]?.message?.content || '{}'
  let tailored: TailoredResult
  try { tailored = JSON.parse(raw) } catch { return NextResponse.json({ error: 'LLM returned invalid JSON', code:'llm_json' }, { status: 500 }) }
  try { (TailoredResultSchema.parse(tailored)) } catch (e:any) { return NextResponse.json({ error: 'Model output failed schema validation', code:'schema_invalid', details: e?.errors||String(e) }, { status: 500 }) }

  const jdKeywords = extractKeywords(jdText, 30)
  const integ = integrityCheck(original.experience || [], tailored.experience || [], jdKeywords)
  if (!integ.ok) {
    const messagesRetry = [
      { role: 'system' as const, content: SYSTEM_PROMPT + '\nSTRICT RULE: Do not add any tools, companies, or products not present in the original resume.' },
      { role: 'user' as const, content: makeUserPrompt({ resume_json: original, job_text: jdText + '\n\nLOCALE:' + locale, tone }) }
    ]
    const chat2 = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: messagesRetry,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
    const raw2 = chat2.choices[0]?.message?.content || '{}'
    try { tailored = JSON.parse(raw2) } catch {}
  }

  const diffs = buildDiffs(original.experience || [], tailored.experience || [])
  const keyword_stats = atsCheck(tailored, jdText)

  const session = createSession(original, tailored, jdText, keyword_stats)

  const usage = chat.usage || {}
  trace.end(true, { tokens_prompt: (usage as any).prompt_tokens||null, tokens_completion: (usage as any).completion_tokens||null })

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
    console.error('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasInviteCodes: !!process.env.INVITE_CODES,
      hasAdminKey: !!process.env.ADMIN_KEY
    })
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'server_error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
