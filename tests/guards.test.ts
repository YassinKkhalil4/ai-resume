import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { createFakeRedis } from './helpers/fake-redis'

const req = (headers: Record<string, string>) => new NextRequest('http://localhost/api/x', { headers })

beforeEach(async () => {
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(createFakeRedis())
})

test('cookieless requests from different IPs get different rate-limit session keys', async () => {
  const { rateLimitSessionKey } = await import('../lib/guards')
  const a = rateLimitSessionKey(req({ 'x-real-ip': '8.8.8.8' }))
  const b = rateLimitSessionKey(req({ 'x-real-ip': '1.1.1.1' }))
  assert.notEqual(a, b)
})

test('the sid cookie takes priority over the IP', async () => {
  const { rateLimitSessionKey } = await import('../lib/guards')
  const key = rateLimitSessionKey(req({ 'x-real-ip': '8.8.8.8', cookie: 'sid=abc123' }))
  assert.equal(key, 'sid:abc123')
})

test('one anonymous client cannot exhaust another client\'s session budget', async () => {
  const { enforceGuards } = await import('../lib/guards')
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(createFakeRedis())
  // default sessionPerMin is 5: burn it for client A
  for (let i = 0; i < 5; i++) {
    assert.equal((await enforceGuards(req({ 'x-real-ip': '8.8.8.8' }))).ok, true)
  }
  assert.equal((await enforceGuards(req({ 'x-real-ip': '8.8.8.8' }))).ok, false)
  // client B is unaffected
  assert.equal((await enforceGuards(req({ 'x-real-ip': '1.1.1.1' }))).ok, true)
})
