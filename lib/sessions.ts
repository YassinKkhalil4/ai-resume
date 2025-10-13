import { v4 as uuid } from 'uuid'
import { ResumeJSON, TailoredResult, KeywordStatsComparison } from './types'

type Session = {
  id: string
  version: string
  createdAt: number
  original: ResumeJSON
  tailored: TailoredResult
  jdText: string
  keywordStats: KeywordStatsComparison
  originalRawText?: string
}

const store = new Map<string, Session>()

function purgeExpired(ttlMs = 60 * 60 * 1000) {
  const now = Date.now()
  for (const [id, s] of store) {
    if (now - s.createdAt > ttlMs) store.delete(id)
  }
}

export function createSession(
  original: ResumeJSON, 
  tailored: TailoredResult, 
  jdText: string, 
  keywordStats: KeywordStatsComparison,
  originalRawText?: string
) {
  purgeExpired()
  const id = uuid()
  const version = generateSessionVersion(original, tailored)
  const s: Session = { id, version, createdAt: Date.now(), original, tailored, jdText, keywordStats, originalRawText }
  store.set(id, s)
  return s
}

export function getSession(id: string) {
  purgeExpired()
  const s = store.get(id)
  if (!s) return null
  if (Date.now() - s.createdAt > 60 * 60 * 1000) {
    store.delete(id)
    return null
  }
  return s
}

export function updateSession(id: string, updates: Partial<Session>) {
  const s = store.get(id)
  if (!s) return null
  
  const updated = { ...s, ...updates }
  if (updates.original || updates.tailored) {
    updated.version = generateSessionVersion(updated.original, updated.tailored)
  }
  
  store.set(id, updated)
  return updated
}

export function deleteSession(id: string) {
  return store.delete(id)
}

export function getSessionVersion(id: string): string | null {
  const s = getSession(id)
  return s ? s.version : null
}

function generateSessionVersion(original: ResumeJSON, tailored: TailoredResult): string {
  // Create a hash of the content to detect changes
  const content = JSON.stringify({ original, tailored })
  // Use Buffer.from() to handle Unicode characters properly
  return Buffer.from(content, 'utf8').toString('base64').slice(0, 16) // Simple hash, first 16 chars
}

export function validateSessionVersion(id: string, providedVersion: string): boolean {
  const currentVersion = getSessionVersion(id)
  return currentVersion === providedVersion
}
