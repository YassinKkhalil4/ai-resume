import test from 'node:test'
import assert from 'node:assert/strict'

test('TtlCache returns fresh entries and drops expired ones', async () => {
  const { TtlCache } = await import('../lib/ttl-cache')
  let now = 1000
  const cache = new TtlCache<string>(100, 10, () => now)
  cache.set('a', 'A')
  assert.equal(cache.get('a'), 'A')
  now += 101
  assert.equal(cache.get('a'), undefined)
})

test('TtlCache never grows beyond maxEntries', async () => {
  const { TtlCache } = await import('../lib/ttl-cache')
  const now = 0
  const cache = new TtlCache<number>(60_000, 3, () => now)
  for (let i = 0; i < 10; i++) cache.set(`k${i}`, i)
  assert.equal(cache.size, 3)
  assert.equal(cache.get('k9'), 9) // newest survive
  assert.equal(cache.get('k0'), undefined)
})
