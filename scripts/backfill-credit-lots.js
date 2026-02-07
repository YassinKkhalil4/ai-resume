#!/usr/bin/env node
import { config } from 'dotenv'
import { resolve } from 'path'
import postgres from 'postgres'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.NEON_DATABASE_URL,
    process.env.SUPABASE_DB_URL,
  ]

  const found = candidates.find((c) => Boolean(c && c.trim()))
  if (!found) return null

  const raw = found.trim()

  if (/^psql\b/i.test(raw)) {
    const m = raw.match(/(postgres(?:ql)?:\/\/[^\s'"]+)/i)
    if (m?.[1]) return m[1]
  }

  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1)
  }

  return raw
}

async function main() {
  const databaseUrl = resolveDatabaseUrl()
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.local (checked: DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, NEON_DATABASE_URL, SUPABASE_DB_URL)')
    process.exit(1)
  }

  console.log('✅ Loaded DATABASE_URL from .env.local')
  console.log('🚀 Backfilling credit_lots from users.creditsRemaining...\n')

  const sql = postgres(databaseUrl)

  try {
    const users = await sql/* sql */`
      SELECT id, "credits_remaining"
      FROM users
      WHERE "credits_remaining" > 0
    `

    if (!users.length) {
      console.log('No users with positive credits_remaining found. Nothing to backfill.')
      await sql.end()
      process.exit(0)
    }

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    const expiresAtIso = expiresAt.toISOString()

    for (const user of users) {
      const credits = Number(user.credits_remaining || user.creditsRemaining || 0)
      if (!credits || credits <= 0) continue

      console.log(`Backfilling ${credits} credits for user ${user.id}`)

      await sql.begin(async (trx) => {
        // Check if a backfill lot already exists to keep this script idempotent
        const existing = await trx/* sql */`
          SELECT id FROM credit_lots
          WHERE "user_id" = ${user.id}
          AND source = 'backfill'
        `

        if (existing.length) {
          console.log(`  ↳ backfill lot already exists, skipping user ${user.id}`)
          return
        }

        await trx/* sql */`
          INSERT INTO credit_lots (
            id,
            user_id,
            source,
            stripe_payment_id,
            stripe_invoice_id,
            credits_total,
            credits_remaining,
            expires_at,
            created_at
          )
          VALUES (
            gen_random_uuid(),
            ${user.id},
            'backfill',
            NULL,
            NULL,
            ${credits},
            ${credits},
            ${expiresAtIso},
            NOW()
          )
        `
      })
    }

    await sql.end()
    console.log('\n✅ Backfill completed successfully!')
  } catch (error) {
    console.error('\n❌ Failed to backfill credit_lots:', error.message || error)
    try {
      await sql.end()
    } catch {
      // ignore
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Unexpected error during backfill:', err)
  process.exit(1)
})

