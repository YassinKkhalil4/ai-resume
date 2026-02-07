import { db, emailVerificationTokens, users } from '../db'
import { eq, and, gt, lt, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

const CODE_EXPIRY_HOURS = 24
const TOKEN_EXPIRY_HOURS = 24

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
  return Math.floor(100000 + Math.random() * 900000).toString()
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

  // Mark token as used
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, verificationToken.id))

  // Mark user as verified
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerifiedAt: new Date(),
    })
    .where(eq(users.id, verificationToken.userId))

  const user = await db.query.users.findFirst({
    where: eq(users.id, verificationToken.userId),
  })

  return { valid: true, user }
}

export async function validateVerificationCode(userId: string, code: string) {
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

  // Mark token as used
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, verificationToken.id))

  // Mark user as verified
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerifiedAt: new Date(),
    })
    .where(eq(users.id, userId))

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

