import { db, analyticsEvents, tailoringRuns, users, creditTransactions, analyticsDailyRollups, universityMetrics } from '../db'
import { sql, gte, eq, and } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'

/**
 * Aggregates daily metrics and stores them in analytics_daily_rollups
 * Should be run daily via cron or scheduled function
 */
export async function aggregateDailyMetrics(date: Date = new Date()): Promise<void> {
  try {
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Calculate DAU (distinct users with events on this date)
    const [dauResult] = await db
      .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, targetDate),
          sql`${analyticsEvents.timestamp} < ${nextDay}`,
          sql`${analyticsEvents.userId} IS NOT NULL`
        )
      )

    const dau = Number(dauResult?.count || 0)

    // Calculate WAU (distinct users with events in last 7 days)
    const oneWeekAgo = new Date(targetDate)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const [wauResult] = await db
      .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, oneWeekAgo),
          sql`${analyticsEvents.timestamp} < ${nextDay}`,
          sql`${analyticsEvents.userId} IS NOT NULL`
        )
      )

    const wau = Number(wauResult?.count || 0)

    // Calculate MAU (distinct users with events in last 30 days)
    const oneMonthAgo = new Date(targetDate)
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)
    const [mauResult] = await db
      .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, oneMonthAgo),
          sql`${analyticsEvents.timestamp} < ${nextDay}`,
          sql`${analyticsEvents.userId} IS NOT NULL`
        )
      )

    const mau = Number(mauResult?.count || 0)

    // Total tailoring runs on this date
    const [runsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tailoringRuns)
      .where(
        and(
          gte(tailoringRuns.createdAt, targetDate),
          sql`${tailoringRuns.createdAt} < ${nextDay}`
        )
      )

    const totalTailoringRuns = Number(runsResult?.count || 0)

    // Average ATS improvement on this date
    const [avgResult] = await db
      .select({ avg: sql<number>`coalesce(avg(${tailoringRuns.atsDelta}::numeric), 0)` })
      .from(tailoringRuns)
      .where(
        and(
          gte(tailoringRuns.createdAt, targetDate),
          sql`${tailoringRuns.createdAt} < ${nextDay}`
        )
      )

    const avgAtsImprovement = avgResult?.avg ? Number(avgResult.avg) : null

    // Revenue on this date
    const [revenueResult] = await db
      .select({ total: sql<number>`coalesce(sum(${creditTransactions.amount}::numeric), 0)` })
      .from(creditTransactions)
      .where(
        and(
          gte(creditTransactions.createdAt, targetDate),
          sql`${creditTransactions.createdAt} < ${nextDay}`
        )
      )

    const revenue = Number(revenueResult?.total || 0)

    // New users on this date
    const [newUsersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          gte(users.createdAt, targetDate),
          sql`${users.createdAt} < ${nextDay}`,
          eq(users.isAdmin, false)
        )
      )

    const newUsers = Number(newUsersResult?.count || 0)

    // Active users (users who used the product on this date)
    const [activeUsersResult] = await db
      .select({ count: sql<number>`count(distinct ${tailoringRuns.userId})` })
      .from(tailoringRuns)
      .where(
        and(
          gte(tailoringRuns.createdAt, targetDate),
          sql`${tailoringRuns.createdAt} < ${nextDay}`
        )
      )

    const activeUsers = Number(activeUsersResult?.count || 0)

    // Calculate conversion rate (signups → first tailor on this date)
    const [signupsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.eventName, 'signup_completed'),
          gte(analyticsEvents.timestamp, targetDate),
          sql`${analyticsEvents.timestamp} < ${nextDay}`
        )
      )

    const signups = Number(signupsResult?.count || 0)
    const conversionRate = signups > 0 ? activeUsers / signups : null

    // Upsert daily rollup
    const dateStr = targetDate.toISOString().split('T')[0] // YYYY-MM-DD format

    // Check if rollup exists
    const existing = await db.query.analyticsDailyRollups.findFirst({
      where: eq(analyticsDailyRollups.date, dateStr),
    })

    if (existing) {
      // Update existing
      await db
        .update(analyticsDailyRollups)
        .set({
          dau,
          wau,
          mau,
          totalTailoringRuns,
          avgAtsImprovement: avgAtsImprovement?.toString() || null,
          conversionRate: conversionRate?.toString() || null,
          revenue: revenue.toString(),
          newUsers,
          activeUsers,
        })
        .where(eq(analyticsDailyRollups.date, dateStr))
    } else {
      // Insert new
      await db.insert(analyticsDailyRollups).values({
        date: dateStr,
        dau,
        wau,
        mau,
        totalTailoringRuns,
        avgAtsImprovement: avgAtsImprovement?.toString() || null,
        conversionRate: conversionRate?.toString() || null,
        revenue: revenue.toString(),
        newUsers,
        activeUsers,
      })
    }

    console.log(`Daily metrics aggregated for ${dateStr}:`, {
      dau,
      wau,
      mau,
      totalTailoringRuns,
      revenue,
    })
  } catch (error) {
    console.error('Failed to aggregate daily metrics:', error)
    throw error
  }
}

/**
 * Aggregates university metrics from analytics data
 * Should be run periodically to update university statistics
 */
export async function aggregateUniversityMetrics(): Promise<void> {
  try {
    // Get all unique university domains from users
    const universityUsers = await db
      .select({
        domain: sql<string>`split_part(${users.email}, '@', 2) as domain`,
        userId: users.id,
      })
      .from(users)
      .where(sql`${users.email} LIKE '%@%.edu' OR ${users.email} LIKE '%@%.ac.%'`)

    const domainMap = new Map<string, Set<string>>()
    for (const row of universityUsers) {
      if (!row.domain) continue
      if (!domainMap.has(row.domain)) {
        domainMap.set(row.domain, new Set())
      }
      domainMap.get(row.domain)!.add(row.userId)
    }

    // For each university domain, calculate metrics
    for (const [domain, userIds] of domainMap.entries()) {
      const userIdArray = Array.from(userIds)

      // Get university name from detector
      const { detectUniversity } = await import('./university-detector')
      const university = detectUniversity(`test@${domain}`)

      // Count users
      const userCount = userIds.size

      // Count total runs (using IN clause - iterate if needed for large arrays)
      let totalRuns = 0
      if (userIdArray.length > 0) {
        // Use a simple approach: count runs for each user and sum
        const runCounts = await Promise.all(
          userIdArray.map(async (userId) => {
            const [result] = await db
              .select({ count: sql<number>`count(*)` })
              .from(tailoringRuns)
              .where(eq(tailoringRuns.userId, userId))
            return Number(result?.count || 0)
          })
        )
        totalRuns = runCounts.reduce((sum, count) => sum + count, 0)
      }

      // Count credits consumed (same as runs for now)
      const creditsConsumed = totalRuns

      // Calculate conversion to paid (users who made purchases)
      let paidUsers = 0
      if (userIdArray.length > 0) {
        const paidUserSet = new Set<string>()
        for (const userId of userIdArray) {
          const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(creditTransactions)
            .where(eq(creditTransactions.userId, userId))
          if (Number(result?.count || 0) > 0) {
            paidUserSet.add(userId)
          }
        }
        paidUsers = paidUserSet.size
      }

      const conversionToPaid = userCount > 0 ? paidUsers / userCount : null

      // Upsert university metrics
      const existing = await db.query.universityMetrics.findFirst({
        where: eq(universityMetrics.universityDomain, domain),
      })

      if (existing) {
        await db
          .update(universityMetrics)
          .set({
            universityName: university?.name || null,
            userCount,
            totalRuns,
            creditsConsumed,
            conversionToPaid: conversionToPaid?.toString() || null,
            lastUpdated: new Date(),
          })
          .where(eq(universityMetrics.universityDomain, domain))
      } else {
        await db.insert(universityMetrics).values({
          universityDomain: domain,
          universityName: university?.name || null,
          userCount,
          totalRuns,
          creditsConsumed,
          conversionToPaid: conversionToPaid?.toString() || null,
          lastUpdated: new Date(),
        })
      }
    }

    console.log(`University metrics aggregated for ${domainMap.size} universities`)
  } catch (error) {
    console.error('Failed to aggregate university metrics:', error)
    throw error
  }
}
