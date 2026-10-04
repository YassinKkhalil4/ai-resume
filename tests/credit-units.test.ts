import test from 'node:test'
import assert from 'node:assert/strict'

test('planDeduction takes from lots in order and never over-takes', async () => {
  const { planDeduction } = await import('../lib/billing/credit-plan')
  const lots = [
    { id: 'a', creditsRemaining: 2 },
    { id: 'b', creditsRemaining: 5 },
    { id: 'c', creditsRemaining: 9 },
  ]
  assert.deepEqual(planDeduction(lots, 4), [{ id: 'a', take: 2 }, { id: 'b', take: 2 }])
  assert.deepEqual(planDeduction(lots, 0), [])
  // asking for more than exists returns everything, caller compares totals
  const all = planDeduction(lots, 100)
  assert.equal(all.reduce((n, p) => n + p.take, 0), 16)
})

test('planDeduction skips empty lots', async () => {
  const { planDeduction } = await import('../lib/billing/credit-plan')
  assert.deepEqual(planDeduction([{ id: 'a', creditsRemaining: 0 }, { id: 'b', creditsRemaining: 3 }], 2), [{ id: 'b', take: 2 }])
})

function makeDeps() {
  const calls: string[] = []
  return {
    calls,
    deps: {
      reserve: async () => { calls.push('reserve'); return { userId: 'u', lotId: 'l', admin: false } },
      commit: async (_r: any, tokens?: number) => { calls.push(`commit:${tokens}`) },
      release: async () => { calls.push('release') },
    },
  }
}

test('withCreditReservation commits after successful work and returns its result', async () => {
  const { withCreditReservation } = await import('../lib/billing/with-credit')
  const { calls, deps } = makeDeps()
  const out = await withCreditReservation('u', 'h', async () => ({ result: 'ok', tokens: 42 }), deps)
  assert.equal(out, 'ok')
  assert.deepEqual(calls, ['reserve', 'commit:42'])
})

test('withCreditReservation releases and rethrows when work fails', async () => {
  const { withCreditReservation } = await import('../lib/billing/with-credit')
  const { calls, deps } = makeDeps()
  await assert.rejects(
    withCreditReservation('u', 'h', async () => { throw new Error('boom') }, deps),
    /boom/
  )
  assert.deepEqual(calls, ['reserve', 'release'])
})

test('withCreditReservation releases without charging when work opts out', async () => {
  const { withCreditReservation } = await import('../lib/billing/with-credit')
  const { calls, deps } = makeDeps()
  const out = await withCreditReservation('u', 'h', async () => ({ result: 'nothing', charge: false }), deps)
  assert.equal(out, 'nothing')
  assert.deepEqual(calls, ['reserve', 'release'])
})

test('a failed usage-log commit does not release the credit or fail the request', async () => {
  const { withCreditReservation } = await import('../lib/billing/with-credit')
  const { calls, deps } = makeDeps()
  deps.commit = async () => { calls.push('commit-failed'); throw new Error('db down') }
  const out = await withCreditReservation('u', 'h', async () => ({ result: 'ok', tokens: 1 }), deps)
  assert.equal(out, 'ok')
  assert.deepEqual(calls, ['reserve', 'commit-failed'])
})

test('withCreditReservation does not run work when reserving fails', async () => {
  const { withCreditReservation } = await import('../lib/billing/with-credit')
  const { NoCreditsError } = await import('../lib/billing/deduct-credit')
  let ran = false
  const deps = {
    reserve: async () => { throw new NoCreditsError() },
    commit: async () => {},
    release: async () => {},
  }
  await assert.rejects(withCreditReservation('u', 'h', async () => { ran = true; return { result: 1 } }, deps), NoCreditsError)
  assert.equal(ran, false)
})
