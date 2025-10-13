import { ResumeJSON, TailoredResult, KeywordStatsComparison } from './types'

export interface SessionData {
  session_id: string
  version: string
  original_sections_json: ResumeJSON
  original_raw_text?: string
  preview_sections_json: TailoredResult
  keyword_stats: KeywordStatsComparison
  tokens_used?: number
}

export function createSessionPayload(sessionData: SessionData) {
  return {
    session_id: sessionData.session_id,
    session_version: sessionData.version,
    original_payload: sessionData.original_sections_json,
    tailored_payload: sessionData.preview_sections_json
  }
}

export function validateSessionData(sessionData: any): sessionData is SessionData {
  return !!(
    sessionData.session_id &&
    sessionData.version &&
    sessionData.original_sections_json &&
    sessionData.preview_sections_json
  )
}

export function isStaleSession(currentVersion: string, providedVersion: string): boolean {
  return currentVersion !== providedVersion
}

export function createStaleSessionResponse(currentVersion: string, providedVersion: string) {
  return {
    code: 'stale_session',
    message: 'Session data is outdated. Please refresh the page and try again.',
    session_version: currentVersion,
    provided_version: providedVersion,
    action_required: 'refresh_page'
  }
}
