#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'path'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../lib/db/schema'
import { eq } from 'drizzle-orm'

const { users } = schema

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const email = 'yassinkhalil@flaresync.org'
const unlimitedCredits = 999999 // Very high number to represent unlimited

async function grantAdmin() {
  let databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.local')
    process.exit(1)
  }

  // Clean up the connection string
  databaseUrl = databaseUrl.trim()
  databaseUrl = databaseUrl.replace(/^["']|["']$/g, '')
  databaseUrl = databaseUrl.replace(/^psql\s+['"]?/, '')
  databaseUrl = databaseUrl.replace(/['"]$/, '')

  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    console.error('❌ DATABASE_URL must start with postgresql:// or postgres://')
    process.exit(1)
  }

  console.log(`🔧 Granting admin privileges and unlimited credits to ${email}...\n`)

  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client, { schema })

  try {
    // First, check if the user exists
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user) {
      console.error(`❌ User with email ${email} not found in database`)
      console.error('   Please make sure the user has signed up first.')
      process.exit(1)
    }

    console.log(`✅ Found user: ${user.email} (ID: ${user.id})`)
    console.log(`   Current credits: ${user.creditsRemaining}`)
    console.log(`   Current admin status: ${user.isAdmin || false}`)

    // Check if isAdmin column exists, if not, add it
    try {
      await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false`
      console.log('✅ Added is_admin column to users table (if it didn\'t exist)')
    } catch (error) {
      // Column might already exist, that's fine
      console.log('ℹ️  is_admin column already exists or error adding it (this is OK)')
    }

    // Update user to have admin privileges and unlimited credits
    await db
      .update(users)
      .set({
        isAdmin: true,
        creditsRemaining: unlimitedCredits,
      })
      .where(eq(users.email, email))

    console.log(`\n✅ Successfully updated user:`)
    console.log(`   - Admin privileges: ENABLED`)
    console.log(`   - Credits: ${unlimitedCredits} (unlimited)`)
    console.log(`\n🎉 User ${email} now has admin privileges and unlimited credits!`)

  } catch (error) {
    console.error('\n❌ Failed to grant admin privileges:')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  } finally {
    await client.end()
  }
}

grantAdmin()
