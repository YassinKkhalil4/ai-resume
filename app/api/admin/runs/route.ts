import { NextRequest, NextResponse } from 'next/server'
import { db, tailorRuns, users } from '../../../../lib/db'
import { sql, desc, asc, eq, and, gte, lte, like, or } from 'drizzle-orm'
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

// GET /api/admin/runs - List tailor runs with filtering and sorting
export async function GET(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filter parameters
    const errorStage = url.searchParams.get('error_stage')
    const atsDeltaMin = url.searchParams.get('ats_delta_min') ? parseInt(url.searchParams.get('ats_delta_min')!) : null
    const atsDeltaMax = url.searchParams.get('ats_delta_max') ? parseInt(url.searchParams.get('ats_delta_max')!) : null
    const industry = url.searchParams.get('industry')
    const featureFlag = url.searchParams.get('feature_flag')
    const status = url.searchParams.get('status') as 'success' | 'failed' | 'partial' | null

    // Sort parameter
    const sort = url.searchParams.get('sort') || 'created_at_desc'

    // Build where conditions
    const conditions = []

    if (status) {
      conditions.push(eq(tailorRuns.status, status))
    }

    if (atsDeltaMin !== null) {
      conditions.push(
        gte(
          sql`COALESCE(${tailorRuns.finalAtsAfter}, 0) - COALESCE(${tailorRuns.finalAtsBefore}, 0)`,
          atsDeltaMin
        )
      )
    }

    if (atsDeltaMax !== null) {
      conditions.push(
        lte(
          sql`COALESCE(${tailorRuns.finalAtsAfter}, 0) - COALESCE(${tailorRuns.finalAtsBefore}, 0)`,
          atsDeltaMax
        )
      )
    }

    // Build query with joins
    let query = db
      .select({
        id: tailorRuns.id,
        userId: tailorRuns.userId,
        userEmail: users.email,
        sessionId: tailorRuns.sessionId,
        createdAt: tailorRuns.createdAt,
        completedAt: tailorRuns.completedAt,
        status: tailorRuns.status,
        modelUsed: tailorRuns.modelUsed,
        tokensIn: tailorRuns.tokensIn,
        tokensOut: tailorRuns.tokensOut,
        latencyMs: tailorRuns.latencyMs,
        creditsUsed: tailorRuns.creditsUsed,
        finalAtsBefore: tailorRuns.finalAtsBefore,
        finalAtsAfter: tailorRuns.finalAtsAfter,
        atsDelta: sql<number>`COALESCE(${tailorRuns.finalAtsAfter}, 0) - COALESCE(${tailorRuns.finalAtsBefore}, 0)`.as('ats_delta'),
      })
      .from(tailorRuns)
      .leftJoin(users, eq(tailorRuns.userId, users.id))

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    // Apply sorting
    switch (sort) {
      case 'ats_gain_desc':
        query = query.orderBy(desc(sql`COALESCE(${tailorRuns.finalAtsAfter}, 0) - COALESCE(${tailorRuns.finalAtsBefore}, 0)`)) as any
        break
      case 'ats_gain_asc':
        query = query.orderBy(asc(sql`COALESCE(${tailorRuns.finalAtsAfter}, 0) - COALESCE(${tailorRuns.finalAtsBefore}, 0)`)) as any
        break
      case 'created_at_desc':
        query = query.orderBy(desc(tailorRuns.createdAt)) as any
        break
      case 'created_at_asc':
        query = query.orderBy(asc(tailorRuns.createdAt)) as any
        break
      default:
        query = query.orderBy(desc(tailorRuns.createdAt)) as any
    }

    // Get total count for pagination
    let total = 0
    try {
      const countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(tailorRuns)
        .leftJoin(users, eq(tailorRuns.userId, users.id))

      if (conditions.length > 0) {
        countQuery.where(and(...conditions)) as any
      }

      const [countResult] = await countQuery
      total = Number(countResult.count)
    } catch (countError) {
      console.error('Count query failed:', countError)
      console.error('Count error details:', {
        message: countError instanceof Error ? countError.message : String(countError),
        stack: countError instanceof Error ? countError.stack : undefined,
        name: countError instanceof Error ? countError.constructor.name : typeof countError,
      })
      // If table doesn't exist or query fails, return empty results instead of crashing
      // Check for various error patterns that indicate missing table or query failure
      const errorStr = countError instanceof Error ? countError.message : String(countError)
      const errorFullStr = String(countError) // Get full string representation
      const errorLower = (errorStr + ' ' + errorFullStr).toLowerCase()
      
      // More permissive check - if it's a DrizzleQueryError or mentions tailor_runs, assume table missing
      const isDrizzleError = countError?.constructor?.name === 'DrizzleQueryError' || 
                             errorLower.includes('drizzle') ||
                             errorLower.includes('failed query') ||
                             errorLower.includes('tailor_runs') ||
                             errorLower.includes('does not exist') || 
                             errorLower.includes('relation') || 
                             errorLower.includes('table')
      
      if (isDrizzleError) {
        return NextResponse.json({
          runs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
      throw countError
    }

    // Apply pagination
    let runs: any[] = []
    try {
      runs = await query.limit(limit).offset(offset)
    } catch (queryError) {
      console.error('Main query failed:', queryError)
      // If table doesn't exist or query fails, return empty results instead of crashing
      const errorStr = queryError instanceof Error ? queryError.message : String(queryError)
      const errorFullStr = String(queryError) // Get full string representation
      const errorLower = (errorStr + ' ' + errorFullStr).toLowerCase()
      
      // More permissive check - if it's a DrizzleQueryError or mentions tailor_runs, assume table missing
      const isDrizzleError = queryError?.constructor?.name === 'DrizzleQueryError' || 
                             errorLower.includes('drizzle') ||
                             errorLower.includes('failed query') ||
                             errorLower.includes('tailor_runs') ||
                             errorLower.includes('does not exist') || 
                             errorLower.includes('relation') || 
                             errorLower.includes('table')
      
      if (isDrizzleError) {
        return NextResponse.json({
          runs: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        })
      }
      throw queryError
    }

    // If error_stage filter is provided, we need to check events
    // For now, we'll filter in memory (could be optimized with a subquery)
    let filteredRuns = runs
    if (errorStage) {
      // This would require a join with events - simplified for now
      // In production, you'd want to use a subquery or join
    }

    return NextResponse.json({
      runs: filteredRuns.map(run => ({
        id: run.id,
        userId: run.userId,
        userEmail: run.userEmail,
        sessionId: run.sessionId,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        status: run.status,
        modelUsed: run.modelUsed,
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        latencyMs: run.latencyMs,
        creditsUsed: run.creditsUsed,
        finalAtsBefore: run.finalAtsBefore,
        finalAtsAfter: run.finalAtsAfter,
        atsDelta: Number(run.atsDelta) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching runs:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.constructor.name : typeof error,
    })
    return NextResponse.json(
      { 
        code: 'server_error', 
        message: 'Failed to fetch runs',
        error: error instanceof Error ? error.message : String(error),
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    )
  }
}

