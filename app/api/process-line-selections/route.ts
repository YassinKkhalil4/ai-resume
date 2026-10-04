import { NextRequest, NextResponse } from 'next/server'
import { processLineSelections, validateProcessedExperience, createProcessingSummary, LineSelection } from '../../../lib/line-marking-parser'
import { enforceGuards } from '../../../lib/guards'
import { requireEmailVerification } from '../../../lib/guards'
import { createSession, getOwnedSession, updateSession } from '../../../lib/sessions'
import { ResumeJSON } from '../../../lib/types'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { NoCreditsError } from '../../../lib/billing/deduct-credit'
import { withCreditReservation } from '../../../lib/billing/with-credit'
import { getUserCredits } from '../../../lib/auth/utils'
import { LIMITS, parseTone, textTooLong } from '../../../lib/validation'
import { createHash } from 'crypto'

const MAX_SELECTED_LINES = 2000

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  console.log('Process Line Selections API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })

  try {
    const guard = await enforceGuards(req)
    if (!guard.ok) return guard.res

    const verificationCheck = await requireEmailVerification(req)
    if (!verificationCheck.ok) return verificationCheck.res
    const user = verificationCheck.user

    const body = await req.json()
    const { 
      resumeText, 
      selectedLines, 
      sessionId, 
      jdText, 
      tone: toneRaw
    } = body
    const tone = parseTone(toneRaw)

    if (!resumeText || !selectedLines || !Array.isArray(selectedLines)) {
      return NextResponse.json({
        code: 'invalid_input',
        message: 'Missing or invalid resumeText or selectedLines'
      }, { status: 400 })
    }

    if (!jdText || typeof jdText !== 'string') {
      return NextResponse.json({
        code: 'missing_jd',
        message: 'Job description text is required for tailoring'
      }, { status: 400 })
    }

    if (
      textTooLong(resumeText, LIMITS.resumeChars) ||
      textTooLong(jdText, LIMITS.jdChars) ||
      selectedLines.length > MAX_SELECTED_LINES
    ) {
      return NextResponse.json({
        code: 'input_too_large',
        message: 'Resume text, job description or line selection is too large'
      }, { status: 413 })
    }

    console.log('Processing line selections:', {
      resumeTextLength: resumeText.length,
      selectedLinesCount: selectedLines.length,
      hasSessionId: !!sessionId,
      jdTextLength: jdText.length,
      tone
    })

    // Process the line selections into structured experience
    const processedExperiences = processLineSelections(resumeText, selectedLines as LineSelection[])
    
    if (processedExperiences.length === 0) {
      return NextResponse.json({
        code: 'no_experience_processed',
        message: 'No valid experience could be extracted from the selected lines'
      }, { status: 400 })
    }

    // Validate and clean the processed experiences
    const validatedExperiences = processedExperiences.map(validateProcessedExperience)

    const resumeHash = createHash('sha256').update(resumeText).digest('hex')
    let outcome: { session: { id: string; version: string } | null; originalResume: ResumeJSON; originalRawText: string; tailored: any; tokens: number; ats: any }
    try {
      outcome = await withCreditReservation(user.id, resumeHash, async () => {
        const existingSession = sessionId ? await getOwnedSession(sessionId, user.id) : null
        const originalRawText = existingSession?.originalRawText || resumeText

        // Reuse the existing resume structure when there is one, otherwise start minimal
        const originalResume: ResumeJSON = existingSession
          ? { ...existingSession.original, experience: validatedExperiences }
          : {
              summary: 'Professional with relevant experience',
              skills: [],
              experience: validatedExperiences,
              education: [],
              certifications: [],
            }

        console.log('Starting AI tailoring...')
        const deadline = Date.now() + 25000
        const { tailored, tokens, ats } = await getTailoredResume(originalResume, jdText, tone, { deadline })

        const session = existingSession
          ? await updateSession(sessionId, {
              original: originalResume,
              tailored,
              jdText,
              keywordStats: ats,
              originalRawText,
            })
          : await createSession(originalResume, tailored, jdText, ats, originalRawText, user.id)

        if (!session) {
          return { result: { session: null, originalResume, originalRawText, tailored, tokens, ats }, charge: false }
        }
        return { result: { session, originalResume, originalRawText, tailored, tokens, ats }, tokens }
      })
    } catch (error) {
      if (error instanceof NoCreditsError) {
        return NextResponse.json(
          {
            code: 'no_credits',
            message: 'You have no credits remaining. Please purchase credits to continue.',
            creditsRemaining: await getUserCredits(user.id),
          },
          { status: 402 }
        )
      }
      throw error
    }

    const { session, originalResume, originalRawText, tailored, tokens, ats } = outcome
    if (!session) {
      return NextResponse.json({
        code: 'session_error',
        message: 'Failed to create or update session'
      }, { status: 500 })
    }

    // Create processing summary
    const summary = createProcessingSummary(selectedLines as LineSelection[], validatedExperiences)

    console.log('Line selection processing completed successfully:', {
      sessionId: session.id,
      summary
    })

    return NextResponse.json({
      success: true,
      session_id: session.id,
      session_version: session.version,
      original_sections_json: originalResume,
      original_raw_text: originalRawText,
      preview_sections_json: tailored,
      keyword_stats: ats,
      tokens_used: tokens,
      processing_summary: summary,
      message: 'Line selections processed and resume tailored successfully'
    })

  } catch (error) {
    console.error('Process line selections error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const message = error instanceof Error ? error.message : String(error)
    if (/time budget|timeout/i.test(message)) {
      return NextResponse.json({
        code: 'function_timeout',
        message: 'Tailoring took too long and was cancelled. Please refine your selection and try again.',
        timestamp: new Date().toISOString()
      }, { status: 504 })
    }
    
    return NextResponse.json({
      code: 'processing_failed',
      message: 'Failed to process line selections',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
