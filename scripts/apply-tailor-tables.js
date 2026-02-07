#!/usr/bin/env node
import { config } from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import postgres from 'postgres'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// Normalize database URL (same logic as lib/db/index.ts)
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

  // Normalize common "psql 'postgresql://...'" copy/paste formats
  if (/^psql\b/i.test(raw)) {
    const m = raw.match(/(postgres(?:ql)?:\/\/[^\s'"]+)/i)
    if (m?.[1]) return m[1]
  }

  // Strip wrapping quotes if present
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1)
  }

  return raw
}

const databaseUrl = resolveDatabaseUrl()
if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env.local (checked: DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, NEON_DATABASE_URL, SUPABASE_DB_URL)')
  process.exit(1)
}

console.log('✅ Loaded DATABASE_URL from .env.local')
console.log('🚀 Applying tailor trace tables migration...\n')

try {
  const sql = postgres(databaseUrl)
  
  // Read the migration file
  const migrationSQL = readFileSync(
    resolve(process.cwd(), 'drizzle/0001_tailor_trace_tables.sql'),
    'utf-8'
  )
  
  // Split by statement breakpoints and execute each statement
  const statements = migrationSQL
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await sql.unsafe(statement)
        console.log('✅ Executed statement')
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate')) {
          console.log('⚠️  Statement already applied (skipping)')
        } else {
          console.error('❌ Error executing statement:', error.message)
          console.error('Statement:', statement.substring(0, 100) + '...')
        }
      }
    }
  }
  
  await sql.end()
  console.log('\n✅ Migration applied successfully!')
  console.log('📊 Tables created: tailor_runs, tailor_run_events, tailor_debug_snapshots')
} catch (error) {
  console.error('\n❌ Failed to apply migration:', error.message)
  process.exit(1)
}

