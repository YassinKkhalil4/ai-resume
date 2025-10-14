export type Tone = 'professional' | 'concise' | 'impact-heavy'

export type Role = {
  company?: string
  role?: string
  dates?: string
  bullets?: string[]
}

export type ResumeJSON = {
  contact?: Record<string, string>
  summary?: string
  skills?: string[]
  experience?: Role[]
  education?: string[]
  certifications?: string[]
  projects?: Array<{ name: string; bullets: string[] }>
  additional_sections?: Array<{ heading: string; lines: string[] }>
}

// Re-export the schema-based type to maintain compatibility
export type { TailoredResultType as TailoredResult } from './schemas'

export type IndustryKeywordStats = {
  key: string
  label: string
  jdKeywords: string[]
  canonicalKeywords: string[]
  matched: string[]
  missing: string[]
  coverage: number
}

export type KeywordStats = {
  coverage: number
  matched: string[]
  missing: string[]
  warnings: string[]
  mustCoverage?: number
  niceCoverage?: number
  mustMatched?: string[]
  mustMissing?: string[]
  niceMatched?: string[]
  niceMissing?: string[]
  topMissing?: string[]
  semanticCoverage?: number
  gaps?: Array<{ requirement:string, nearestBullet:string, score:number }>
  allKeywords?: string[]
  industry?: IndustryKeywordStats
}

export type KeywordStatsComparison = {
  original: KeywordStats
  tailored: KeywordStats
  deltas: {
    coverage: number
    mustCoverage: number
    niceCoverage: number
    matchedGain: string[]
    resolvedMissing: string[]
    remainingMissing: string[]
    regressions: string[]
  }
  industry?: {
    label?: string
    baseline: number
    current: number
    delta: number
    newlyMatched: string[]
    remainingMissing: string[]
  }
}
