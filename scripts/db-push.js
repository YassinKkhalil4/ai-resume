#!/usr/bin/env node
import { config } from 'dotenv'
import { resolve } from 'path'
import { execSync } from 'child_process'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

let databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env.local')
  process.exit(1)
}

// Clean up the connection string - remove any quotes or extra commands
databaseUrl = databaseUrl.trim()
// Remove surrounding quotes if present
databaseUrl = databaseUrl.replace(/^["']|["']$/g, '')
// Remove psql command prefix if accidentally included
databaseUrl = databaseUrl.replace(/^psql\s+['"]?/, '')
databaseUrl = databaseUrl.replace(/['"]$/, '')

// Validate connection string format
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('❌ DATABASE_URL must start with postgresql:// or postgres://')
  console.error('   Current value starts with:', databaseUrl.substring(0, 30))
  console.error('\n   Your .env.local should have:')
  console.error('   DATABASE_URL=postgresql://user:password@host:port/database')
  console.error('\n   For Neon, it should look like:')
  console.error('   DATABASE_URL=postgresql://user:pass@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require')
  process.exit(1)
}

console.log('✅ Loaded DATABASE_URL from .env.local')
console.log('🚀 Pushing schema to database...\n')

try {
  // Use drizzle-kit push with the config file (which now loads .env.local)
  execSync(
    `drizzle-kit push`,
    { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl }
    }
  )
} catch (error) {
  console.error('\n❌ Failed to push schema to database')
  console.error('   Check your DATABASE_URL in .env.local')
  process.exit(1)
}

