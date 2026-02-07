import { v4 as uuid } from 'uuid'
import { ResumeJSON, TailoredResult, KeywordStatsComparison } from './types'
import { getRedisClient, isRedisAvailable } from './redis'

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

// In-memory fallback store (used when Redis is not available)
const store = new Map<string, Session>()

// Session TTL in seconds (60 minutes)
const SESSION_TTL = 60 * 60

// Feature flag to use Redis (defaults to true if Redis is available)
const USE_REDIS = process.env.USE_REDIS_SESSIONS !== 'false' && isRedisAvailable()

function purgeExpired(ttlMs = 60 * 60 * 1000) {
  const now = Date.now()
  for (const [id, s] of store) {
    if (now - s.createdAt > ttlMs) store.delete(id)
  }
}

/**
 * Get session key for Redis
 */
function getSessionKey(id: string): string {
  return `session:${id}`
}

export async function createSession(
  original: ResumeJSON, 
  tailored: TailoredResult, 
  jdText: string, 
  keywordStats: KeywordStatsComparison,
  originalRawText?: string
): Promise<Session> {
  const id = uuid()
  const version = generateSessionVersion(original, tailored)
  const s: Session = { id, version, createdAt: Date.now(), original, tailored, jdText, keywordStats, originalRawText }
  
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const key = getSessionKey(id)
        await redis.setex(key, SESSION_TTL, JSON.stringify(s))
        return s
      } catch (error) {
        console.error('Failed to create session in Redis, falling back to memory:', error)
        // Fall through to in-memory storage
      }
    }
  }
  
  // In-memory fallback
  purgeExpired()
  store.set(id, s)
  return s
}

export async function getSession(id: string): Promise<Session | null> {
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const key = getSessionKey(id)
        const data = await redis.get(key)
        if (!data) return null
        
        const s: Session = JSON.parse(data)
        // Check if expired (Redis TTL handles this, but double-check)
        if (Date.now() - s.createdAt > SESSION_TTL * 1000) {
          await deleteSession(id)
          return null
        }
        return s
      } catch (error) {
        console.error('Failed to get session from Redis, falling back to memory:', error)
        // Fall through to in-memory storage
      }
    }
  }
  
  // In-memory fallback
  purgeExpired()
  const s = store.get(id)
  if (!s) return null
  if (Date.now() - s.createdAt > SESSION_TTL * 1000) {
    store.delete(id)
    return null
  }
  return s
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session | null> {
  // Get existing session
  const s = await getSession(id)
  if (!s) return null
  
  const updated = { ...s, ...updates }
  if (updates.original || updates.tailored) {
    updated.version = generateSessionVersion(updated.original, updated.tailored)
  }
  
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const key = getSessionKey(id)
        // Get remaining TTL to preserve expiration
        const ttl = await redis.ttl(key)
        const expiry = ttl > 0 ? ttl : SESSION_TTL
        await redis.setex(key, expiry, JSON.stringify(updated))
        return updated
      } catch (error) {
        console.error('Failed to update session in Redis, falling back to memory:', error)
        // Fall through to in-memory storage
      }
    }
  }
  
  // In-memory fallback
  store.set(id, updated)
  return updated
}

export async function deleteSession(id: string): Promise<boolean> {
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const key = getSessionKey(id)
        const result = await redis.del(key)
        return result > 0
      } catch (error) {
        console.error('Failed to delete session from Redis, falling back to memory:', error)
        // Fall through to in-memory storage
      }
    }
  }
  
  // In-memory fallback
  return store.delete(id)
}

export async function getSessionVersion(id: string): Promise<string | null> {
  const s = await getSession(id)
  return s ? s.version : null
}

function generateSessionVersion(original: ResumeJSON, tailored: TailoredResult): string {
  // Create a hash of the content to detect changes
  const content = JSON.stringify({ original, tailored })
  // Use Buffer.from() to handle Unicode characters properly
  return Buffer.from(content, 'utf8').toString('base64').slice(0, 16) // Simple hash, first 16 chars
}

export async function validateSessionVersion(id: string, providedVersion: string): Promise<boolean> {
  const currentVersion = await getSessionVersion(id)
  return currentVersion === providedVersion
}
