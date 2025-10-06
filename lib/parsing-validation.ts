import { ResumeJSON } from './types'

export interface ParsingValidationResult {
  isValid: boolean
  hasExperience: boolean
  hasSkills: boolean
  hasSummary: boolean
  experienceCount: number
  skillsCount: number
  summaryLength: number
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

export function validateParsingResult(resume: ResumeJSON): ParsingValidationResult {
  const result: ParsingValidationResult = {
    isValid: true,
    hasExperience: false,
    hasSkills: false,
    hasSummary: false,
    experienceCount: 0,
    skillsCount: 0,
    summaryLength: 0,
    errors: [],
    warnings: [],
    suggestions: []
  }

  // Check experience
  if (resume.experience && resume.experience.length > 0) {
    result.hasExperience = true
    result.experienceCount = resume.experience.length
    
    // Check if experience has meaningful content
    const hasMeaningfulExperience = resume.experience.some(exp => 
      exp.bullets && exp.bullets.length > 0
    )
    
    if (!hasMeaningfulExperience) {
      result.warnings.push('Experience found but no bullet points detected')
      result.suggestions.push('Consider adding bullet points to your experience entries')
    }
  } else {
    result.errors.push('No work experience detected')
    result.suggestions.push('Paste your work history or pick lines to mark as experience')
  }

  // Check skills
  if (resume.skills && resume.skills.length > 0) {
    result.hasSkills = true
    result.skillsCount = resume.skills.length
  } else {
    result.warnings.push('No skills section detected')
    result.suggestions.push('Consider adding a skills section to your resume')
  }

  // Check summary
  if (resume.summary && resume.summary.trim().length > 0) {
    result.hasSummary = true
    result.summaryLength = resume.summary.trim().length
    
    if (resume.summary.trim().length < 50) {
      result.warnings.push('Summary is very short')
      result.suggestions.push('Consider expanding your professional summary')
    }
  } else {
    result.warnings.push('No summary detected')
    result.suggestions.push('Consider adding a professional summary')
  }

  // Overall validation
  if (result.errors.length > 0) {
    result.isValid = false
  }

  return result
}

export function shouldShowExperienceBanner(validation: ParsingValidationResult): boolean {
  return !validation.hasExperience || validation.experienceCount === 0
}

export function shouldShowSkillsBanner(validation: ParsingValidationResult): boolean {
  return !validation.hasSkills || validation.skillsCount === 0
}

export function shouldShowSummaryBanner(validation: ParsingValidationResult): boolean {
  return !validation.hasSummary || validation.summaryLength < 50
}

export function createErrorState(validation: ParsingValidationResult): {
  type: 'error' | 'warning' | 'success'
  title: string
  message: string
  actions: Array<{ label: string, action: string }>
} {
  if (!validation.hasExperience) {
    return {
      type: 'error',
      title: 'Experience Not Found',
      message: 'We couldn\'t find any work experience in your resume. This is required for tailoring.',
      actions: [
        { label: 'Paste Work History', action: 'paste_experience' },
        { label: 'Mark Lines as Experience', action: 'mark_experience' },
        { label: 'Try Different Resume', action: 'upload_new' }
      ]
    }
  }

  if (validation.experienceCount > 0 && validation.experienceCount < 2) {
    return {
      type: 'warning',
      title: 'Limited Experience Found',
      message: `Only ${validation.experienceCount} work experience found. More experience will improve tailoring results.`,
      actions: [
        { label: 'Add More Experience', action: 'add_experience' },
        { label: 'Continue Anyway', action: 'continue' }
      ]
    }
  }

  if (!validation.hasSkills) {
    return {
      type: 'warning',
      title: 'Skills Section Missing',
      message: 'No skills section detected. Adding skills will improve ATS compatibility.',
      actions: [
        { label: 'Add Skills', action: 'add_skills' },
        { label: 'Continue Without Skills', action: 'continue' }
      ]
    }
  }

  return {
    type: 'success',
    title: 'Resume Parsed Successfully',
    message: 'Your resume has been parsed and is ready for tailoring.',
    actions: [
      { label: 'Continue to Tailoring', action: 'continue' }
    ]
  }
}
