import { getServerSession } from 'next-auth'
import { authOptions } from './config'
import { db, users } from '../db'
import { eq } from 'drizzle-orm'

export async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  })

  return user
}

export async function getUserCredits(userId: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  return user?.creditsRemaining || 0
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

