import test from 'node:test'
import assert from 'node:assert/strict'

test('getRedisClient returns an injected test client and clears back to env resolution', async () => {
  const { getRedisClient, setRedisClientForTesting } = await import('../lib/redis')
  const { createFakeRedis } = await import('./helpers/fake-redis')
  const fake = createFakeRedis()

  setRedisClientForTesting(fake)
  assert.equal(getRedisClient(), fake)

  setRedisClientForTesting(null)
  assert.notEqual(getRedisClient(), fake)
})

test('fake redis honours setex expiry and sorted-set window removal', async () => {
  const { createFakeRedis } = await import('./helpers/fake-redis')
  const r = createFakeRedis()
  await r.setex('k', 100, 'v')
  assert.equal(await r.get('k'), 'v')
  assert.ok((await r.ttl('k')) > 0)

  await r.zadd('z', 1, 'a')
  await r.zadd('z', 5, 'b')
  assert.equal(await r.zremrangebyscore('z', 0, 2), 1)
  assert.equal(await r.zcard('z'), 1)
})
