import { NextRequest, NextResponse } from 'next/server'
import { enforceGuards } from '../../../lib/guards'
import { requireEmailVerification } from '../../../lib/guards'
import { createSession, getSession, updateSession } from '../../../lib/sessions'
import { ResumeJSON } from '../../../lib/types'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { extractBulletsFromFreeText } from '../../../lib/ai-response-parser'
import { commitCreditReservation, CreditReservation, NoCreditsError, releaseCreditReservation, reserveCredit } from '../../../lib/billing/deduct-credit'
import { createHash } from 'crypto'

// extractBulletsFromFreeText is only called here on explicit user action ("Paste your experience") — never automatic (AI hallucination prevention).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  let creditReservation: CreditReservation | null = null

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
      tone = 'professional' 
    } = body

    if (!experienceText || !jdText) {
      return NextResponse.json({
        code: 'invalid_input',
        message: 'Missing experience text or job description'
      }, { status: 400 })
    }

    try {
      const resumeHash = createHash('sha256').update(experienceText).digest('hex')
      creditReservation = await reserveCredit(user.id, resumeHash)
    } catch (error) {
      if (error instanceof NoCreditsError) {
        return NextResponse.json(
          {
            code: 'no_credits',
            message: 'You have no credits remaining. Please purchase credits to continue.',
            creditsRemaining: user.creditsRemaining,
          },
          { status: 402 }
        )
      }
      throw error
    }

    console.log('Processing experience text:', {
      experienceTextLength: experienceText.length,
      hasSessionId: !!sessionId,
      jdTextLength: jdText.length,
      tone
    })

    // Extract structured experience from the free text
    console.log('Extracting experience from free text...')
    const extractedExperience = await extractBulletsFromFreeText(experienceText)
    
    if (extractedExperience.length === 0) {
      await releaseCreditReservation(creditReservation)
      creditReservation = null
      return NextResponse.json({
        code: 'no_experience_extracted',
        message: 'Could not extract structured experience from the provided text'
      }, { status: 400 })
    }

    console.log('Extracted experience:', {
      experienceCount: extractedExperience.length,
      totalBullets: extractedExperience.reduce((total, exp) => total + exp.bullets.length, 0)
    })

    // Create or get the original resume structure
    let originalResume: ResumeJSON
    let existingSession = null

    if (sessionId) {
      existingSession = await getSession(sessionId)
    }

    const originalRawText = existingSession?.originalRawText || experienceText

    if (existingSession) {
      // Use existing resume structure and update experience
      originalResume = {
        ...existingSession.original,
        experience: extractedExperience
      }
    } else {
      // Create a minimal resume structure with the extracted experience
      originalResume = {
        summary: 'Professional with relevant experience',
        skills: [],
        experience: extractedExperience,
        education: [],
        certifications: []
      }
    }

    console.log('Created resume structure:', {
      hasSummary: !!originalResume.summary,
      skillsCount: originalResume.skills.length,
      experienceCount: originalResume.experience.length,
      educationCount: originalResume.education.length,
      certificationsCount: originalResume.certifications.length
    })

    // Tailor the resume with AI
    console.log('Starting AI tailoring...')
    const deadline = Date.now() + 25000
    const { tailored, tokens, ats } = await getTailoredResume(originalResume, jdText, tone, { deadline })
    console.log('AI tailoring completed:', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0,
      tokensUsed: tokens,
      atsOriginal: ats.original.coverage,
      atsTailored: ats.tailored.coverage
    })

    // Create or update session
    let session
    if (existingSession) {
      session = await updateSession(sessionId, {
        original: originalResume,
        tailored: tailored,
        jdText: jdText,
        keywordStats: ats,
        originalRawText
      })
    } else {
      session = await createSession(originalResume, tailored, jdText, ats, originalRawText)
    }

    if (!session) {
      await releaseCreditReservation(creditReservation)
      creditReservation = null
      return NextResponse.json({
        code: 'session_error',
        message: 'Failed to create or update session'
      }, { status: 500 })
    }

    await commitCreditReservation(creditReservation!, tokens)
    creditReservation = null

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
    await releaseCreditReservation(creditReservation).catch((releaseError) => {
      console.error('Failed to release reserved credit:', releaseError)
    })

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
