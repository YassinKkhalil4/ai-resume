import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { dbSkip, resetDb } from './helpers/db'
import { createFakeRedis } from './helpers/fake-redis'

const opts = { skip: dbSkip }

beforeEach(async () => {
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(createFakeRedis())
  if (!dbSkip) await resetDb()
})

after(async () => {
  if (!dbSkip) await (await import('../lib/db')).closeDb()
})

const post = (url: string, body: unknown, ip = '5.5.5.5') =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', headers: { 'x-real-ip': ip }, body: JSON.stringify(body) })

const contact = { name: 'Ada', email: 'ada@example.com', subject: 'support', message: 'hello' }

test('contact form rejects oversized messages', opts, async () => {
  const { POST } = await import('../app/api/contact/route')
  const res = await POST(post('/api/contact', { ...contact, message: 'x'.repeat(5001) }))
  assert.equal(res.status, 413)
})

test('contact form is rate limited per client address', opts, async () => {
  const { POST } = await import('../app/api/contact/route')
  for (let i = 0; i < 5; i++) assert.equal((await POST(post('/api/contact', contact))).status, 200)
  assert.equal((await POST(post('/api/contact', contact))).status, 429)
  assert.equal((await POST(post('/api/contact', contact, '4.4.4.4'))).status, 200)
})

test('events endpoint rejects junk event names and oversized payloads', opts, async () => {
  const { POST } = await import('../app/api/events/route')
  assert.equal((await POST(post('/api/events', { eventName: '<script>' }))).status, 400)
  assert.equal((await POST(post('/api/events', { eventName: 'page_view', properties: { blob: 'x'.repeat(5000) } }))).status, 413)
  assert.equal((await POST(post('/api/events', { eventName: 'page_view', properties: { path: '/' } }))).status, 200)
})

test('events endpoint is rate limited per client address', opts, async () => {
  const { POST } = await import('../app/api/events/route')
  for (let i = 0; i < 60; i++) assert.equal((await POST(post('/api/events', { eventName: 'page_view' }))).status, 200)
  assert.equal((await POST(post('/api/events', { eventName: 'page_view' }))).status, 429)
})
