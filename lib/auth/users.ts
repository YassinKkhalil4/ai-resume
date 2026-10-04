import { sql } from 'drizzle-orm'
import { db, users } from '../db'
import { normalizeEmail } from './email'

/** Case-insensitive lookup so legacy mixed-case rows and new lowercase rows resolve to the same account. */
export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const user = await db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${normalized}`,
  })
  return user ?? null
}
