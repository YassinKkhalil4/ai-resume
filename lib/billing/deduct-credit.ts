import { db, users, usageLogs, creditLots } from '../db'
import { and, eq, gt, sql } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import postgres from 'postgres'

export class NoCreditsError extends Error {
  constructor() {
    super('NO_CREDITS')
    this.name = 'NoCreditsError'
  }
}

export async function deductCredit(userId: string, resumeHash?: string, tokensUsed?: number): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      // Get user
      const user = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!user) {
        throw new Error('User not found')
      }

      // Skip credit deduction for admin users
      if (user.isAdmin) {
        // Still log usage for admins
        await tx.insert(usageLogs).values({
          id: uuid(),
          userId,
          resumeHash: resumeHash || null,
          tokensUsed: tokensUsed || null,
        })
        return
      }

      const now = new Date()

      // Fetch all non-expired credit lots with remaining credits, ordered by soonest expiry then oldest creation
      const lots = await tx.query.creditLots.findMany({
        where: and(
          eq(creditLots.userId, userId),
          gt(creditLots.expiresAt, now),
          gt(creditLots.creditsRemaining, 0)
        ),
        orderBy: (creditLots, { asc }) => [asc(creditLots.expiresAt), asc(creditLots.createdAt)],
      })

      if (!lots.length) {
        throw new NoCreditsError()
      }

      const totalRemaining = lots.reduce((sum, lot) => sum + (lot.creditsRemaining || 0), 0)
      if (totalRemaining <= 0) {
        throw new NoCreditsError()
      }

      // Consume from the earliest-expiring lot(s)
      let remainingToDeduct = 1
      for (const lot of lots) {
        if (remainingToDeduct <= 0) break
        if (lot.creditsRemaining <= 0) continue

        const deductFromLot = Math.min(lot.creditsRemaining, remainingToDeduct)
        const newRemaining = lot.creditsRemaining - deductFromLot

        await tx
          .update(creditLots)
          .set({ creditsRemaining: newRemaining })
          .where(eq(creditLots.id, lot.id))

        remainingToDeduct -= deductFromLot
      }

      if (remainingToDeduct > 0) {
        // This should not happen if totalRemaining check passed, but guard just in case
        throw new NoCreditsError()
      }

      // Also update aggregate on users table to keep it in sync
      const currentCredits = user.creditsRemaining
      const newUserCredits = currentCredits > 0 ? currentCredits - 1 : 0

      await tx
        .update(users)
        .set({
          creditsRemaining: newUserCredits,
        })
        .where(eq(users.id, userId))

      // Log usage
      await tx.insert(usageLogs).values({
        id: uuid(),
        userId,
        resumeHash: resumeHash || null,
        tokensUsed: tokensUsed || null,
      })
    })
  } catch (error) {
    if (error instanceof NoCreditsError) {
      throw error
    }
    throw new Error(`Failed to deduct credit: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

