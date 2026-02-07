import { NextRequest, NextResponse } from 'next/server'
import { db, users, usageLogs, creditTransactions } from '../../../../lib/db'
import { sql, desc, gte, eq, and } from 'drizzle-orm'
import { getCurrentUser, isUserAdmin } from '../../../../lib/auth/utils'

async function checkAdmin(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ code: 'unauthorized', message: 'Not authenticated' }, { status: 401 }) }
  }
  // Use cached user data instead of making another query
  if (!user.isAdmin) {
    return { ok: false, res: NextResponse.json({ code: 'forbidden', message: 'Admin access required' }, { status: 403 }) }
  }
  return { ok: true }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/stats - Get system statistics
export async function GET(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res

  try {
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Parallelize all independent queries for better performance
    const [
      [totalUsers],
      [adminUsers],
      [newUsers],
      [totalUsage],
      [periodUsage],
      [totalTokens],
      [periodTokens],
      [totalCreditsPurchased],
      [periodCreditsPurchased],
      [totalRevenue],
      [periodRevenue],
      [totalCreditsRemaining],
      [activeUsers],
      dailyUsage,
    ] = await Promise.all([
      // User queries
      db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isAdmin, false)),
      db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isAdmin, true)),
      db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.isAdmin, false), gte(users.createdAt, startDate))),
      // Usage queries
      db.select({ count: sql<number>`count(*)` }).from(usageLogs),
      db.select({ count: sql<number>`count(*)` }).from(usageLogs).where(gte(usageLogs.timestamp, startDate)),
      db.select({ total: sql<number>`coalesce(sum(${usageLogs.tokensUsed}), 0)` }).from(usageLogs),
      db.select({ total: sql<number>`coalesce(sum(${usageLogs.tokensUsed}), 0)` }).from(usageLogs).where(gte(usageLogs.timestamp, startDate)),
      // Revenue queries
      db.select({ total: sql<number>`coalesce(sum(${creditTransactions.creditsAdded}), 0)` }).from(creditTransactions),
      db.select({ total: sql<number>`coalesce(sum(${creditTransactions.creditsAdded}), 0)` }).from(creditTransactions).where(gte(creditTransactions.createdAt, startDate)),
      db.select({ total: sql<number>`coalesce(sum(${creditTransactions.amount}::numeric), 0)` }).from(creditTransactions),
      db.select({ total: sql<number>`coalesce(sum(${creditTransactions.amount}::numeric), 0)` }).from(creditTransactions).where(gte(creditTransactions.createdAt, startDate)),
      // Credits remaining
      db.select({ total: sql<number>`coalesce(sum(${users.creditsRemaining}), 0)` }).from(users).where(eq(users.isAdmin, false)),
      // Active users
      db
      .select({ count: sql<number>`count(distinct ${usageLogs.userId})` })
      .from(usageLogs)
      .innerJoin(users, eq(usageLogs.userId, users.id))
        .where(and(gte(usageLogs.timestamp, startDate), eq(users.isAdmin, false))),
      // Daily usage breakdown
      db
      .select({
        date: sql<string>`date(${usageLogs.timestamp})`,
        count: sql<number>`count(*)`,
        tokens: sql<number>`coalesce(sum(${usageLogs.tokensUsed}), 0)`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.timestamp, startDate))
      .groupBy(sql`date(${usageLogs.timestamp})`)
        .orderBy(sql`date(${usageLogs.timestamp})`),
    ])

    return NextResponse.json({
      overview: {
        totalUsers: Number(totalUsers.count),
        adminUsers: Number(adminUsers.count),
        newUsers: Number(newUsers.count),
        activeUsers: Number(activeUsers.count),
        totalCreditsRemaining: Number(totalCreditsRemaining.total),
      },
      usage: {
        total: Number(totalUsage.count),
        period: Number(periodUsage.count),
        totalTokens: Number(totalTokens.total),
        periodTokens: Number(periodTokens.total),
      },
      revenue: {
        totalCreditsPurchased: Number(totalCreditsPurchased.total),
        periodCreditsPurchased: Number(periodCreditsPurchased.total),
        totalRevenue: Number(totalRevenue.total),
        periodRevenue: Number(periodRevenue.total),
      },
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        count: Number(d.count),
        tokens: Number(d.tokens),
      })),
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
