/**
 * Redis client wrapper with support for both standard Redis and Upstash
 * Handles connection pooling, error handling, and graceful fallback
 */

import type { Redis as UpstashClient } from '@upstash/redis'

let _redisClient: any = null
let _redisType: 'standard' | 'upstash' | null = null
let _testClient: RedisClient | null = null

/** Test seam: route all Redis access to an in-memory fake. Pass null to restore env-based resolution. */
export function setRedisClientForTesting(client: RedisClient | null): void {
  _testClient = client
}

export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, expiryMode?: string, expiryTime?: number): Promise<string | null>
  del(key: string): Promise<number>
  exists(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  setex(key: string, seconds: number, value: string): Promise<string | null>
  incr(key: string): Promise<number>
  decr(key: string): Promise<number>
  keys(pattern: string): Promise<string[]>
  ttl(key: string): Promise<number>
  lpush(key: string, ...values: string[]): Promise<number>
  rpop(key: string): Promise<string | null>
  zadd(key: string, score: number, member: string): Promise<number>
  zcard(key: string): Promise<number>
  zremrangebyscore(key: string, min: number, max: number): Promise<number>
}

/**
 * Get Redis client instance (singleton)
 * Supports both standard Redis (ioredis) and Upstash Redis
 */
export function getRedisClient(): RedisClient | null {
  if (_testClient) return _testClient

  // Skip Redis initialization during build
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build') {
    return null
  }

  // Feature flag to disable Redis
  if (process.env.USE_REDIS_SESSIONS === 'false' && 
      process.env.USE_REDIS_RATE_LIMIT === 'false' && 
      process.env.USE_AI_QUEUE === 'false') {
    return null
  }

  if (_redisClient) {
    return _redisClient
  }

  // Try Upstash first (serverless-friendly)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = require('@upstash/redis')
      _redisClient = createUpstashAdapter(
        new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
          automaticDeserialization: false,
        })
      )
      _redisType = 'upstash'
      console.log('Redis client initialized (Upstash)')
      return _redisClient
    } catch (error) {
      console.warn('Failed to initialize Upstash Redis:', error)
    }
  }

  // Fallback to standard Redis
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis')
      _redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        },
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY'
          if (err.message.includes(targetError)) {
            return true
          }
          return false
        },
      })
      _redisType = 'standard'
      console.log('Redis client initialized (standard)')
      return _redisClient
    } catch (error) {
      console.warn('Failed to initialize standard Redis:', error)
    }
  }

  console.warn('Redis not configured - falling back to in-memory storage')
  return null
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  const client = getRedisClient()
  return client !== null
}

/**
 * Get Redis connection type
 */
export function getRedisType(): 'standard' | 'upstash' | null {
  return _redisType
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) {
    return false
  }

  try {
    await client.set('__test__', 'ok', 'EX', 1)
    const result = await client.get('__test__')
    return result === 'ok'
  } catch (error) {
    console.error('Redis connection test failed:', error)
    return false
  }
}


/**
 * Wraps an @upstash/redis client in the ioredis-style surface the rest of the app uses.
 *
 * Upstash differs from ioredis in ways that silently break callers:
 *  - zadd takes `{ score, member }`, not `(score, member)` (the number form throws a TypeError)
 *  - set takes `{ ex }`, not `'EX', seconds` (the string form throws a TypeError)
 *  - get auto-parses JSON strings into objects, so `JSON.parse(await get(k))` throws
 * Normalising here keeps every call site client-agnostic.
 */
export function createUpstashAdapter(client: UpstashClient): RedisClient {
  return {
    async get(key) {
      const value = await client.get<unknown>(key)
      if (value === null || value === undefined) return null
      return typeof value === 'string' ? value : JSON.stringify(value)
    },
    async set(key, value, expiryMode, expiryTime) {
      const result =
        expiryMode === 'EX' && expiryTime ? await client.set(key, value, { ex: expiryTime }) : await client.set(key, value)
      return result as string | null
    },
    del: (key) => client.del(key),
    exists: (key) => client.exists(key),
    expire: (key, seconds) => client.expire(key, seconds),
    async setex(key, seconds, value) {
      return (await client.setex(key, seconds, value)) as string | null
    },
    incr: (key) => client.incr(key),
    decr: (key) => client.decr(key),
    keys: (pattern) => client.keys(pattern),
    ttl: (key) => client.ttl(key),
    lpush: (key, ...values) => client.lpush(key, ...values),
    async rpop(key) {
      const value = await client.rpop<unknown>(key)
      if (value === null || value === undefined) return null
      return typeof value === 'string' ? value : JSON.stringify(value)
    },
    async zadd(key, score, member) {
      return (await client.zadd(key, { score, member })) ?? 0
    },
    zcard: (key) => client.zcard(key),
    zremrangebyscore: (key, min, max) => client.zremrangebyscore(key, min, max),
  }
}
