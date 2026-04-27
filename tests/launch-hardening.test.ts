import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

process.env.NEXT_PUBLIC_CHECKOUT_LINK_STARTER = 'https://checkout.lemonsqueezy.com/buy/starter'
process.env.LEMON_SQUEEZY_VARIANT_STARTER = 'variant_starter'

test('verifies Lemon Squeezy webhook signatures', async () => {
  const { verifyLemonWebhookSignature } = await import('../lib/billing/lemon-squeezy')
  const body = JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: 'order_1' } })
  const signature = crypto.createHmac('sha256', 'secret').update(body).digest('hex')

  assert.equal(verifyLemonWebhookSignature(body, signature, 'secret'), true)
  assert.equal(verifyLemonWebhookSignature(body, 'bad-signature', 'secret'), false)
})

test('builds logged-in Lemon checkout URLs with custom credit metadata', async () => {
  const { buildLemonCheckoutUrl } = await import('../lib/billing/lemon-squeezy')
  const checkoutUrl = buildLemonCheckoutUrl('price_5_credits', {
    id: 'user_123',
    email: 'buyer@example.com',
  })

  assert.ok(checkoutUrl)
  const url = new URL(checkoutUrl!)
  assert.equal(url.searchParams.get('checkout[custom][user_id]'), 'user_123')
  assert.equal(url.searchParams.get('checkout[custom][package_id]'), 'price_5_credits')
  assert.equal(url.searchParams.get('checkout[email]'), 'buyer@example.com')
})

test('resolves credits from Lemon variant ids only from server configuration', async () => {
  const { getCreditsForVariantId } = await import('../lib/billing/lemon-squeezy')

  assert.equal(getCreditsForVariantId('variant_starter'), 5)
  assert.equal(getCreditsForVariantId('unknown_variant'), null)
})

test('validates resume upload file type and size', async () => {
  const { validateResumeUpload } = await import('../lib/parsers')

  assert.deepEqual(validateResumeUpload(new File(['resume text'], 'resume.txt', { type: 'text/plain' })), { ok: true })

  const invalid = validateResumeUpload(new File(['not a resume'], 'resume.exe', { type: 'application/octet-stream' }))
  assert.equal(invalid.ok, false)
  if (!invalid.ok) {
    assert.equal(invalid.code, 'unsupported_file_type')
  }
})

test('blocks private-network job description targets', async () => {
  const { isPrivateNetworkAddress, validateUrl } = await import('../lib/jd')

  assert.equal(isPrivateNetworkAddress('10.0.0.5'), true)
  assert.equal(isPrivateNetworkAddress('169.254.169.254'), true)
  assert.equal(isPrivateNetworkAddress('8.8.8.8'), false)
  assert.throws(() => validateUrl('http://localhost/jobs'), /localhost/i)
})

test('extracts raw text for TXT resumes used by parse-resume responses', async () => {
  const { extractTextFromFile } = await import('../lib/parsers')

  const parsed = await extractTextFromFile(new File(['Hello resume'], 'resume.txt', { type: 'text/plain' }))
  assert.equal(parsed.text, 'Hello resume')
  assert.equal(parsed.ext, 'txt')
})
