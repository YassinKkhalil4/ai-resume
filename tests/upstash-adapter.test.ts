import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeUpstash } from './helpers/fake-upstash'

let fake: ReturnType<typeof installFakeUpstash>

async function upstashAdapter() {
  const { createUpstashAdapter } = await import('../lib/redis')
  const { Redis } = await import('@upstash/redis')
  return createUpstashAdapter(new Redis({ url: 'https://fake.upstash.test', token: 'test-token' }))
}

beforeEach(async () => {
  fake = installFakeUpstash()
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(await upstashAdapter())
})

afterEach(async () => {
  fake.restore()
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(null)
})

test('the rate limiter works through the real Upstash client (zadd used a signature Upstash rejects)', async () => {
  const { checkNamedRateLimit } = await import('../lib/rate-limiter')
  for (let i = 0; i < 3; i++) {
    const r = await checkNamedRateLimit('probe', 'client-a', 3, 60_000)
    assert.equal(r.allowed, true, `request ${i + 1} should be allowed`)
  }
  const blocked = await checkNamedRateLimit('probe', 'client-a', 3, 60_000)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.error?.status, 429, 'over the limit is a 429, not a 503')
  assert.equal((await checkNamedRateLimit('probe', 'client-b', 3, 60_000)).allowed, true)
})

test('sessions round-trip through Upstash (it auto-parses JSON, which broke JSON.parse in getSession)', async () => {
  const { createSession, getOwnedSession } = await import('../lib/sessions')
  const original = { summary: 's', skills: [], experience: [], education: [], certifications: [] } as any
  const tailored = { summary: 't', skills_section: [], experience: [] } as any
  const s = await createSession(original, tailored, 'jd', {} as any, 'raw', 'user-1')
  const loaded = await getOwnedSession(s.id, 'user-1')
  assert.equal(loaded?.id, s.id)
  assert.equal(loaded?.jdText, 'jd')
})

test('set with an expiry works through Upstash', async () => {
  const { testRedisConnection } = await import('../lib/redis')
  assert.equal(await testRedisConnection(), true)
})

test('admin config is stored as a JSON string and reads back intact', async () => {
  const { saveConfig, getDefaultConfig } = await import('../lib/config')
  const { getRedisClient } = await import('../lib/redis')
  await saveConfig({ ...getDefaultConfig(), pauseTailor: true })
  const raw = await getRedisClient()!.get('rolefit:app_config')
  assert.equal(typeof raw, 'string')
  assert.equal(JSON.parse(raw!).pauseTailor, true)
})
