import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _client: ReturnType<typeof postgres> | null = null

function getDb() {
  // Skip database connection during build/static generation
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build') {
    // Return a mock db object during build to prevent connection attempts
    return {} as ReturnType<typeof drizzle<typeof schema>>
  }

  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    // Create postgres connection
    const connectionString = process.env.DATABASE_URL
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

