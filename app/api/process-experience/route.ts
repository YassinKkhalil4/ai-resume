import { NextRequest, NextResponse } from 'next/server'
import { enforceGuards } from '../../../lib/guards'
import { createSession, getSession, updateSession } from '../../../lib/sessions'
import { ResumeJSON, TailoredResult, KeywordStats } from '../../../lib/types'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { atsCheck } from '../../../lib/ats'
import { extractBulletsFromFreeText } from '../../../lib/ai-response-parser'

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
    const guard = enforceGuards(req)
    if (!guard.ok) return guard.res

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
      existingSession = getSession(sessionId)
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

    // Run ATS check
    const keywordStats = atsCheck(originalResume, jdText)
    console.log('ATS check completed:', {
      coverage: keywordStats.coverage,
      matchedKeywords: keywordStats.matched?.length || 0,
      missingKeywords: keywordStats.missing?.length || 0
    })

    // Tailor the resume with AI
    console.log('Starting AI tailoring...')
    const { tailored, tokens } = await getTailoredResume(originalResume, jdText, tone)
    console.log('AI tailoring completed:', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0,
      tokensUsed: tokens
    })

    // Create or update session
    let session
    if (existingSession) {
      session = updateSession(sessionId, {
        original: originalResume,
        tailored: tailored,
        jdText: jdText,
        keywordStats: keywordStats,
        originalRawText
      })
    } else {
      session = createSession(originalResume, tailored, jdText, keywordStats, originalRawText)
    }

    if (!session) {
      return NextResponse.json({
        code: 'session_error',
        message: 'Failed to create or update session'
      }, { status: 500 })
    }

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
      keyword_stats: keywordStats,
      tokens_used: tokens,
      extracted_experience_count: extractedExperience.length,
      message: 'Experience processed and resume tailored successfully'
    })

  } catch (error) {
    console.error('Process experience error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json({
      code: 'processing_failed',
      message: 'Failed to process experience text',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
