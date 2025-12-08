import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter for credit purchases
// In production, use Redis or similar
const purchaseAttempts = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_PURCHASE_ATTEMPTS = 5 // Max 5 purchase attempts per minute

export function checkPurchaseRateLimit(userId: string): {
  allowed: boolean
  error?: NextResponse
} {
  const now = Date.now()
  const userAttempts = purchaseAttempts.get(userId)

  if (!userAttempts || now > userAttempts.resetAt) {
    purchaseAttempts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true }
  }

  if (userAttempts.count >= MAX_PURCHASE_ATTEMPTS) {
    return {
      allowed: false,
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
  return { allowed: true }
}

