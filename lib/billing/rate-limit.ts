import { NextRequest, NextResponse } from 'next/server'
import { checkPurchaseRateLimit as checkPurchaseRateLimitRedis } from '../rate-limiter'

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_PURCHASE_ATTEMPTS = 5 // Max 5 purchase attempts per minute

/**
 * Check rate limit for credit purchases
 * Uses Redis if available, falls back to in-memory storage
 */
export async function checkPurchaseRateLimit(userId: string): Promise<{
  allowed: boolean
  error?: NextResponse
}> {
  const result = await checkPurchaseRateLimitRedis(userId, MAX_PURCHASE_ATTEMPTS, RATE_LIMIT_WINDOW)
  
  return {
    allowed: result.allowed,
    error: result.error,
  }
}

