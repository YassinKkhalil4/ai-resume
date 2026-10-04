import { db, users, usageLogs, creditLots } from '../db'
import { and, eq, gt, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { planDeduction } from './credit-plan'

export class NoCreditsError extends Error {
  constructor() {
    super('NO_CREDITS')
    this.name = 'NoCreditsError'
  }
}

export type CreditReservation = {
  userId: string
  lotId: string | null
  admin: boolean
  resumeHash?: string
}

export async function reserveCredit(userId: string, resumeHash?: string): Promise<CreditReservation> {
  return db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      throw new Error('User not found')
    }

    if (user.isAdmin) {
      return { userId, lotId: null, admin: true, resumeHash }
    }

    const now = new Date()
    const lots = await tx.query.creditLots.findMany({
      where: and(
        eq(creditLots.userId, userId),
        gt(creditLots.expiresAt, now),
        gt(creditLots.creditsRemaining, 0)
      ),
      orderBy: (creditLots, { asc }) => [asc(creditLots.expiresAt), asc(creditLots.createdAt)],
      limit: 10,
    })

    for (const lot of lots) {
      const [updatedLot] = await tx
        .update(creditLots)
        .set({ creditsRemaining: sql`${creditLots.creditsRemaining} - 1` })
        .where(and(eq(creditLots.id, lot.id), gt(creditLots.creditsRemaining, 0)))
        .returning({ id: creditLots.id })

      if (updatedLot) {
        await tx
          .update(users)
          .set({ creditsRemaining: sql`greatest(0, ${users.creditsRemaining} - 1)` })
          .where(eq(users.id, userId))

        return { userId, lotId: updatedLot.id, admin: false, resumeHash }
      }
    }

    throw new NoCreditsError()
  })
}

export async function commitCreditReservation(reservation: CreditReservation, tokensUsed?: number): Promise<void> {
  await db.insert(usageLogs).values({
    id: uuid(),
    userId: reservation.userId,
    resumeHash: reservation.resumeHash || null,
    tokensUsed: tokensUsed || null,
  })
}

export async function releaseCreditReservation(reservation: CreditReservation | null | undefined): Promise<void> {
  if (!reservation || reservation.admin || !reservation.lotId) return

  await db.transaction(async (tx) => {
    await tx
      .update(creditLots)
      .set({ creditsRemaining: sql`${creditLots.creditsRemaining} + 1` })
      .where(eq(creditLots.id, reservation.lotId!))

    await tx
      .update(users)
      .set({ creditsRemaining: sql`${users.creditsRemaining} + 1` })
      .where(eq(users.id, reservation.userId))
  })
}

export async function deductCredit(userId: string, resumeHash?: string, tokensUsed?: number): Promise<void> {
  const reservation = await reserveCredit(userId, resumeHash)
  await commitCreditReservation(reservation, tokensUsed)
}

function oneYearFromNow() {
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  return expiresAt
}

/**
 * Admin override: make the user's spendable balance exactly `target`.
 * Works on credit_lots (the source of truth for spending) and then refreshes the
 * denormalised users.credits_remaining cache. Raising adds an 'admin' lot;
 * lowering drains soonest-expiring lots first.
 */
export async function setUserCredits(userId: string, target: number): Promise<{ before: number; after: number }> {
  if (!Number.isInteger(target) || target < 0) {
    throw new Error('Credit target must be a non-negative integer')
  }

  return db.transaction(async (tx) => {
    const now = new Date()
    const lots = await tx
      .select({ id: creditLots.id, creditsRemaining: creditLots.creditsRemaining })
      .from(creditLots)
      .where(and(eq(creditLots.userId, userId), gt(creditLots.expiresAt, now), gt(creditLots.creditsRemaining, 0)))
      .orderBy(creditLots.expiresAt, creditLots.createdAt)
      .for('update')

    const before = lots.reduce((sum, lot) => sum + lot.creditsRemaining, 0)
    const delta = target - before

    if (delta > 0) {
      await tx.insert(creditLots).values({
        userId,
        source: 'admin',
        creditsTotal: delta,
        creditsRemaining: delta,
        expiresAt: oneYearFromNow(),
      })
    } else if (delta < 0) {
      for (const { id, take } of planDeduction(lots, -delta)) {
        await tx
          .update(creditLots)
          .set({ creditsRemaining: sql`${creditLots.creditsRemaining} - ${take}` })
          .where(eq(creditLots.id, id))
      }
    }

    await tx.update(users).set({ creditsRemaining: target }).where(eq(users.id, userId))
    return { before, after: target }
  })
}
