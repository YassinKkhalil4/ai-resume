import test from 'node:test'
import assert from 'node:assert/strict'

test('importing lib/db does not require a database; first use does', async () => {
  const saved: Record<string, string | undefined> = {}
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'NEON_DATABASE_URL', 'SUPABASE_DB_URL']) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  try {
    const mod = await import('../lib/db')
    assert.ok(mod.db, 'db export exists at import time')
    assert.ok(mod.users, 'schema is re-exported')
    assert.throws(() => (mod.db as any).select, /Database connection environment variable is not set/)
  } finally {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v
  }
})
