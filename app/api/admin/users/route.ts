import { NextRequest, NextResponse } from 'next/server'
import { db, users, usageLogs, creditTransactions } from '../../../../lib/db'
import { eq, desc, sql, inArray } from 'drizzle-orm'
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
  return { ok: true, user }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/admin/users - List all users with stats
export async function GET(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Get all users first
    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      limit,
      offset,
    })

    if (allUsers.length === 0) {
      return NextResponse.json({
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      })
    }

    const userIds = allUsers.map(u => u.id)

    // Batch fetch all stats in parallel (3 queries total instead of 3*N)
    const [usageCounts, creditsData, revenueData] = await Promise.all([
      // Usage counts for all users
          db
        .select({
          userId: usageLogs.userId,
          count: sql<number>`count(*)::int`,
        })
            .from(usageLogs)
        .where(inArray(usageLogs.userId, userIds))
        .groupBy(usageLogs.userId),
      // Credits purchased for all users
          db
        .select({
          userId: creditTransactions.userId,
          total: sql<number>`coalesce(sum(${creditTransactions.creditsAdded}), 0)::int`,
        })
            .from(creditTransactions)
        .where(inArray(creditTransactions.userId, userIds))
        .groupBy(creditTransactions.userId),
      // Revenue for all users
          db
        .select({
          userId: creditTransactions.userId,
          total: sql<number>`coalesce(sum(${creditTransactions.amount}::numeric), 0)::numeric`,
        })
            .from(creditTransactions)
        .where(inArray(creditTransactions.userId, userIds))
        .groupBy(creditTransactions.userId),
    ])

    // Create lookup maps for O(1) access
    const usageMap = new Map(usageCounts.map(u => [u.userId, Number(u.count)]))
    const creditsMap = new Map(creditsData.map(c => [c.userId, Number(c.total)]))
    const revenueMap = new Map(revenueData.map(r => [r.userId, Number(r.total)]))

    // Combine users with their stats
    const usersWithStats = allUsers.map(user => ({
          id: user.id,
          email: user.email,
          creditsRemaining: user.creditsRemaining,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
          stripeCustomerId: user.stripeCustomerId,
      usageCount: usageMap.get(user.id) || 0,
      totalCreditsPurchased: creditsMap.get(user.id) || 0,
      totalRevenue: revenueMap.get(user.id) || 0,
    }))

    // Get total count for pagination
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total: Number(totalCount.count),
        totalPages: Math.ceil(Number(totalCount.count) / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users - Update user (credits, admin status)
export async function PATCH(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res

  try {
    const body = await req.json()
    const { userId, creditsRemaining, isAdmin: newAdminStatus } = body

    if (!userId) {
      return NextResponse.json({ code: 'bad_request', message: 'userId is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (typeof creditsRemaining === 'number') {
      updateData.creditsRemaining = creditsRemaining
    }
    if (typeof newAdminStatus === 'boolean') {
      updateData.isAdmin = newAdminStatus
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ code: 'bad_request', message: 'No valid fields to update' }, { status: 400 })
    }

    // Prevent removing your own admin status
    if (newAdminStatus === false && userId === adminCheck.user?.id) {
      return NextResponse.json(
        { code: 'forbidden', message: 'Cannot remove your own admin privileges' },
        { status: 403 }
      )
    }

    await db.update(users).set(updateData).where(eq(users.id, userId))

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to update user' },
      { status: 500 }
    )
  }
}
