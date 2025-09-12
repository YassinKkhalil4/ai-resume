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
  projects?: Array<{ name:string, bullets:string[] }>
}

// Re-export the schema-based type to maintain compatibility
export type { TailoredResultType as TailoredResult } from './schemas'

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
}
