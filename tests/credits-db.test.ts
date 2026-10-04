import test, { after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createUser, dbSkip, giveCredits, resetDb } from './helpers/db'

process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = 'whsec_test'
process.env.LEMON_SQUEEZY_VARIANT_STARTER = 'variant_starter'

const opts = { skip: dbSkip }

beforeEach(async () => {
  if (!dbSkip) await resetDb()
})

after(async () => {
  if (!dbSkip) await (await import('../lib/db')).closeDb()
})

async function balance(userId: string) {
  const { getUserCredits } = await import('../lib/auth/utils')
  return getUserCredits(userId)
}

async function cachedBalance(userId: string) {
  const { db, users } = await import('../lib/db')
  const { eq } = await import('drizzle-orm')
  return (await db.query.users.findFirst({ where: eq(users.id, userId) }))!.creditsRemaining
}

test('reserveCredit spends the soonest-expiring lot first and ignores expired lots', opts, async () => {
  const { reserveCredit } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  await giveCredits(user.id, 1, -1) // expired yesterday
  const soon = await giveCredits(user.id, 1, 10)
  await giveCredits(user.id, 1, 300)

  const r = await reserveCredit(user.id, 'hash')
  assert.equal(r.lotId, soon.id)
  assert.equal(await balance(user.id), 1)
})

test('reserveCredit throws NoCreditsError when nothing is spendable', opts, async () => {
  const { reserveCredit, NoCreditsError } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  await giveCredits(user.id, 1, -1)
  await assert.rejects(reserveCredit(user.id), NoCreditsError)
})

test('releaseCreditReservation restores the credit', opts, async () => {
  const { reserveCredit, releaseCreditReservation } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  await giveCredits(user.id, 1)
  const r = await reserveCredit(user.id)
  assert.equal(await balance(user.id), 0)
  await releaseCreditReservation(r)
  assert.equal(await balance(user.id), 1)
})

test('admins are never charged', opts, async () => {
  const { reserveCredit } = await import('../lib/billing/deduct-credit')
  const admin = await createUser({ isAdmin: true })
  const r = await reserveCredit(admin.id)
  assert.equal(r.admin, true)
})

test('setUserCredits grants credits that are actually spendable', opts, async () => {
  const { setUserCredits, reserveCredit } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  assert.deepEqual(await setUserCredits(user.id, 3), { before: 0, after: 3 })
  assert.equal(await balance(user.id), 3)
  assert.equal(await cachedBalance(user.id), 3)
  await reserveCredit(user.id) // proves the grant lives in a lot, not just the cache column
  assert.equal(await balance(user.id), 2)
})

test('setUserCredits reduces balance across lots and can zero it', opts, async () => {
  const { setUserCredits } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  await giveCredits(user.id, 2, 10)
  await giveCredits(user.id, 4, 300)
  assert.deepEqual(await setUserCredits(user.id, 1), { before: 6, after: 1 })
  assert.equal(await balance(user.id), 1)
  assert.equal(await cachedBalance(user.id), 1)
  assert.deepEqual(await setUserCredits(user.id, 0), { before: 1, after: 0 })
  assert.equal(await balance(user.id), 0)
})

test('setUserCredits rejects negative and non-integer targets', opts, async () => {
  const { setUserCredits } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  await assert.rejects(setUserCredits(user.id, -1), /integer/)
  await assert.rejects(setUserCredits(user.id, 1.5), /integer/)
})

// ---- Lemon Squeezy webhook ----

async function post(payload: any) {
  const { NextRequest } = await import('next/server')
  const { POST } = await import('../app/api/billing/webhook/route')
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', 'whsec_test').update(body).digest('hex')
  const res = await POST(new NextRequest('http://localhost/api/billing/webhook', { method: 'POST', body, headers: { 'x-signature': signature } }))
  return { status: res.status, json: await res.json() }
}

const orderCreated = (userId: string, orderId: string, eventId: string) => ({
  meta: { event_name: 'order_created', event_id: eventId, custom_data: { user_id: userId } },
  data: { id: orderId, attributes: { status: 'paid', total: 900, customer_id: 77, first_order_item: { variant_id: 'variant_starter' } } },
})

const orderRefunded = (orderId: string, eventId: string) => ({
  meta: { event_name: 'order_refunded', event_id: eventId },
  data: { id: orderId, attributes: { status: 'refunded' } },
})

test('webhook credits a paid order exactly once even with a replay under a new event id', opts, async () => {
  const user = await createUser()
  const first = await post(orderCreated(user.id, 'order_1', 'evt_1'))
  assert.equal(first.status, 200)
  assert.equal(await balance(user.id), 5)

  const replay = await post(orderCreated(user.id, 'order_1', 'evt_2'))
  assert.equal(replay.status, 200)
  assert.equal(replay.json.duplicate, true)
  assert.equal(await balance(user.id), 5)
})

test('webhook with a malformed user id goes to manual review instead of 500 (which Lemon would retry forever)', opts, async () => {
  const res = await post(orderCreated('not-a-uuid', 'order_2', 'evt_3'))
  assert.equal(res.status, 200)
  assert.equal(res.json.manualReview, true)
})

test('refund revokes unspent credits atomically and flags spent ones for review', opts, async () => {
  const { reserveCredit } = await import('../lib/billing/deduct-credit')
  const user = await createUser()
  await post(orderCreated(user.id, 'order_3', 'evt_4'))
  await reserveCredit(user.id) // user spends 1 of 5
  const res = await post(orderRefunded('order_3', 'evt_5'))
  assert.equal(res.status, 200)
  assert.equal(res.json.revokedCredits, 4)
  assert.equal(res.json.manualReview, true) // 1 credit already spent
  assert.equal(await balance(user.id), 0)
  assert.equal(await cachedBalance(user.id), 0)
})
