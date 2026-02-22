/**
 * Redis-based rate limiting service
 * Implements sliding window rate limiting with Redis backend
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, isRedisAvailable, getRedisType } from './redis'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  error?: NextResponse
}

// Feature flag to use Redis (defaults to true if Redis is available)
const USE_REDIS = process.env.USE_REDIS_RATE_LIMIT !== 'false' && isRedisAvailable()

// In-memory fallback stores
const ipHits = new Map<string, number[]>()
const sidHits = new Map<string, number[]>()
const urlFetchIpHits = new Map<string, number[]>()
const urlFetchSidHits = new Map<string, number[]>()
const purchaseAttempts = new Map<string, { count: number; resetAt: number }>()

function now() {
  return Date.now()
}

function slide(arr: number[], windowMs: number) {
  const t = now()
  while (arr.length && (t - arr[0]) > windowMs) arr.shift()
}

function pushHit(map: Map<string, number[]>, key: string) {
  const arr = map.get(key) || []
  arr.push(now())
  map.set(key, arr)
  return arr
}

/**
 * Get rate limit key for Redis
 */
function getRateLimitKey(type: 'ip' | 'session' | 'purchase', identifier: string): string {
  return `ratelimit:${type}:${identifier}`
}

/**
 * Sliding window rate limit using Redis
 * Uses sorted set (ZSET) for efficient sliding window
 */
async function checkRedisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  if (!redis) {
    throw new Error('Redis not available')
  }

  const now = Date.now()
  const windowStart = now - windowMs

  // Use sorted set for sliding window
  const zsetKey = `${key}:zset`
  
  try {
    // For Upstash REST API, ZREMRANGEBYSCORE might not be available
    // Use a simpler approach: store timestamps in a list and clean up
    const redisType = getRedisType()
    
    if (redisType === 'upstash') {
      // Upstash REST API - use list-based approach
      const listKey = `${key}:list`
      const timestamps = await redis.get(listKey)
      let validTimestamps: number[] = []
      // #region agent log
      if (timestamps != null) {
        try {
          const parsed = JSON.parse(timestamps)
          fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rate-limiter.ts:checkRedisRateLimit',message:'Redis rate limit timestamps parsed',data:{key:listKey,rawType:typeof timestamps,parsedType:Array.isArray(parsed)?'array':typeof parsed,isArray:Array.isArray(parsed),parsedLength:Array.isArray(parsed)?parsed.length:undefined},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
        } catch (_) {}
      }
      // #endregion
      if (timestamps) {
        const parsed = JSON.parse(timestamps)
        validTimestamps = Array.isArray(parsed) ? parsed.filter((t: number) => typeof t === 'number' && t > windowStart) : []
      }
      
      // Add current request
      validTimestamps.push(now)
      
      // Store updated list
      await redis.setex(listKey, Math.ceil(windowMs / 1000), JSON.stringify(validTimestamps))
      
      const count = validTimestamps.length
      const remaining = Math.max(0, limit - count)
      const resetAt = now + windowMs

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          error: NextResponse.json(
            { code: 'rate_limit', message: 'Too many requests' },
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': String(limit),
                'X-RateLimit-Remaining': String(remaining),
                'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
                'Retry-After': String(Math.ceil((resetAt - now) / 1000)),
              },
            }
          ),
        }
      }

      return {
        allowed: true,
        remaining,
        resetAt,
      }
    } else {
      // Standard Redis - use sorted set
      // Remove old entries (outside the window)
      await redis.zremrangebyscore(zsetKey, 0, windowStart)
      
      // Add current request with timestamp as score
      await redis.zadd(zsetKey, now, `${now}-${Math.random().toString(36)}`)
      
      // Count requests in window
      const count = await redis.zcard(zsetKey)
      
      // Set expiration on the sorted set
      await redis.expire(zsetKey, Math.ceil(windowMs / 1000))

      const remaining = Math.max(0, limit - count)
      const resetAt = now + windowMs

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          error: NextResponse.json(
            { code: 'rate_limit', message: 'Too many requests' },
            {
              status: 429,
              headers: {
                'X-RateLimit-Limit': String(limit),
                'X-RateLimit-Remaining': String(remaining),
                'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
                'Retry-After': String(Math.ceil((resetAt - now) / 1000)),
              },
            }
          ),
        }
      }

      return {
        allowed: true,
        remaining,
        resetAt,
      }
    }
  } catch (error) {
    console.error('Redis rate limit check error:', error)
    throw error
  }
}

/**
 * Check rate limit for IP and session (main guard)
 */
export async function checkRateLimit(
  ip: string,
  sessionId: string,
  ipLimit: number,
  sessionLimit: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        // Check IP limit
        const ipKey = getRateLimitKey('ip', ip)
        const ipResult = await checkRedisRateLimit(ipKey, ipLimit, windowMs)
        if (!ipResult.allowed) {
          return ipResult
        }

        // Check session limit
        const sessionKey = getRateLimitKey('session', sessionId)
        const sessionResult = await checkRedisRateLimit(sessionKey, sessionLimit, windowMs)
        if (!sessionResult.allowed) {
          return sessionResult
        }

        // Both passed
        return {
          allowed: true,
          remaining: Math.min(ipResult.remaining, sessionResult.remaining),
          resetAt: Math.min(ipResult.resetAt, sessionResult.resetAt),
        }
      } catch (error) {
        console.error('Redis rate limit check failed, falling back to memory:', error)
        // Fall through to in-memory
      }
    }
  }

  // In-memory fallback
  const ipArr = pushHit(ipHits, ip)
  const sidArr = pushHit(sidHits, sessionId)
  slide(ipArr, windowMs)
  slide(sidArr, windowMs)

  if (ipArr.length > ipLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now() + windowMs,
      error: NextResponse.json({ code: 'rate_limit', message: 'Too many requests' }, { status: 429 }),
    }
  }

  if (sidArr.length > sessionLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now() + windowMs,
      error: NextResponse.json({ code: 'rate_limit', message: 'Too many requests' }, { status: 429 }),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, ipLimit - ipArr.length),
    resetAt: now() + windowMs,
  }
}

/**
 * Check rate limit for URL fetching (more restrictive)
 */
export async function checkUrlFetchRateLimit(
  ip: string,
  sessionId: string,
  ipLimit: number = 10,
  sessionLimit: number = 5,
  windowMs: number = 3600_000 // 1 hour
): Promise<RateLimitResult> {
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const ipKey = getRateLimitKey('ip', `urlfetch:${ip}`)
        const ipResult = await checkRedisRateLimit(ipKey, ipLimit, windowMs)
        if (!ipResult.allowed) {
          return {
            ...ipResult,
            error: NextResponse.json(
              { code: 'rate_limit', message: 'Too many URL fetch requests. Please wait before trying again.' },
              { status: 429 }
            ),
          }
        }

        const sessionKey = getRateLimitKey('session', `urlfetch:${sessionId}`)
        const sessionResult = await checkRedisRateLimit(sessionKey, sessionLimit, windowMs)
        if (!sessionResult.allowed) {
          return {
            ...sessionResult,
            error: NextResponse.json(
              { code: 'rate_limit', message: 'Too many URL fetch requests. Please wait before trying again.' },
              { status: 429 }
            ),
          }
        }

        return {
          allowed: true,
          remaining: Math.min(ipResult.remaining, sessionResult.remaining),
          resetAt: Math.min(ipResult.resetAt, sessionResult.resetAt),
        }
      } catch (error) {
        console.error('Redis URL fetch rate limit check failed, falling back to memory:', error)
        // Fall through to in-memory
      }
    }
  }

  // In-memory fallback
  const ipArr = pushHit(urlFetchIpHits, ip)
  const sidArr = pushHit(urlFetchSidHits, sessionId)
  slide(ipArr, windowMs)
  slide(sidArr, windowMs)

  if (ipArr.length > ipLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now() + windowMs,
      error: NextResponse.json(
        { code: 'rate_limit', message: 'Too many URL fetch requests. Please wait before trying again.' },
        { status: 429 }
      ),
    }
  }

  if (sidArr.length > sessionLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: now() + windowMs,
      error: NextResponse.json(
        { code: 'rate_limit', message: 'Too many URL fetch requests. Please wait before trying again.' },
        { status: 429 }
      ),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, ipLimit - ipArr.length),
    resetAt: now() + windowMs,
  }
}

/**
 * Check purchase rate limit for a user
 */
export async function checkPurchaseRateLimit(
  userId: string,
  limit: number = 5,
  windowMs: number = 60_000 // 1 minute
): Promise<RateLimitResult> {
  if (USE_REDIS) {
    const redis = getRedisClient()
    if (redis) {
      try {
        const key = getRateLimitKey('purchase', userId)
        return await checkRedisRateLimit(key, limit, windowMs)
      } catch (error) {
        console.error('Redis purchase rate limit check failed, falling back to memory:', error)
        // Fall through to in-memory
      }
    }
  }

  // In-memory fallback
  const now = Date.now()
  const userAttempts = purchaseAttempts.get(userId)

  if (!userAttempts || now > userAttempts.resetAt) {
    purchaseAttempts.set(userId, { count: 1, resetAt: now + windowMs })
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    }
  }

  if (userAttempts.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: userAttempts.resetAt,
      error: NextResponse.json(
        {
          code: 'rate_limit_exceeded',
          message: 'Too many purchase attempts. Please try again later.',
        },
        { status: 429 }
      ),
    }
  }

  userAttempts.count++
  return {
    allowed: true,
    remaining: limit - userAttempts.count,
    resetAt: userAttempts.resetAt,
  }
}

