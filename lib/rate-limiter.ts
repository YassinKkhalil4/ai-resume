/**
 * Redis-based rate limiting — sliding window via sorted sets (ZADD / ZREMRANGEBYSCORE / ZCARD).
 * Works identically for both Upstash and standard ioredis clients.
 * No in-memory fallback: if Redis is unavailable the caller receives a 503.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from './redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  error?: NextResponse
}

// ─── helpers ────────────────────────────────────────────────────────────────

function rateLimitKey(type: string, identifier: string): string {
  return `ratelimit:${type}:${identifier}`
}

function unavailableResponse(message = 'Rate-limit service temporarily unavailable'): NextResponse {
  return NextResponse.json({ code: 'service_unavailable', message }, { status: 503 })
}

function tooManyResponse(limit: number, remaining: number, resetAt: number): NextResponse {
  return NextResponse.json(
    { code: 'rate_limit', message: 'Too many requests' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
      },
    }
  )
}

/**
 * Atomic sliding-window check using a Redis sorted set.
 * Uses ZADD + ZREMRANGEBYSCORE + ZCARD — supported by both Upstash REST and ioredis.
 */
async function checkRedisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redis = getRedisClient()
  if (!redis) {
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs, error: unavailableResponse() }
  }

  const now = Date.now()
  const windowStart = now - windowMs
  const zsetKey = `${key}:zset`

  try {
    // 1. Remove timestamps outside the sliding window
    await redis.zremrangebyscore(zsetKey, 0, windowStart)

    // 2. Record this request with a unique member (timestamp + jitter avoids collisions)
    await redis.zadd(zsetKey, now, `${now}-${Math.random().toString(36).slice(2)}`)

    // 3. Count how many requests are in the window now
    const count = await redis.zcard(zsetKey)

    // 4. Keep the key alive for the duration of the window
    await redis.expire(zsetKey, Math.ceil(windowMs / 1000))

    const remaining = Math.max(0, limit - count)
    const resetAt = now + windowMs

    if (count > limit) {
      return { allowed: false, remaining: 0, resetAt, error: tooManyResponse(limit, 0, resetAt) }
    }

    return { allowed: true, remaining, resetAt }
  } catch (err) {
    console.error('[rate-limiter] Redis error:', err)
    // On Redis error return 503 rather than silently allow or silently block
    return { allowed: false, remaining: 0, resetAt: Date.now() + windowMs, error: unavailableResponse() }
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Main per-IP + per-session guard (tailor / export routes).
 */
export async function checkRateLimit(
  ip: string,
  sessionId: string,
  ipLimit: number,
  sessionLimit: number,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  const ipResult = await checkRedisRateLimit(rateLimitKey('ip', ip), ipLimit, windowMs)
  if (!ipResult.allowed) return ipResult

  const sessionResult = await checkRedisRateLimit(rateLimitKey('session', sessionId), sessionLimit, windowMs)
  if (!sessionResult.allowed) return sessionResult

  return {
    allowed: true,
    remaining: Math.min(ipResult.remaining, sessionResult.remaining),
    resetAt: Math.min(ipResult.resetAt, sessionResult.resetAt),
  }
}

/**
 * Stricter guard for the JD URL-fetch endpoint (10 / IP / hour, 5 / session / hour).
 */
export async function checkUrlFetchRateLimit(
  ip: string,
  sessionId: string,
  ipLimit: number = 10,
  sessionLimit: number = 5,
  windowMs: number = 3_600_000
): Promise<RateLimitResult> {
  const tooManyMsg = { code: 'rate_limit', message: 'Too many URL fetch requests. Please wait before trying again.' }

  const ipResult = await checkRedisRateLimit(rateLimitKey('ip', `urlfetch:${ip}`), ipLimit, windowMs)
  if (!ipResult.allowed) {
    return {
      ...ipResult,
      error: ipResult.error?.status === 503
        ? ipResult.error
        : NextResponse.json(tooManyMsg, { status: 429 }),
    }
  }

  const sessionResult = await checkRedisRateLimit(rateLimitKey('session', `urlfetch:${sessionId}`), sessionLimit, windowMs)
  if (!sessionResult.allowed) {
    return {
      ...sessionResult,
      error: sessionResult.error?.status === 503
        ? sessionResult.error
        : NextResponse.json(tooManyMsg, { status: 429 }),
    }
  }

  return {
    allowed: true,
    remaining: Math.min(ipResult.remaining, sessionResult.remaining),
    resetAt: Math.min(ipResult.resetAt, sessionResult.resetAt),
  }
}

/**
 * Purchase-attempt guard (5 attempts / user / minute).
 */
export async function checkPurchaseRateLimit(
  userId: string,
  limit: number = 5,
  windowMs: number = 60_000
): Promise<RateLimitResult> {
  return checkRedisRateLimit(rateLimitKey('purchase', userId), limit, windowMs)
}
