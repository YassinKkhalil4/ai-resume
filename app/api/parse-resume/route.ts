import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, heuristicParseResume } from '../../../lib/parsers'
import { createSectionMapper, createParsingResult } from '../../../lib/section-mapper'
import { enforceGuards } from '../../../lib/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const guard = enforceGuards(req)
    if (!guard.ok) return guard.res

    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ 
        code: 'no_file', 
        message: 'No file provided' 
      }, { status: 400 })
    }

    // Extract text from file
    const { text } = await extractTextFromFile(file)
    
    // Parse resume with enhanced parsing
    const resume = heuristicParseResume(text)
    
    // Create section mapper
    const mapper = createSectionMapper()
    
    // Check if we need user confirmation
    const confidence = calculateParsingConfidence(resume)
    const needsConfirmation = confidence < 0.8
    
    let mapping = {}
    let suggestedMapping = undefined
    
    if (needsConfirmation) {
      // Find unknown sections and suggest mappings
      const unknownSections = findUnknownSections(resume)
      suggestedMapping = mapper.suggestMapping(unknownSections)
    }
    
    const result = createParsingResult(resume, mapping, confidence)
    
    return NextResponse.json({
      success: true,
      resume,
      confidence,
      needsConfirmation,
      suggestedMapping,
      message: needsConfirmation 
        ? 'Resume parsed with low confidence. Please confirm section mappings.'
        : 'Resume parsed successfully.'
    })
    
  } catch (error) {
    console.error('Resume parsing error:', error)
    return NextResponse.json({ 
      code: 'parsing_failed', 
      message: 'Failed to parse resume',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}

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
  
  // Bonus for experience with bullets
  if (resume.experience && resume.experience.length > 0) {
    const hasBullets = resume.experience.some((exp: any) => 
      exp.bullets && exp.bullets.length > 0
    )
    if (hasBullets) score += 0.5
    maxScore += 0.5
  }
  
  // Bonus for skills with multiple items
  if (resume.skills && resume.skills.length > 3) {
    score += 0.5
    maxScore += 0.5
  }
  
  return maxScore > 0 ? score / maxScore : 0
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
