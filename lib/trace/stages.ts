// Stage constants for tailor run events
export const RESUME_PARSE = 'resume_parse'
export const JD_ANALYSIS = 'jd_analysis'
export const KEYWORD_ENGINE = 'keyword_engine'
export const KEYWORD_DECISIONS = 'keyword_decisions'
export const PROMPT_BUILD = 'prompt_build'
export const MODEL_CALL = 'model_call'
export const RESUME_DIFF = 'resume_diff'
export const ATS_SCORING = 'ats_scoring'
export const HONESTY_CHECK = 'honesty_check'
export const PRESENTATION_GUARD = 'presentation_guard'
export const SOFT_FIX = 'soft_fix'

export const ALL_STAGES = [
  RESUME_PARSE,
  JD_ANALYSIS,
  KEYWORD_ENGINE,
  KEYWORD_DECISIONS,
  PROMPT_BUILD,
  MODEL_CALL,
  RESUME_DIFF,
  ATS_SCORING,
  HONESTY_CHECK,
  PRESENTATION_GUARD,
  SOFT_FIX,
] as const

export type Stage = typeof ALL_STAGES[number]

// Payload interfaces for each stage
export interface ResumeParsePayload {
  file_type: string
  extraction_method: string
  char_count: number
  sections_detected: string[]
  roles_parsed: number
  bullets_parsed: number
  parse_confidence: number
  warnings: string[]
}

export interface JdAnalysisPayload {
  jd_length: number
  role_title_detected?: string
  industry_primary?: string
  industry_secondary?: string
  industry_confidence?: Record<string, number>
  signals: string[]
}

export interface KeywordEnginePayload {
  raw_keywords: string[]
  normalized_keywords: string[]
  classification: {
    must_have: string[]
    nice_to_have: string[]
    industry: string[]
  }
  source_weights: {
    role_based: number
    firm_based: number
  }
}

export interface KeywordDecisionPayload {
  keyword: string
  source: string
  role_relevance_score: number
  inclusion_decision: 'included' | 'excluded'
  insertion_location?: string
  justification: string
  confidence: number
}

export interface PromptBuildPayload {
  prompt_version: string
  constraints: string[]
  keywords_passed: string[]
  blocked_keywords: string[]
  tone: string
}

export interface ModelCallPayload {
  model: string
  latency_ms: number
  tokens_in: number
  tokens_out: number
  response_valid: boolean
}

export interface ResumeDiffPayload {
  original: string
  tailored: string
  change_type: 'rewrite' | 'add' | 'remove' | 'merge'
  keywords_added: string[]
  keywords_removed: string[]
  semantic_similarity: number
}

export interface AtsScoringPayload {
  before: number
  after: number
  matched_new: string[]
  still_missing: string[]
  regressions: string[]
}

export interface HonestyCheckPayload {
  threshold: number
  flagged_bullets: Array<{
    role: string
    bullet: string
    score: number
    reason: string
  }>
  safe_expansions_used: string[]
  blocked_claims: string[]
}

export interface PresentationGuardPayload {
  naked_keywords_detected: boolean
  violations: string[]
  keywords: string[]
  auto_fix_applied: boolean
}

export interface SoftFixPayload {
  fix_type: 'title_preservation' | 'keyword_stuffing' | 'abbreviation_expansion' | 'keyword_list_conversion'
  confidence?: number
  fixes_applied: number
  issues?: string[]
  issues_fixed?: string[]
  requires_retry?: boolean
}

// Type guard to validate stage names
export function isValidStage(stage: string): stage is Stage {
  return ALL_STAGES.includes(stage as Stage)
}

