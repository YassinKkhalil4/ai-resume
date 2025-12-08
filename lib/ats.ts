import { extractKeywords2 } from './jd'
import { ResumeJSON, KeywordStats, KeywordStatsComparison } from './types'
import { normalizeKeyword, keywordsMatch, extractKeyTerms } from './keyword-utils'

export function atsCheck(resume: ResumeJSON, jdText: string): KeywordStats {
  const { all, must, nice, industry } = extractKeywords2(jdText, 20)
  const resumeText = stringifyResume(resume)
  const resumeTerms = extractKeyTerms(resumeText)

  // Use normalized matching for better accuracy
  const matched = all.filter(k => {
    const normalizedK = normalizeKeyword(k)
    // Check exact match first
    if (resumeText.toLowerCase().includes(k.toLowerCase())) {
      return true
    }
    // Check normalized/fuzzy match
    for (const term of resumeTerms) {
      if (keywordsMatch(normalizedK, term, 0.80)) {
        return true
      }
    }
    return false
  })
  const missing = all.filter(k => !matched.includes(k))

  const mustMatched = must.filter(k => {
    const normalizedK = normalizeKeyword(k)
    if (resumeText.toLowerCase().includes(k.toLowerCase())) return true
    for (const term of resumeTerms) {
      if (keywordsMatch(normalizedK, term, 0.80)) return true
    }
    return false
  })
  const mustMissing = must.filter(k => !mustMatched.includes(k))
  const niceMatched = nice.filter(k => {
    const normalizedK = normalizeKeyword(k)
    if (resumeText.toLowerCase().includes(k.toLowerCase())) return true
    for (const term of resumeTerms) {
      if (keywordsMatch(normalizedK, term, 0.80)) return true
    }
    return false
  })
  const niceMissing = nice.filter(k => !niceMatched.includes(k))

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
    topMissing: missing.slice(0,5),
    allKeywords: all,
    industry: (() => {
      if (!industry || industry.jdKeywords.length === 0) return undefined
      const domainKeywords = industry.jdKeywords
      const domainMatched = domainKeywords.filter(k => {
        const normalizedK = normalizeKeyword(k)
        if (resumeText.toLowerCase().includes(k.toLowerCase())) return true
        for (const term of resumeTerms) {
          if (keywordsMatch(normalizedK, term, 0.80)) return true
        }
        return false
      })
      const domainMissing = domainKeywords.filter(k => !domainMatched.includes(k))
      const domainCoverage = domainKeywords.length ? domainMatched.length / domainKeywords.length : 0
      return {
        key: industry.key,
        label: industry.label,
        canonicalKeywords: industry.canonicalKeywords,
        jdKeywords: domainKeywords,
        matched: domainMatched,
        missing: domainMissing,
        coverage: domainCoverage
      }
    })()
  }
  return base
}

export function compareKeywordStats(original: KeywordStats, tailored: KeywordStats): KeywordStatsComparison {
  const coverageDelta = (tailored.coverage || 0) - (original.coverage || 0)
  const mustDelta = (tailored.mustCoverage || 0) - (original.mustCoverage || 0)
  const niceDelta = (tailored.niceCoverage || 0) - (original.niceCoverage || 0)

  const normalize = (keyword: string) => normalizeKeyword(keyword)
  const originalMatchedSet = new Set((original.matched || []).map(normalize))
  const tailoredMatchedSet = new Set((tailored.matched || []).map(normalize))

  const matchedGain = (tailored.matched || []).filter(k => !originalMatchedSet.has(normalize(k)))
  const regressions = (original.matched || []).filter(k => !tailoredMatchedSet.has(normalize(k)))

  const originalMissingSet = new Set((original.missing || []).map(normalize))
  const tailoredMissingSet = new Set((tailored.missing || []).map(normalize))

  const resolvedMissing = (original.missing || []).filter(k => !tailoredMissingSet.has(normalize(k)))
  const remainingMissing = (tailored.missing || [])

  const industryComparison = (() => {
    const baseline = original.industry
    const current = tailored.industry
    if (!baseline && !current) return undefined
    const baselineCoverage = baseline?.coverage || 0
    const currentCoverage = current?.coverage || 0
    const baseMatchedSet = new Set((baseline?.matched || []).map(normalize))
    const currentMatched = current?.matched || []
    const newlyMatched = currentMatched.filter(k => !baseMatchedSet.has(normalize(k)))
    const remaining = current?.missing || []
    return {
      label: current?.label || baseline?.label,
      baseline: baselineCoverage,
      current: currentCoverage,
      delta: currentCoverage - baselineCoverage,
      newlyMatched,
      remainingMissing: remaining
    }
  })()

  return {
    original,
    tailored,
    deltas: {
      coverage: coverageDelta,
      mustCoverage: mustDelta,
      niceCoverage: niceDelta,
      matchedGain,
      resolvedMissing,
      remainingMissing,
      regressions
    },
    industry: industryComparison
  }
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
  if (resume.projects?.length) {
    resume.projects.forEach(project => {
      if (project.name) parts.push(project.name)
      if (project.bullets?.length) parts.push(project.bullets.join(' '))
    })
  }
  if (resume.additional_sections?.length) {
    resume.additional_sections.forEach(section => {
      if (section.heading) parts.push(section.heading)
      if (section.lines?.length) parts.push(section.lines.join(' '))
    })
  }
  
  return parts.join(' ')
}
