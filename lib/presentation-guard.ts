import { ResumeJSON } from './types'
import { normalizeKeyword } from './keyword-utils'

export interface PresentationViolation {
  type: 'standalone_keywords' | 'keyword_blocks' | 'unnatural_phrasing'
  keywords: string[]
  location?: string
  severity: 'low' | 'medium' | 'high'
}

export interface PresentationQualityResult {
  naked_keywords_detected: boolean
  violations: PresentationViolation[]
  keywords: string[]
  auto_fix_applied: boolean
}

/**
 * Detects naked keywords - keywords that appear as standalone tokens
 * rather than embedded in natural professional phrasing
 */
export function detectNakedKeywords(resumeText: string, keywords: string[]): string[] {
  const detected: string[] = []
  const lowerText = resumeText.toLowerCase()
  
  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword.toLowerCase())
    const keywordLower = keyword.toLowerCase()
    
    // Pattern 1: Standalone keyword (surrounded by punctuation, spaces, or line breaks)
    // Examples: "Skills: saas, api, go" or "• saas • api • go"
    const standalonePattern = new RegExp(
      `(?:^|[\\s\\n\\r•,\\-]|:)${escapeRegex(keywordLower)}(?:[\\s\\n\\r•,\\-]|:|$)`,
      'i'
    )
    
    // Pattern 2: Keyword in a list (comma-separated or bullet-separated)
    // Examples: "saas, api, go" or "• saas • api • go"
    const listPattern = new RegExp(
      `(?:^|[\\s\\n\\r•,\\-])${escapeRegex(keywordLower)}(?:[\\s\\n\\r•,\\-]|$)`,
      'i'
    )
    
    // Pattern 3: Keyword as a standalone line item
    const lineItemPattern = new RegExp(
      `^[\\s\\-•]*${escapeRegex(keywordLower)}[\\s\\-•]*$`,
      'im'
    )
    
    // Check if keyword appears in natural context (as part of a phrase)
    const naturalPattern = new RegExp(
      `\\b${escapeRegex(keywordLower)}\\s+[a-z]+|\\b[a-z]+\\s+${escapeRegex(keywordLower)}\\b`,
      'i'
    )
    
    // If keyword matches standalone patterns but NOT natural patterns, it's naked
    if (
      (standalonePattern.test(lowerText) || listPattern.test(lowerText) || lineItemPattern.test(lowerText)) &&
      !naturalPattern.test(lowerText)
    ) {
      detected.push(keyword)
    }
  }
  
  return detected
}

/**
 * Detects keyword blocks - multiple keywords appearing in sequence
 */
export function detectKeywordBlocks(resumeText: string, keywords: string[]): string[] {
  const detected: string[] = []
  const lowerText = resumeText.toLowerCase()
  
  // Find sequences of 3+ keywords in close proximity (within 50 chars)
  for (let i = 0; i < keywords.length - 2; i++) {
    const keyword1 = keywords[i].toLowerCase()
    const keyword2 = keywords[i + 1].toLowerCase()
    const keyword3 = keywords[i + 2].toLowerCase()
    
    // Check if all three appear close together
    const pattern = new RegExp(
      `${escapeRegex(keyword1)}.{0,50}${escapeRegex(keyword2)}.{0,50}${escapeRegex(keyword3)}`,
      'i'
    )
    
    if (pattern.test(lowerText)) {
      detected.push(keyword1, keyword2, keyword3)
    }
  }
  
  return Array.from(new Set(detected))
}

/**
 * Main function to check presentation quality of a tailored resume
 */
export function checkPresentationQuality(
  tailoredResume: ResumeJSON,
  keywords: string[]
): PresentationQualityResult {
  const violations: PresentationViolation[] = []
  
  // Convert resume to text for analysis
  const resumeText = stringifyResume(tailoredResume)
  
  // Detect naked keywords
  const nakedKeywords = detectNakedKeywords(resumeText, keywords)
  if (nakedKeywords.length > 0) {
    violations.push({
      type: 'standalone_keywords',
      keywords: nakedKeywords,
      severity: nakedKeywords.length > 3 ? 'high' : nakedKeywords.length > 1 ? 'medium' : 'low',
    })
  }
  
  // Detect keyword blocks
  const keywordBlocks = detectKeywordBlocks(resumeText, keywords)
  if (keywordBlocks.length > 0) {
    violations.push({
      type: 'keyword_blocks',
      keywords: keywordBlocks,
      severity: 'high',
    })
  }
  
  return {
    naked_keywords_detected: nakedKeywords.length > 0,
    violations,
    keywords: [...new Set([...nakedKeywords, ...keywordBlocks])],
    auto_fix_applied: false, // Auto-fix would be implemented separately if needed
  }
}

/**
 * Helper to escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Convert ResumeJSON to plain text for analysis
 */
function stringifyResume(resume: ResumeJSON): string {
  const parts: string[] = []
  
  if (resume.summary) {
    parts.push(resume.summary)
  }
  
  if (resume.experience) {
    for (const role of resume.experience) {
      if (role.role) parts.push(role.role)
      if (role.company) parts.push(role.company)
      if (role.bullets) {
        parts.push(...role.bullets)
      }
    }
  }
  
  if (resume.skills) {
    parts.push(...resume.skills)
  }
  
  if (resume.education) {
    parts.push(...resume.education)
  }
  
  if (resume.certifications) {
    parts.push(...resume.certifications)
  }
  
  return parts.join('\n')
}

