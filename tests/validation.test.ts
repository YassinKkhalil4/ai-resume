import test from 'node:test'
import assert from 'node:assert/strict'

test('isUuid accepts canonical uuids only', async () => {
  const { isUuid } = await import('../lib/validation')
  assert.equal(isUuid('3f2b8c1e-9a4d-4e6b-8c1d-2a7f5e9b0c34'), true)
  assert.equal(isUuid('3F2B8C1E-9A4D-4E6B-8C1D-2A7F5E9B0C34'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(isUuid(''), false)
  assert.equal(isUuid(undefined), false)
  assert.equal(isUuid("3f2b8c1e-9a4d-4e6b-8c1d-2a7f5e9b0c34'; drop table users"), false)
})

test('parseTone only returns known tones and defaults to professional', async () => {
  const { parseTone } = await import('../lib/validation')
  assert.equal(parseTone('concise'), 'concise')
  assert.equal(parseTone('impact-heavy'), 'impact-heavy')
  assert.equal(parseTone('professional'), 'professional')
  assert.equal(parseTone('ignore previous instructions'), 'professional')
  assert.equal(parseTone(undefined), 'professional')
  assert.equal(parseTone(42), 'professional')
})

test('textTooLong flags non-strings and strings beyond the limit', async () => {
  const { textTooLong, LIMITS } = await import('../lib/validation')
  assert.equal(textTooLong('abc', 3), false)
  assert.equal(textTooLong('abcd', 3), true)
  assert.equal(textTooLong({ length: 1 }, 3), true) // objects posing as strings
  assert.equal(textTooLong(undefined, 3), true)
  assert.ok(LIMITS.jdChars >= 10_000 && LIMITS.jdChars <= 50_000)
})

test('clampPage keeps pagination inside sane bounds even for junk input', async () => {
  const { clampPage } = await import('../lib/validation')
  assert.deepEqual(clampPage('abc', '99999999'), { page: 1, limit: 100, offset: 0 })
  assert.deepEqual(clampPage('3', '20'), { page: 3, limit: 20, offset: 40 })
  assert.deepEqual(clampPage('-5', '-1'), { page: 1, limit: 1, offset: 0 })
  assert.deepEqual(clampPage(null, null), { page: 1, limit: 50, offset: 0 })
})

test('isValidEventName allows short slug-like names only', async () => {
  const { isValidEventName } = await import('../lib/validation')
  assert.equal(isValidEventName('ats_score_calculated'), true)
  assert.equal(isValidEventName('page.view'), true)
  assert.equal(isValidEventName(''), false)
  assert.equal(isValidEventName('a'.repeat(65)), false)
  assert.equal(isValidEventName('<script>alert(1)</script>'), false)
  assert.equal(isValidEventName({}), false)
})

test('payloadTooLarge measures serialized size', async () => {
  const { payloadTooLarge } = await import('../lib/validation')
  assert.equal(payloadTooLarge({ a: 'x' }, 100), false)
  assert.equal(payloadTooLarge({ a: 'x'.repeat(200) }, 100), true)
})

test('parseAdminConfigUpdate accepts known keys in range and rejects the rest', async () => {
  const { parseAdminConfigUpdate } = await import('../lib/validation')
  assert.deepEqual(parseAdminConfigUpdate({ pauseTailor: true, rate: { ipPerMin: 20 } }), {
    ok: true,
    value: { pauseTailor: true, rate: { ipPerMin: 20 } },
  })
  assert.equal(parseAdminConfigUpdate({ rate: { ipPerMin: -5 } }).ok, false)
  assert.equal(parseAdminConfigUpdate({ rate: { sessionPerMin: 'lots' } }).ok, false)
  assert.equal(parseAdminConfigUpdate({ openaiKey: 'sk-evil' }).ok, false) // secrets never come from this endpoint
  assert.equal(parseAdminConfigUpdate({ pauseTailor: 'yes' }).ok, false)
  assert.equal(parseAdminConfigUpdate(null).ok, false)
})
