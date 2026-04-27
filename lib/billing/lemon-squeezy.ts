import crypto from 'crypto'
import {
  CREDIT_PACKAGE_DEFINITIONS,
  CreditPackageId,
  getCreditPackage,
  getExternalCheckoutLink,
  isCreditPackageId,
} from './checkout-links'

export const LEMON_PROVIDER = 'lemon_squeezy'

export function verifyLemonWebhookSignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!signature || !secret) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected, 'utf8')
  const receivedBuffer = Buffer.from(signature, 'utf8')

  if (expectedBuffer.length !== receivedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function buildLemonCheckoutUrl(packageId: CreditPackageId, user: { id: string; email?: string | null }): string | null {
  const baseLink = getExternalCheckoutLink(packageId)
  const pkg = getCreditPackage(packageId)
  if (!baseLink || !pkg) return null

  try {
    const url = new URL(baseLink)
    url.searchParams.set('checkout[custom][user_id]', user.id)
    url.searchParams.set('checkout[custom][package_id]', packageId)
    if (user.email) {
      url.searchParams.set('checkout[email]', user.email)
    }
    return url.toString()
  } catch {
    return null
  }
}

export function getCreditsForVariantId(variantId: string | number | null | undefined): number | null {
  if (variantId === null || variantId === undefined) return null
  const normalized = String(variantId)
  const match = CREDIT_PACKAGE_DEFINITIONS.find((pkg) => {
    const configuredVariant = process.env[pkg.lemonVariantEnv]
    return configuredVariant && configuredVariant === normalized
  })

  return match?.credits ?? null
}

export function getPackageForVariantId(variantId: string | number | null | undefined) {
  if (variantId === null || variantId === undefined) return null
  const normalized = String(variantId)
  return CREDIT_PACKAGE_DEFINITIONS.find((pkg) => process.env[pkg.lemonVariantEnv] === normalized) || null
}

export function parseLemonPayload(rawBody: string): any {
  return JSON.parse(rawBody)
}

export function getLemonEventName(payload: any): string {
  return String(payload?.meta?.event_name || '')
}

export function getLemonEventKey(payload: any): string {
  const eventName = getLemonEventName(payload) || 'unknown'
  const eventId = payload?.meta?.event_id || payload?.data?.id || crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  return `${eventName}:${eventId}`
}

export function getLemonOrderId(payload: any): string | null {
  const data = payload?.data
  const attributes = data?.attributes
  const id = data?.id || attributes?.identifier || attributes?.order_number
  return id ? String(id) : null
}

export function getLemonVariantId(payload: any): string | null {
  const attributes = payload?.data?.attributes
  const firstOrderItem = attributes?.first_order_item
  const variantId =
    firstOrderItem?.variant_id ||
    attributes?.variant_id ||
    payload?.meta?.custom_data?.variant_id

  return variantId === undefined || variantId === null ? null : String(variantId)
}

export function getLemonUserId(payload: any): string | null {
  const userId = payload?.meta?.custom_data?.user_id
  return typeof userId === 'string' && userId.trim() ? userId.trim() : null
}

export function getLemonOrderStatus(payload: any): string {
  return String(payload?.data?.attributes?.status || '').toLowerCase()
}

export function getLemonCustomerId(payload: any): string | null {
  const attributes = payload?.data?.attributes
  const customerId = attributes?.customer_id || attributes?.customer?.id
  return customerId === undefined || customerId === null ? null : String(customerId)
}

export function getLemonAmount(payload: any): string {
  const attributes = payload?.data?.attributes || {}
  const amountCents = Number(attributes.total ?? attributes.total_usd ?? attributes.subtotal ?? 0)
  if (Number.isFinite(amountCents) && amountCents > 0) {
    return (amountCents / 100).toFixed(2)
  }

  const formatted = String(attributes.total_formatted || attributes.total_usd_formatted || '').replace(/[^0-9.]/g, '')
  return formatted || '0.00'
}

export function assertValidPackageId(packageId: string): asserts packageId is CreditPackageId {
  if (!isCreditPackageId(packageId)) {
    throw new Error('Invalid credit package')
  }
}
