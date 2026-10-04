import { NextRequest, NextResponse } from 'next/server'
import { enforceGuards } from '../../../lib/guards'
import { requireEmailVerification } from '../../../lib/guards'
import { createSession, getOwnedSession, updateSession } from '../../../lib/sessions'
import { ResumeJSON } from '../../../lib/types'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { extractBulletsFromFreeText } from '../../../lib/ai-response-parser'
import { NoCreditsError } from '../../../lib/billing/deduct-credit'
import { withCreditReservation } from '../../../lib/billing/with-credit'
import { getUserCredits } from '../../../lib/auth/utils'
import { LIMITS, parseTone, textTooLong } from '../../../lib/validation'
import { createHash } from 'crypto'

// extractBulletsFromFreeText is only called here on explicit user action ("Paste your experience") — never automatic (AI hallucination prevention).

type Outcome =
  | { kind: 'empty' }
  | { kind: 'no_session' }
  | {
      kind: 'ok'
      session: { id: string; version: string }
      originalResume: ResumeJSON
      originalRawText: string
      tailored: any
      tokens: number
      ats: any
      extractedExperience: ResumeJSON['experience']
    }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  console.log('Process Experience API called:', {
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
      experienceText, 
      sessionId, 
      jdText, 
      tone: toneRaw
    } = body
    const tone = parseTone(toneRaw)

    if (!experienceText || !jdText || typeof experienceText !== 'string' || typeof jdText !== 'string') {
      return NextResponse.json({
        code: 'invalid_input',
        message: 'Missing experience text or job description'
      }, { status: 400 })
    }

    if (textTooLong(experienceText, LIMITS.experienceChars) || textTooLong(jdText, LIMITS.jdChars)) {
      return NextResponse.json({
        code: 'input_too_large',
        message: 'Experience text or job description is too long'
      }, { status: 413 })
    }

    const resumeHash = createHash('sha256').update(experienceText).digest('hex')
    let outcome: Outcome
    try {
      outcome = await withCreditReservation<Outcome>(user.id, resumeHash, async () => {
        const extractedExperience = await extractBulletsFromFreeText(experienceText)
        if (extractedExperience.length === 0) {
          return { result: { kind: 'empty' as const }, charge: false }
        }

        const existingSession = sessionId ? await getOwnedSession(sessionId, user.id) : null
        const originalRawText = existingSession?.originalRawText || experienceText

        // Reuse the existing resume structure when there is one, otherwise start minimal
        const originalResume: ResumeJSON = existingSession
          ? { ...existingSession.original, experience: extractedExperience }
          : {
              summary: 'Professional with relevant experience',
              skills: [],
              experience: extractedExperience,
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
          return { result: { kind: 'no_session' as const }, charge: false }
        }
        return {
          result: { kind: 'ok' as const, session, originalResume, originalRawText, tailored, tokens, ats, extractedExperience },
          tokens,
        }
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

    if (outcome.kind === 'empty') {
      return NextResponse.json({
        code: 'no_experience_extracted',
        message: 'Could not extract structured experience from the provided text'
      }, { status: 400 })
    }
    if (outcome.kind === 'no_session') {
      return NextResponse.json({
        code: 'session_error',
        message: 'Failed to create or update session'
      }, { status: 500 })
    }

    const { session, originalResume, originalRawText, tailored, tokens, ats, extractedExperience } = outcome

    console.log('Experience processing completed successfully:', {
      sessionId: session.id,
      extractedExperienceCount: extractedExperience.length
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
      extracted_experience_count: extractedExperience.length,
      message: 'Experience processed and resume tailored successfully'
    })

  } catch (error) {
    console.error('Process experience error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const message = error instanceof Error ? error.message : String(error)
    if (/time budget|timeout/i.test(message)) {
      return NextResponse.json({
        code: 'function_timeout',
        message: 'Tailoring took too long and was cancelled. Please try again with a shorter selection.',
        timestamp: new Date().toISOString()
      }, { status: 504 })
    }
    
    return NextResponse.json({
      code: 'processing_failed',
      message: 'Failed to process experience text',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
