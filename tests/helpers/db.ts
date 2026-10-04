/**
 * DB-backed tests run only when TEST_DATABASE_URL points at a throwaway Postgres
 * with the drizzle/*.sql migrations applied. Otherwise they are skipped.
 * DATABASE_URL must be set before lib/db is first imported, so call useTestDb()
 * at the top of the test file (before any dynamic import of lib/*).
 */
export const dbSkip: string | false = process.env.TEST_DATABASE_URL
  ? false
  : 'TEST_DATABASE_URL not set (see docs/testing.md)'

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

export async function resetDb() {
  const { db } = await import('../../lib/db')
  const { sql } = await import('drizzle-orm')
  await db.execute(sql`set client_min_messages = warning`)
  await db.execute(sql`truncate table users, webhook_logs restart identity cascade`)
}

export async function createUser(overrides: Record<string, unknown> = {}) {
  const { db, users } = await import('../../lib/db')
  const [user] = await db
    .insert(users)
    .values({ email: `u${Math.random().toString(36).slice(2)}@example.com`, emailVerified: true, ...overrides })
    .returning()
  return user
}

export async function giveCredits(userId: string, credits: number, expiresInDays = 365) {
  const { db, creditLots, users } = await import('../../lib/db')
  const { sql, eq } = await import('drizzle-orm')
  const [lot] = await db
    .insert(creditLots)
    .values({
      userId,
      source: 'test',
      creditsTotal: credits,
      creditsRemaining: credits,
      expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
    })
    .returning()
  await db.update(users).set({ creditsRemaining: sql`${users.creditsRemaining} + ${credits}` }).where(eq(users.id, userId))
  return lot
}
