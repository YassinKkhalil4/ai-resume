import { NextRequest, NextResponse } from 'next/server'
import { db, analyticsEvents, tailoringRuns, users, creditTransactions, analyticsSessions, universityMetrics } from '../../../../lib/db'
import { sql, desc, gte, eq, and, count } from 'drizzle-orm'
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

// GET /api/admin/analytics/overview - Get overview metrics
export async function GET(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res

  try {
    const url = new URL(req.url)
    const endpoint = url.searchParams.get('endpoint') || 'overview'
    const days = parseInt(url.searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    if (endpoint === 'overview') {
      // Calculate DAU/WAU/MAU
      const now = new Date()
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      // Parallelize all independent queries
      const [
        dauResult,
        [wau],
        [mau],
        [totalRuns],
        [avgImprovement],
        [periodRevenue],
        [signups],
        [firstTailors],
      ] = await Promise.all([
        db
        .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
        .from(analyticsEvents)
          .where(and(gte(analyticsEvents.timestamp, oneDayAgo), sql`${analyticsEvents.userId} IS NOT NULL`)),
        db
        .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
        .from(analyticsEvents)
          .where(and(gte(analyticsEvents.timestamp, oneWeekAgo), sql`${analyticsEvents.userId} IS NOT NULL`)),
        db
        .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
        .from(analyticsEvents)
          .where(and(gte(analyticsEvents.timestamp, oneMonthAgo), sql`${analyticsEvents.userId} IS NOT NULL`)),
        db.select({ count: sql<number>`count(*)` }).from(tailoringRuns),
        db.select({ avg: sql<number>`coalesce(avg(${tailoringRuns.atsDelta}::numeric), 0)` }).from(tailoringRuns),
        db
        .select({ total: sql<number>`coalesce(sum(${creditTransactions.amount}::numeric), 0)` })
        .from(creditTransactions)
          .where(gte(creditTransactions.createdAt, startDate)),
        db
        .select({ count: sql<number>`count(*)` })
        .from(analyticsEvents)
          .where(and(eq(analyticsEvents.eventName, 'signup_completed'), gte(analyticsEvents.timestamp, startDate))),
        db
        .select({ count: sql<number>`count(distinct ${tailoringRuns.userId})` })
        .from(tailoringRuns)
          .where(gte(tailoringRuns.createdAt, startDate)),
      ])

      const [dau] = dauResult.length > 0 ? dauResult : [{ count: 0 }]
      const conversionRate = Number(signups.count) > 0
        ? Number(firstTailors.count) / Number(signups.count)
        : 0

      return NextResponse.json({
        dau: Number(dau.count),
        wau: Number(wau.count),
        mau: Number(mau.count),
        totalTailoringRuns: Number(totalRuns.count),
        avgAtsImprovement: Number(avgImprovement.avg),
        revenue: Number(periodRevenue.total),
        conversionRate,
        period: { days, startDate: startDate.toISOString() },
      })
    }

    if (endpoint === 'funnel') {
      // Get funnel data
      const funnelEvents = ['visit_landing', 'signup_started', 'signup_completed', 'resume_uploaded', 'tailor_clicked', 'tailor_completed', 'checkout_started', 'checkout_completed']

      const funnelData = await Promise.all(
        funnelEvents.map(async (eventName) => {
          const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(analyticsEvents)
            .where(and(eq(analyticsEvents.eventName, eventName), gte(analyticsEvents.timestamp, startDate)))

          return {
            event: eventName,
            count: Number(result.count),
          }
        })
      )

      // Calculate drop-off percentages
      const funnelWithDropoff = funnelData.map((step, index) => {
        const previousStep = index > 0 ? funnelData[index - 1] : null
        const dropoff = previousStep && previousStep.count > 0
          ? ((previousStep.count - step.count) / previousStep.count) * 100
          : 0

        return {
          ...step,
          dropoff: Math.round(dropoff * 100) / 100,
        }
      })

      return NextResponse.json({
        funnel: funnelWithDropoff,
        period: { days, startDate: startDate.toISOString() },
      })
    }

    if (endpoint === 'tailoring-quality') {
      // Get tailoring quality metrics
      const [positiveImprovement] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tailoringRuns)
        .where(sql`${tailoringRuns.atsDelta}::numeric > 0`)

      const [totalRuns] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tailoringRuns)

      const [avgDelta] = await db
        .select({ avg: sql<number>`coalesce(avg(${tailoringRuns.atsDelta}::numeric), 0)` })
        .from(tailoringRuns)

      const [avgHonestyFlags] = await db
        .select({ avg: sql<number>`coalesce(avg(${tailoringRuns.honestyFlags}), 0)` })
        .from(tailoringRuns)

      const [avgTime] = await db
        .select({ avg: sql<number>`coalesce(avg(${tailoringRuns.timeToComplete}), 0)` })
        .from(tailoringRuns)

      // Average ATS delta by industry
      const industryBreakdown = await db
        .select({
          industry: tailoringRuns.industry,
          avgDelta: sql<number>`coalesce(avg(${tailoringRuns.atsDelta}::numeric), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(tailoringRuns)
        .where(sql`${tailoringRuns.industry} IS NOT NULL`)
        .groupBy(tailoringRuns.industry)
        .orderBy(desc(sql`count(*)`))
        .limit(10)

      const positiveRate = Number(totalRuns.count) > 0
        ? (Number(positiveImprovement.count) / Number(totalRuns.count)) * 100
        : 0

      return NextResponse.json({
        totalRuns: Number(totalRuns.count),
        positiveImprovementRate: Math.round(positiveRate * 100) / 100,
        avgAtsDelta: Number(avgDelta.avg),
        avgHonestyFlags: Number(avgHonestyFlags.avg),
        avgTimeToComplete: Number(avgTime.avg),
        industryBreakdown: industryBreakdown.map((i) => ({
          industry: i.industry,
          avgDelta: Number(i.avgDelta),
          count: Number(i.count),
        })),
      })
    }

    if (endpoint === 'universities') {
      // Get university metrics
      const universityData = await db
        .select({
          domain: universityMetrics.universityDomain,
          name: universityMetrics.universityName,
          userCount: universityMetrics.userCount,
          totalRuns: universityMetrics.totalRuns,
          creditsConsumed: universityMetrics.creditsConsumed,
          conversionToPaid: universityMetrics.conversionToPaid,
        })
        .from(universityMetrics)
        .orderBy(desc(universityMetrics.totalRuns))
        .limit(50)

      return NextResponse.json({
        universities: universityData.map((u) => ({
          domain: u.domain,
          name: u.name,
          userCount: Number(u.userCount),
          totalRuns: Number(u.totalRuns),
          creditsConsumed: Number(u.creditsConsumed),
          conversionToPaid: u.conversionToPaid ? Number(u.conversionToPaid) : null,
        })),
      })
    }

    return NextResponse.json(
      { code: 'bad_request', message: 'Invalid endpoint' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
