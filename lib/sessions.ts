import { v4 as uuid } from 'uuid'
import { ResumeJSON, TailoredResult, KeywordStatsComparison } from './types'
import { getRedisClient } from './redis'
import { NextResponse } from 'next/server'

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

// Session TTL: 60 minutes
const SESSION_TTL = 60 * 60

function getSessionKey(id: string): string {
  return `session:${id}`
}

/**
 * Require a working Redis client or throw a 503-ready error.
 * Callers in API routes should catch RedisUnavailableError and return a 503.
 */
export class RedisUnavailableError extends Error {
  readonly statusResponse: ReturnType<typeof NextResponse.json>
  constructor() {
    super('Redis is not available — cannot persist session state')
    this.name = 'RedisUnavailableError'
    this.statusResponse = NextResponse.json(
      { code: 'service_unavailable', message: 'Session storage is temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    )
  }
}

function requireRedis() {
  const redis = getRedisClient()
  if (!redis) throw new RedisUnavailableError()
  return redis
}

function generateSessionVersion(original: ResumeJSON, tailored: TailoredResult): string {
  const content = JSON.stringify({ original, tailored })
  return Buffer.from(content, 'utf8').toString('base64').slice(0, 16)
}

export async function createSession(
  original: ResumeJSON,
  tailored: TailoredResult,
  jdText: string,
  keywordStats: KeywordStatsComparison,
  originalRawText?: string
): Promise<Session> {
  const redis = requireRedis()
  const id = uuid()
  const version = generateSessionVersion(original, tailored)
  const s: Session = { id, version, createdAt: Date.now(), original, tailored, jdText, keywordStats, originalRawText }
  await redis.setex(getSessionKey(id), SESSION_TTL, JSON.stringify(s))
  return s
}

export async function getSession(id: string): Promise<Session | null> {
  const redis = requireRedis()
  const data = await redis.get(getSessionKey(id))
  if (!data) return null
  const s: Session = JSON.parse(data)
  // Belt-and-suspenders TTL check (Redis expiry handles it, but safeguard against clock drift)
  if (Date.now() - s.createdAt > SESSION_TTL * 1000) {
    await deleteSession(id)
    return null
  }
  return s
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
  const redis = requireRedis()
  const s = await getSession(id)
  if (!s) return null

  const updated = { ...s, ...updates }
  if (updates.original || updates.tailored) {
    updated.version = generateSessionVersion(updated.original, updated.tailored)
  }

  const key = getSessionKey(id)
  const ttl = await redis.ttl(key)
  const expiry = ttl > 0 ? ttl : SESSION_TTL
  await redis.setex(key, expiry, JSON.stringify(updated))
  return updated
}

export async function deleteSession(id: string): Promise<boolean> {
  const redis = requireRedis()
  const result = await redis.del(getSessionKey(id))
  return result > 0
}

export async function getSessionVersion(id: string): Promise<string | null> {
  const s = await getSession(id)
  return s ? s.version : null
}

export async function validateSessionVersion(id: string, providedVersion: string): Promise<boolean> {
  const currentVersion = await getSessionVersion(id)
  return currentVersion === providedVersion
}
