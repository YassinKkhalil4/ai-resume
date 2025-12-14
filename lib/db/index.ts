import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _client: ReturnType<typeof postgres> | null = null

function resolveDatabaseUrl(): { url: string | null; source: string | null; normalized: boolean } {
  const candidates: Array<{ key: string; value: string | undefined }> = [
    { key: 'DATABASE_URL', value: process.env.DATABASE_URL },
    { key: 'POSTGRES_URL', value: process.env.POSTGRES_URL },
    { key: 'POSTGRES_PRISMA_URL', value: process.env.POSTGRES_PRISMA_URL },
    { key: 'NEON_DATABASE_URL', value: process.env.NEON_DATABASE_URL },
    { key: 'SUPABASE_DB_URL', value: process.env.SUPABASE_DB_URL },
  ]

  const found = candidates.find((c) => Boolean(c.value && c.value.trim()))
  if (!found || !found.value) return { url: null, source: null, normalized: false }

  const raw = found.value.trim()

  // Normalize common "psql 'postgresql://...'" copy/paste formats into a bare URL
  // Examples:
  // - psql 'postgresql://...'
  // - psql "postgresql://..."
  // - psql postgresql://...
  if (/^psql\b/i.test(raw)) {
    const m = raw.match(/(postgres(?:ql)?:\/\/[^\s'"]+)/i)
    if (m?.[1]) return { url: m[1], source: found.key, normalized: true }
  }

  // Strip wrapping quotes if present
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return { url: raw.slice(1, -1), source: found.key, normalized: true }
  }

  return { url: raw, source: found.key, normalized: false }
}

function getDb() {
  // Skip database connection during build/static generation
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build') {
    // Return a mock db object during build to prevent connection attempts
    return {} as ReturnType<typeof drizzle<typeof schema>>
  }

  if (!_db) {
    const resolved = resolveDatabaseUrl()

    if (!resolved.url) {
      throw new Error(
        'Database connection environment variable is not set (expected one of: DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, NEON_DATABASE_URL, SUPABASE_DB_URL)'
      )
    }

    // Create postgres connection
    const connectionString = resolved.url
    _client = postgres(connectionString, {
      max: 1, // For serverless, use connection pooling
    })

    // Create drizzle instance
    _db = drizzle(_client, { schema })
  }
  return _db
}

// Export database instance - connection is created on first use (not during build)
export const db = getDb()

// Export schema for use in other files
export * from './schema'

