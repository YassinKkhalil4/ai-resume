export type Tone = 'professional' | 'concise' | 'impact-heavy'

/** Canonical form for tailoring: each bullet has a stable ID for rewrite-in-place. */
export type BulletWithId = { id: string; text: string }

/** Section/reason this experience came from. Used to block auto-tailoring of heuristic content (AI hallucination prevention). user_confirmed = explicitly confirmed by user in Confirm Experience flow. */
export type ExperienceSource = 'explicit' | 'heuristic' | 'user_provided' | 'user_confirmed'

export type Role = {
  company?: string
  role?: string
  dates?: string
  /** Legacy/parsed: string[]. After ID assignment (tailor flow only): BulletWithId[]. */
  bullets?: string[] | BulletWithId[]
  /** If false, role must not be eligible for tailoring (AI hallucination prevention: no bullets = no rewrite). */
  hasBullets?: boolean
  /** Source of this role; heuristic/user_provided require confirmation and must not be auto-tailored. */
  source?: ExperienceSource
}

export type ResumeJSON = {
  contact?: Record<string, string>
  summary?: string
  skills?: string[]
  experience?: Role[]
  /** How experience section was obtained; heuristic triggers needsConfirmation and must not be auto-tailored (AI hallucination prevention). */
  experienceSource?: ExperienceSource
  /** True after user explicitly confirms experience in the Confirm Experience flow; allows tailoring to proceed. */
  userConfirmedExperience?: boolean
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
