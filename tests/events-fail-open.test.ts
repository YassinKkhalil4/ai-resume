import test from 'node:test'
import assert from 'node:assert/strict'

// Without Redis the limiter reports "unavailable". Telemetry must be dropped quietly in that case:
// a failed analytics call should never surface as a 503 in the browser, and nothing may be stored.
process.env.USE_REDIS_SESSIONS = 'false'
process.env.USE_REDIS_RATE_LIMIT = 'false'
process.env.USE_AI_QUEUE = 'false'

function eventRequest(NextRequest: typeof import('next/server').NextRequest, body: unknown) {
  return new NextRequest('http://localhost/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5' },
    body: JSON.stringify(body),
  })
}

test('POST /api/events answers 202, not 503, when the rate limiter is unavailable', async () => {
  const { NextRequest } = await import('next/server')
  const { POST } = await import('../app/api/events/route')
  const res = await POST(eventRequest(NextRequest, { eventName: 'page_view' }))
  assert.equal(res.status, 202)
  assert.equal(await res.text(), '')
})

test('the limiter itself still fails closed for everything else', async () => {
  const { checkNamedRateLimit } = await import('../lib/rate-limiter')
  const result = await checkNamedRateLimit('login:email', 'someone@example.com', 10, 15 * 60 * 1000)
  assert.equal(result.allowed, false)
  assert.equal(result.error?.status, 503)
})
