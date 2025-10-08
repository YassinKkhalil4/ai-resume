import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { atsCheck } from '../../../lib/ats'
import { createSession } from '../../../lib/sessions'
import { enforceGuards } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { validateParsingResult, shouldShowExperienceBanner } from '../../../lib/parsing-validation'

export async function POST(req: NextRequest) {
  try {
    console.log('Debug Tailor Step-by-Step API called')
    
    // Step 1: Guard check
    console.log('Step 1: Guard check...')
    const guard = enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    console.log('Step 1: Guard check passed')
    
    // Step 2: Parse form data
    console.log('Step 2: Parse form data...')
    const form = await req.formData()
    const resume_file = form.get('resume_file') as unknown as File | null
    const jd_text_raw = form.get('jd_text')?.toString() || ''
    const tone = (form.get('tone')?.toString() as any) || 'professional'
    
    if (!resume_file) {
      return NextResponse.json({ code: 'missing_resume', message: 'Missing resume input' }, { status: 400 })
    }
    if (!jd_text_raw) {
      return NextResponse.json({ code: 'missing_jd', message: 'Missing jd_text' }, { status: 400 })
    }
    console.log('Step 2: Form data parsed successfully')
    
    // Step 3: Extract text from file
    console.log('Step 3: Extract text from file...')
    const parsed = await extractTextFromFile(resume_file)
    const resumeText = parsed.text
    const ext = parsed.ext
    console.log('Step 3: Text extracted successfully', {
      textLength: resumeText.length,
      extension: ext
    })
    
    // Step 4: Parse resume
    console.log('Step 4: Parse resume...')
    const original = heuristicParseResume(resumeText)
    console.log('Step 4: Resume parsed successfully', {
      hasSummary: !!original.summary,
      skillsCount: original.skills?.length || 0,
      experienceCount: original.experience?.length || 0
    })
    
    // Step 5: Validate parsing
    console.log('Step 5: Validate parsing...')
    const validation = validateParsingResult(original)
    console.log('Step 5: Validation completed', validation)
    
    // Step 6: Check if should show banner
    console.log('Step 6: Check experience banner...')
    if (shouldShowExperienceBanner(validation)) {
      console.log('Step 6: Should show experience banner')
      return NextResponse.json({
        code: 'missing_experience',
        message: 'No work experience detected in your resume',
        validation,
        original_sections_json: original
      }, { status: 422 })
    }
    console.log('Step 6: No experience banner needed')
    
    // Step 7: AI tailoring
    console.log('Step 7: AI tailoring...')
    const { tailored, tokens } = await getTailoredResume(original, jd_text_raw, tone)
    console.log('Step 7: AI tailoring completed', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0,
      tokens
    })
    
    // Step 8: ATS check
    console.log('Step 8: ATS check...')
    const keywordStats = atsCheck(original, jd_text_raw)
    console.log('Step 8: ATS check completed', {
      coverage: keywordStats.coverage,
      matchedKeywords: keywordStats.matched?.length || 0
    })
    
    // Step 9: Create session
    console.log('Step 9: Create session...')
    const session = createSession(original, tailored, jd_text_raw, keywordStats)
    console.log('Step 9: Session created successfully', {
      sessionId: session.id
    })
    
    return NextResponse.json({
      status: 'success',
      message: 'All steps completed successfully',
      session_id: session.id,
      steps_completed: [
        'Guard check',
        'Form data parsing',
        'Text extraction',
        'Resume parsing',
        'Validation',
        'Experience banner check',
        'AI tailoring',
        'ATS check',
        'Session creation'
      ],
      data: {
        original: original,
        tailored: tailored,
        validation: validation,
        keywordStats: keywordStats,
        tokens: tokens
      }
    })
    
  } catch (error: any) {
    console.error('Debug Tailor Step-by-Step API error:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: error.stack,
      step: 'Unknown'
    }, { status: 500 })
  }
}
