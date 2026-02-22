import { NextRequest, NextResponse } from 'next/server'
import { getUserCredits } from '../../../../lib/auth/utils'
import { requireEmailVerification } from '../../../../lib/guards'
import { db, creditLots } from '../../../../lib/db'
import { and, asc, eq, gt, sql } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const verificationCheck = await requireEmailVerification(req)
    if (!verificationCheck.ok) {
      return verificationCheck.res
    }
    const user = verificationCheck.user
    // Admins get unlimited credits; return high value so UI never shows 0
    const credits = user.isAdmin
      ? 999999
      : await getUserCredits(user.id)

    // Compute next expiry date for any active credits (only for non-admins)
    const now = new Date()
    const nextExpiryRow = await db
      .select({
        nextExpiresAt: creditLots.expiresAt,
      })
      .from(creditLots)
      .where(
        and(
          eq(creditLots.userId, user.id),
          gt(creditLots.expiresAt, now),
          gt(creditLots.creditsRemaining, 0),
        ),
      )
      .orderBy(asc(creditLots.expiresAt))
      .limit(1)

    const nextExpiryAt = nextExpiryRow[0]?.nextExpiresAt ?? null

    return NextResponse.json({
      success: true,
      creditsRemaining: credits,
      userId: user.id,
      isAdmin: user.isAdmin || false,
      nextExpiryAt,
    })
  } catch (error) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }
}

