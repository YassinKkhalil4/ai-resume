import { NextRequest, NextResponse } from 'next/server'
import { processLineSelections, validateProcessedExperience, createProcessingSummary, LineSelection } from '../../../lib/line-marking-parser'
import { enforceGuards } from '../../../lib/guards'
import { createSession, getSession, updateSession } from '../../../lib/sessions'
import { ResumeJSON } from '../../../lib/types'
import { getTailoredResume } from '../../../lib/ai-response-parser'

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
    const guard = enforceGuards(req)
    if (!guard.ok) return guard.res

    const body = await req.json()
    const { 
      resumeText, 
      selectedLines, 
      sessionId, 
      jdText, 
      tone = 'professional' 
    } = body

    if (!resumeText || !selectedLines || !Array.isArray(selectedLines)) {
      return NextResponse.json({
        code: 'invalid_input',
        message: 'Missing or invalid resumeText or selectedLines'
      }, { status: 400 })
    }

    if (!jdText) {
      return NextResponse.json({
        code: 'missing_jd',
        message: 'Job description text is required for tailoring'
      }, { status: 400 })
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

    // Create or get the original resume structure
    let originalResume: ResumeJSON
    let existingSession = null

    if (sessionId) {
      existingSession = getSession(sessionId)
    }

    const originalRawText = existingSession?.originalRawText || resumeText

    if (existingSession) {
      // Use existing resume structure and update experience
      originalResume = {
        ...existingSession.original,
        experience: validatedExperiences
      }
    } else {
      // Create a minimal resume structure with the processed experience
      originalResume = {
        summary: 'Professional with relevant experience',
        skills: [],
        experience: validatedExperiences,
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
      session = updateSession(sessionId, {
        original: originalResume,
        tailored: tailored,
        jdText: jdText,
        keywordStats: ats,
        originalRawText
      })
    } else {
      session = createSession(originalResume, tailored, jdText, ats, originalRawText)
    }

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
