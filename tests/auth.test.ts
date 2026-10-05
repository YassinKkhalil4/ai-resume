import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { createUser, dbSkip, resetDb } from './helpers/db'
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

test('normalizeEmail trims and lowercases', async () => {
  const { normalizeEmail } = await import('../lib/auth/email')
  assert.equal(normalizeEmail('  Foo.Bar@Example.COM '), 'foo.bar@example.com')
  assert.equal(normalizeEmail(undefined as any), '')
})

test('validatePassword enforces type and 8..72 byte length', async () => {
  const { validatePassword } = await import('../lib/auth/password')
  assert.deepEqual(validatePassword('longenough'), { ok: true })
  assert.equal(validatePassword('short').ok, false)
  assert.equal(validatePassword(12345678 as any).ok, false)
  assert.equal(validatePassword('x'.repeat(73)).ok, false) // bcrypt silently truncates beyond 72 bytes
  assert.equal(validatePassword('é'.repeat(37)).ok, false) // 74 bytes
})

test('verification codes are six digits', opts, async () => {
  const { generateVerificationToken } = await import('../lib/auth/verification')
  const user = await createUser({ emailVerified: false })
  const { code } = await generateVerificationToken(user.id, 'code')
  assert.match(code!, /^\d{6}$/)
})

test('a verification code works once', opts, async () => {
  const { generateVerificationToken, validateVerificationCode } = await import('../lib/auth/verification')
  const user = await createUser({ emailVerified: false })
  const { code } = await generateVerificationToken(user.id, 'code')
  assert.equal((await validateVerificationCode(user.id, code!)).valid, true)
  assert.equal((await validateVerificationCode(user.id, code!)).valid, false)
})

test('guessing wrong codes is limited, and the limit blocks even the right code', opts, async () => {
  const { generateVerificationToken, validateVerificationCode } = await import('../lib/auth/verification')
  const user = await createUser({ emailVerified: false })
  const { code } = await generateVerificationToken(user.id, 'code')
  const wrong = code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) {
    const r = await validateVerificationCode(user.id, wrong)
    assert.equal(r.valid, false)
  }
  const blocked = await validateVerificationCode(user.id, code!)
  assert.equal(blocked.valid, false)
  assert.equal((blocked as any).rateLimited, true)
})

test('findUserByEmail is case-insensitive even for legacy mixed-case rows', opts, async () => {
  const { findUserByEmail } = await import('../lib/auth/users')
  const user = await createUser({ email: 'Mixed.Case@Example.com' })
  assert.equal((await findUserByEmail('mixed.case@example.COM'))?.id, user.id)
  assert.equal(await findUserByEmail('other@example.com'), null)
})

test('google sign-in over an unverified password account removes the (possibly attacker-set) password', opts, async () => {
  const { authOptions } = await import('../lib/auth/config')
  const { db, users } = await import('../lib/db')
  const { eq } = await import('drizzle-orm')
  const victim = await createUser({ email: 'victim@example.com', emailVerified: false, passwordHash: 'attacker-chosen-hash' })

  const user: any = { email: 'victim@example.com' }
  const ok = await authOptions.callbacks!.signIn!({ user, account: { provider: 'google' } as any, profile: { email_verified: true } as any } as any)
  assert.equal(ok, true)

  const after = await db.query.users.findFirst({ where: eq(users.id, victim.id) })
  assert.equal(after!.emailVerified, true)
  assert.equal(after!.passwordHash, null)
})

test('google sign-in is refused when Google has not verified the email', opts, async () => {
  const { authOptions } = await import('../lib/auth/config')
  const user: any = { email: 'someone@example.com' }
  const ok = await authOptions.callbacks!.signIn!({ user, account: { provider: 'google' } as any, profile: { email_verified: false } as any } as any)
  assert.equal(ok, false)
})

test('change-password answers 401 (not 500) when nobody is signed in', async () => {
  const { POST } = await import('../app/api/auth/change-password/route')
  const res = await POST(new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword: 'a', newPassword: 'bbbbbbbb' }),
  }))
  assert.equal(res.status, 401)
})

async function signup(email: unknown, password: unknown, ip = '9.9.9.9') {
  const { POST } = await import('../app/api/auth/signup/route')
  const res = await POST(new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'x-real-ip': ip },
    body: JSON.stringify({ email, password }),
  }))
  return { status: res.status, json: await res.json() }
}

test('signup stores a lowercase email and treats case variants as the same account', opts, async () => {
  const first = await signup('  New.User@Example.com ', 'correct horse battery')
  assert.equal(first.status, 200)
  assert.equal(first.json.user.email, 'new.user@example.com')

  const dup = await signup('NEW.USER@example.com', 'another password')
  assert.equal(dup.status, 409)
})

test('signup rejects weak passwords and malformed emails', opts, async () => {
  assert.equal((await signup('a@example.com', 'short')).status, 400)
  assert.equal((await signup('not-an-email', 'long enough pw')).status, 400)
  assert.equal((await signup('a@example.com', { not: 'a string' })).status, 400)
})

test('signup is rate limited per client address', opts, async () => {
  for (let i = 0; i < 5; i++) {
    assert.equal((await signup(`user${i}@example.com`, 'long enough pw', '7.7.7.7')).status, 200)
  }
  assert.equal((await signup('user6@example.com', 'long enough pw', '7.7.7.7')).status, 429)
  assert.equal((await signup('user7@example.com', 'long enough pw', '6.6.6.6')).status, 200)
})

// ---- a Redis outage must not lock people out of auth ----

test('checkNamedRateLimit fails open only when asked to, and closed by default', async () => {
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(null) // Redis unavailable
  const { checkNamedRateLimit } = await import('../lib/rate-limiter')
  assert.equal((await checkNamedRateLimit('x', 'y', 1, 1000)).allowed, false)
  assert.equal((await checkNamedRateLimit('x', 'y', 1, 1000, { failOpen: true })).allowed, true)
})

test('signup still works while Redis is down', opts, async () => {
  const { setRedisClientForTesting } = await import('../lib/redis')
  setRedisClientForTesting(null)
  const res = await signup('outage.user@example.com', 'long enough pw', '3.3.3.3')
  assert.equal(res.status, 200)
})

test('login still works while Redis is down', opts, async () => {
  const bcrypt = (await import('bcryptjs')).default
  const { setRedisClientForTesting } = await import('../lib/redis')
  const { authOptions } = await import('../lib/auth/config')
  const user = await createUser({ email: 'login.user@example.com', passwordHash: await bcrypt.hash('correct horse', 10) })
  setRedisClientForTesting(null)
  const authorize = (authOptions.providers[0] as any).options.authorize
  const result = await authorize({ email: 'Login.User@Example.com', password: 'correct horse' }, { headers: {} })
  assert.equal(result?.id, user.id)
})

test('login throttling still applies when Redis is up', opts, async () => {
  const bcrypt = (await import('bcryptjs')).default
  const { authOptions } = await import('../lib/auth/config')
  await createUser({ email: 'throttle.user@example.com', passwordHash: await bcrypt.hash('right password', 10) })
  const authorize = (authOptions.providers[0] as any).options.authorize
  for (let i = 0; i < 10; i++) {
    assert.equal(await authorize({ email: 'throttle.user@example.com', password: 'wrong' }, { headers: {} }), null)
  }
  // the 11th attempt is throttled even with the right password
  assert.equal(await authorize({ email: 'throttle.user@example.com', password: 'right password' }, { headers: {} }), null)
})
