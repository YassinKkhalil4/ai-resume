import { extractKeywords2 } from './jd'
import { ResumeJSON, KeywordStats } from './types'
import OpenAI from 'openai'

export function atsCheck(resume: ResumeJSON, jdText: string): KeywordStats {
  const { all, must, nice } = extractKeywords2(jdText, 20)
  const resumeText = stringifyResume(resume).toLowerCase()

  const matched = all.filter(k => resumeText.includes(k.toLowerCase()))
  const missing = all.filter(k => !resumeText.includes(k.toLowerCase()))

  const mustMatched = must.filter(k => resumeText.includes(k.toLowerCase()))
  const mustMissing = must.filter(k => !resumeText.includes(k.toLowerCase()))
  const niceMatched = nice.filter(k => resumeText.includes(k.toLowerCase()))
  const niceMissing = nice.filter(k => !resumeText.includes(k.toLowerCase()))

  const warnings:string[] = []
  
  // Enhanced section detection with better validation
  if (!hasExperienceSection(resume)) {
    warnings.push('No Experience section detected.')
  }
  if (!hasSkillsSection(resume)) {
    warnings.push('No Skills section detected.')
  }

  const base: KeywordStats = {
    coverage: all.length ? matched.length / all.length : 0,
    matched, missing, warnings,
    mustCoverage: must.length ? mustMatched.length / must.length : 0,
    niceCoverage: nice.length ? niceMatched.length / nice.length : 0,
    mustMatched, mustMissing, niceMatched, niceMissing,
    topMissing: missing.slice(0,5)
  }
  return base
}

function hasExperienceSection(resume: ResumeJSON): boolean {
  if (!resume.experience || resume.experience.length === 0) return false
  
  // Check if experience has meaningful content
  return resume.experience.some(exp => 
    exp.company && exp.role && 
    (exp.bullets?.length || 0) > 0
  )
}

function hasSkillsSection(resume: ResumeJSON): boolean {
  if (!resume.skills || resume.skills.length === 0) return false
  
  // Check if skills have meaningful content
  return resume.skills.some(skill => 
    skill && skill.trim().length > 2
  )
}

function stringifyResume(resume: ResumeJSON): string {
  const parts: string[] = []
  
  if (resume.summary) parts.push(resume.summary)
  if (resume.skills?.length) parts.push(resume.skills.join(' '))
  if (resume.experience?.length) {
    resume.experience.forEach(exp => {
      if (exp.company) parts.push(exp.company)
      if (exp.role) parts.push(exp.role)
      if (exp.bullets?.length) parts.push(exp.bullets.join(' '))
    })
  }
  if (resume.education?.length) parts.push(resume.education.join(' '))
  if (resume.certifications?.length) parts.push(resume.certifications.join(' '))
  
  return parts.join(' ')
}
