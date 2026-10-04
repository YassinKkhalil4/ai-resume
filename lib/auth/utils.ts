import { getServerSession } from 'next-auth'
import { authOptions } from './config'
import { db, users, creditLots } from '../db'
import { and, eq, gt, sql } from 'drizzle-orm'
import { TtlCache } from '../ttl-cache'

// Cache user lookups for a second to avoid duplicate queries within one request burst
const userCache = new TtlCache<any>(1000, 500)

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  // Check cache first
  const cached = userCache.get(session.user.id)
  if (cached) {
    return cached
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })

  // Cache the result
  if (user) {
    userCache.set(session.user.id, user)
  }

  return user
}

export async function getUserCredits(userId: string): Promise<number> {
  const now = new Date()

  // Sum active (non-expired) credits from credit_lots for this user
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${creditLots.creditsRemaining}), 0)::int`,
    })
    .from(creditLots)
    .where(
      and(
        eq(creditLots.userId, userId),
        gt(creditLots.expiresAt, now),
        gt(creditLots.creditsRemaining, 0),
      ),
    )

  const totalFromLots = rows[0]?.total ?? 0
  return totalFromLots
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  // Check cache first - if we already have the user, use it
  const cached = userCache.get(userId)
  if (cached) {
    return cached.isAdmin || false
  }
  
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })
  
  // Cache the result
  if (user) {
    userCache.set(userId, user)
  }
  
  return user?.isAdmin || false
}

export async function isUserAdminByEmail(email: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })
  return user?.isAdmin || false
}

