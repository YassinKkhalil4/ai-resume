import { db, users, usageLogs } from '../db'
import { eq, sql } from 'drizzle-orm'
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
      // Get user with row-level lock using raw SQL
      const user = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      })

      if (!user) {
        throw new Error('User not found')
      }

      const currentCredits = user.creditsRemaining

      if (currentCredits <= 0) {
        throw new NoCreditsError()
      }

      // Deduct credit atomically
      await tx
        .update(users)
        .set({
          creditsRemaining: currentCredits - 1,
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

