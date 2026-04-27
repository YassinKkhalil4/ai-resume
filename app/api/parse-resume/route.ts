import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume, validateResumeUpload } from '../../../lib/parsers'
import { createSectionMapper, createParsingResult } from '../../../lib/section-mapper'
import { enforceGuards } from '../../../lib/guards'
import { trackEvent, getContext } from '../../../lib/analytics/tracker'
import { getCurrentUser } from '../../../lib/auth/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const guard = await enforceGuards(req)
    if (!guard.ok) return guard.res

    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ 
        code: 'no_file', 
        message: 'No file provided' 
      }, { status: 400 })
    }

    const fileValidation = validateResumeUpload(file)
    if (fileValidation.ok === false) {
      return NextResponse.json(
        { code: fileValidation.code, message: fileValidation.message },
        { status: fileValidation.status }
      )
    }

    // Extract text from file
    const parsed = await extractTextFromFile(file)
    
    // Check for scanned PDF error
    if (parsed.error === 'scanned_pdf') {
      return NextResponse.json({ 
        code: 'scanned_pdf', 
        message: parsed.message || 'Your PDF appears to be scanned. Please upload DOCX or a text-based PDF (File → Save as PDF).' 
      }, { status: 400 })
    }
    
    const { text } = parsed
    
    // Parse resume with enhanced parsing
    const resume = heuristicParseResume(text)
    
    // Create section mapper
    const mapper = createSectionMapper()
    
    // AI hallucination prevention: heuristic or zero-bullet roles require confirmation; never auto-tailor without user confirmation
    const confidence = calculateParsingConfidence(resume)
    const hasZeroBulletRole = (resume.experience ?? []).some(
      (exp: any) => exp.hasBullets === false || (exp.bullets && exp.bullets.length === 0)
    )
    const hasHeuristicExperience = resume.experienceSource === 'heuristic'
    const needsConfirmation =
      confidence < 0.8 || hasZeroBulletRole || hasHeuristicExperience

    let mapping = {}
    let suggestedMapping = undefined

    if (needsConfirmation) {
      // Find unknown sections and suggest mappings
      const unknownSections = findUnknownSections(resume)
      suggestedMapping = mapper.suggestMapping(unknownSections)
    }
    
    const result = createParsingResult(resume, mapping, confidence)
    result.needsConfirmation = needsConfirmation

    // Track resume parse success
    try {
      const user = await getCurrentUser().catch(() => null)
      const context = getContext(req)
      await trackEvent('resume_parse_success', {
        confidence,
        needsConfirmation,
        hasSummary: !!resume.summary,
        skillsCount: resume.skills?.length || 0,
        experienceCount: resume.experience?.length || 0,
      }, context, user?.id)
    } catch (trackError) {
      // Don't fail the request if tracking fails
      console.error('Failed to track parse success:', trackError)
    }
    
    return NextResponse.json({
      success: true,
      resume,
      resumeText: text,
      confidence,
      needsConfirmation,
      suggestedMapping,
      message: needsConfirmation 
        ? 'Resume parsed with low confidence. Please confirm section mappings.'
        : 'Resume parsed successfully.'
    })
    
  } catch (error) {
    console.error('Resume parsing error:', error)
    
    // Track resume parse failed
    try {
      const user = await getCurrentUser().catch(() => null)
      const context = getContext(req)
      await trackEvent('resume_parse_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }, context, user?.id)
    } catch (trackError) {
      // Don't fail the request if tracking fails
    }
    
    return NextResponse.json({ 
      code: 'parsing_failed', 
      message: 'Failed to parse resume',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}

/**
 * Parsing confidence; penalizes zero-bullet roles and heuristic experience (AI hallucination prevention).
 */
function calculateParsingConfidence(resume: any): number {
  let score = 0
  let maxScore = 0

  // Check for meaningful content in each section
  const sections = ['summary', 'skills', 'experience', 'education', 'certifications']

  for (const section of sections) {
    maxScore += 1
    if (resume[section] && resume[section].length > 0) {
      score += 1
    }
  }

  // Bonus for experience with bullets; penalize roles with zero bullets (no fabrication eligibility)
  if (resume.experience && resume.experience.length > 0) {
    const rolesWithBullets = resume.experience.filter(
      (exp: any) => exp.bullets && exp.bullets.length > 0
    )
    const hasAnyBullets = rolesWithBullets.length > 0
    const allRolesHaveBullets = rolesWithBullets.length === resume.experience.length
    if (hasAnyBullets) score += 0.5
    if (!allRolesHaveBullets) score -= 0.3 // Penalize zero-bullet roles
    maxScore += 0.5
  }

  // Penalize heuristic-derived experience (must not auto-tailor)
  if (resume.experienceSource === 'heuristic') {
    score -= 0.25
  }

  return maxScore > 0 ? Math.max(0, score / maxScore) : 0
}

function findUnknownSections(resume: any): string[] {
  const standardSections = ['summary', 'skills', 'experience', 'education', 'certifications']
  const unknownSections: string[] = []
  
  for (const [key, value] of Object.entries(resume)) {
    if (!standardSections.includes(key) && value && Array.isArray(value) && value.length > 0) {
      unknownSections.push(key)
    } else if (!standardSections.includes(key) && value && typeof value === 'string' && value.length > 0) {
      unknownSections.push(key)
    }
  }
  
  return unknownSections
}
