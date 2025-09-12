import { v4 as uuid } from 'uuid'
import { ResumeJSON, TailoredResult, KeywordStats } from './types'

type Session = {
  id: string
  createdAt: number
  original: ResumeJSON
  tailored: TailoredResult
  jdText: string
  keywordStats: KeywordStats
}

const store = new Map<string, Session>()

export function createSession(original: ResumeJSON, tailored: TailoredResult, jdText: string, keywordStats: KeywordStats) {
  const id = uuid()
  const s: Session = { id, createdAt: Date.now(), original, tailored, jdText, keywordStats }
  store.set(id, s)
  return s
}

export function getSession(id:string) {
  const s = store.get(id)
  if (!s) return null
  if (Date.now() - s.createdAt > 60 * 60 * 1000) {
    store.delete(id)
    return null
  }
  return s
}
