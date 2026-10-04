import { db, emailVerificationTokens, users } from '../db'
import { eq, and, gt, lt, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { checkNamedRateLimit } from '../rate-limiter'

const CODE_EXPIRY_HOURS = 24
const TOKEN_EXPIRY_HOURS = 24
const CODE_ATTEMPT_LIMIT = 5
const CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

export type VerificationType = 'code' | 'link'

export async function generateVerificationToken(userId: string, type: VerificationType) {
  // Delete any existing unused tokens for this user of the same type
  await db
    .delete(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        eq(emailVerificationTokens.type, type),
        isNull(emailVerificationTokens.usedAt)
      )
    )

  const token = crypto.randomBytes(32).toString('hex')
  const code = type === 'code' ? generateVerificationCode() : null
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_HOURS * 60 * 60 * 1000)

  const [verificationToken] = await db
    .insert(emailVerificationTokens)
    .values({
      userId,
      token,
      code,
      type,
      expiresAt,
    })
    .returning()

  return { token, code, expiresAt, verificationToken }
}

function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1_000_000).toString()
}

export async function validateVerificationToken(token: string) {
  const verificationToken = await db.query.emailVerificationTokens.findFirst({
    where: and(
      eq(emailVerificationTokens.token, token),
      gt(emailVerificationTokens.expiresAt, new Date()),
      isNull(emailVerificationTokens.usedAt)
    ),
  })

  if (!verificationToken) {
    return { valid: false, error: 'Invalid or expired verification token' }
  }

  if (!(await consumeToken(verificationToken.id))) {
    return { valid: false, error: 'Invalid or expired verification token' }
  }

  await markUserVerified(verificationToken.userId)

  const user = await db.query.users.findFirst({
    where: eq(users.id, verificationToken.userId),
  })

  return { valid: true, user }
}

/** Atomically marks a token used; false if someone else consumed it first. */
async function consumeToken(id: string): Promise<boolean> {
  const rows = await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailVerificationTokens.id, id), isNull(emailVerificationTokens.usedAt)))
    .returning({ id: emailVerificationTokens.id })
  return rows.length > 0
}

async function markUserVerified(userId: string) {
  await db
    .update(users)
    .set({ emailVerified: true, emailVerifiedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function validateVerificationCode(userId: string, code: string): Promise<
  | { valid: true; user: typeof users.$inferSelect | undefined }
  | { valid: false; error: string; rateLimited?: boolean }
> {
  // 6 digits is only 1M possibilities: cap guesses per user before comparing anything.
  const attempt = await checkNamedRateLimit('verify-code', userId, CODE_ATTEMPT_LIMIT, CODE_ATTEMPT_WINDOW_MS)
  if (!attempt.allowed) {
    return { valid: false, error: 'Too many attempts. Please wait a few minutes or request a new code.', rateLimited: true }
  }

  const verificationToken = await db.query.emailVerificationTokens.findFirst({
    where: and(
      eq(emailVerificationTokens.userId, userId),
      eq(emailVerificationTokens.code, code),
      gt(emailVerificationTokens.expiresAt, new Date()),
      isNull(emailVerificationTokens.usedAt)
    ),
    orderBy: (tokens, { desc }) => [desc(tokens.createdAt)],
  })

  if (!verificationToken) {
    return { valid: false, error: 'Invalid or expired verification code' }
  }

  if (!(await consumeToken(verificationToken.id))) {
    return { valid: false, error: 'Invalid or expired verification code' }
  }

  await markUserVerified(userId)

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  return { valid: true, user }
}

export async function cleanupExpiredTokens() {
  const now = new Date()
  await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, now))
}

