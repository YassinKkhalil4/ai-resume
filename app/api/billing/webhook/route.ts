import { NextRequest, NextResponse } from 'next/server'
import { and, eq, sql } from 'drizzle-orm'
import { db, users, creditTransactions, creditLots, webhookLogs } from '../../../../lib/db'
import { trackEvent, getContext } from '../../../../lib/analytics/tracker'
import {
  getCreditsForVariantId,
  getLemonAmount,
  getLemonCustomerId,
  getLemonEventKey,
  getLemonEventName,
  getLemonOrderId,
  getLemonOrderStatus,
  getLemonUserId,
  getLemonVariantId,
  LEMON_PROVIDER,
  parseLemonPayload,
  verifyLemonWebhookSignature,
} from '../../../../lib/billing/lemon-squeezy'

export const runtime = 'nodejs'

async function markWebhookProcessed(logId: string, manualReviewReason?: string | null) {
  await db
    .update(webhookLogs)
    .set({ processed: true, manualReviewReason: manualReviewReason || null })
    .where(eq(webhookLogs.id, logId))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature')

  if (!verifyLemonWebhookSignature(rawBody, signature, process.env.LEMON_SQUEEZY_WEBHOOK_SECRET)) {
    return NextResponse.json(
      { code: 'invalid_signature', message: 'Invalid Lemon Squeezy webhook signature' },
      { status: 400 }
    )
  }

  let payload: any
  try {
    payload = parseLemonPayload(rawBody)
  } catch {
    return NextResponse.json(
      { code: 'invalid_payload', message: 'Invalid webhook payload' },
      { status: 400 }
    )
  }

  const eventName = getLemonEventName(payload)
  const providerEventKey = getLemonEventKey(payload)
  const eventId = String(payload?.meta?.event_id || payload?.data?.id || providerEventKey)

  const existingLog = await db.query.webhookLogs.findFirst({
    where: and(
      eq(webhookLogs.provider, LEMON_PROVIDER),
      eq(webhookLogs.providerEventKey, providerEventKey)
    ),
  })

  if (existingLog?.processed) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
  }

  const [webhookLog] = existingLog
    ? [existingLog]
    : await db
        .insert(webhookLogs)
        .values({
          provider: LEMON_PROVIDER,
          eventId,
          providerEventKey,
          eventType: eventName || 'unknown',
          payload,
          processed: false,
        })
        .returning()

  try {
    if (eventName === 'order_created') {
      const status = getLemonOrderStatus(payload)
      if (status && status !== 'paid') {
        await markWebhookProcessed(webhookLog.id)
        return NextResponse.json({ received: true, ignored: true, status }, { status: 200 })
      }

      const userId = getLemonUserId(payload)
      const orderId = getLemonOrderId(payload)
      const variantId = getLemonVariantId(payload)
      const credits = getCreditsForVariantId(variantId)
      const customerId = getLemonCustomerId(payload)

      if (!userId || !orderId || !variantId || !credits) {
        await markWebhookProcessed(webhookLog.id, 'missing_user_order_or_variant_mapping')
        return NextResponse.json({ received: true, manualReview: true }, { status: 200 })
      }

      const amount = getLemonAmount(payload)

      const result = await db.transaction(async (tx) => {
        const existingTransaction = await tx.query.creditTransactions.findFirst({
          where: and(
            eq(creditTransactions.paymentProvider, LEMON_PROVIDER),
            eq(creditTransactions.providerOrderId, orderId)
          ),
        })

        if (existingTransaction) return { duplicate: true }

        const user = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        })

        if (!user) return { manualReviewReason: 'user_not_found' }

        const now = new Date()
        const expiresAt = new Date(now)
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)

        await tx.insert(creditTransactions).values({
          userId,
          stripePaymentId: null,
          paymentProvider: LEMON_PROVIDER,
          providerOrderId: orderId,
          providerCustomerId: customerId,
          providerVariantId: variantId,
          providerEventKey,
          creditsAdded: credits,
          amount,
        })

        await tx.insert(creditLots).values({
          userId,
          source: 'checkout',
          stripePaymentId: null,
          stripeInvoiceId: null,
          paymentProvider: LEMON_PROVIDER,
          providerOrderId: orderId,
          providerCustomerId: customerId,
          providerVariantId: variantId,
          providerEventKey,
          creditsTotal: credits,
          creditsRemaining: credits,
          expiresAt,
        })

        await tx
          .update(users)
          .set({
            billingProvider: LEMON_PROVIDER,
            providerCustomerId: customerId,
            creditsRemaining: sql`${users.creditsRemaining} + ${credits}`,
          })
          .where(eq(users.id, userId))

        return { credited: true }
      })

      await markWebhookProcessed(webhookLog.id, result.manualReviewReason)

      if (result.manualReviewReason) {
        return NextResponse.json({ received: true, manualReview: true }, { status: 200 })
      }

      if (!result.duplicate) {
        const context = getContext(req)
        await trackEvent(
          'checkout_completed',
          {
            provider: LEMON_PROVIDER,
            variantId,
            credits,
            amount,
            orderId,
          },
          context,
          userId
        )
      }

      return NextResponse.json({ received: true, duplicate: !!result.duplicate }, { status: 200 })
    }

    if (eventName === 'order_refunded') {
      const orderId = getLemonOrderId(payload)
      if (!orderId) {
        await markWebhookProcessed(webhookLog.id, 'missing_order_id_for_refund')
        return NextResponse.json({ received: true, manualReview: true }, { status: 200 })
      }

      const result = await db.transaction(async (tx) => {
        const lots = await tx.query.creditLots.findMany({
          where: and(
            eq(creditLots.paymentProvider, LEMON_PROVIDER),
            eq(creditLots.providerOrderId, orderId)
          ),
        })

        if (!lots.length) return { manualReviewReason: 'refund_without_credit_lot', revoked: 0 }

        const creditsGranted = lots.reduce((sum, lot) => sum + lot.creditsTotal, 0)
        let creditsToRevoke = creditsGranted
        let revoked = 0
        const userId = lots[0].userId

        for (const lot of lots) {
          if (creditsToRevoke <= 0) break
          const revokeFromLot = Math.min(lot.creditsRemaining, creditsToRevoke)
          if (revokeFromLot <= 0) continue

          await tx
            .update(creditLots)
            .set({ creditsRemaining: lot.creditsRemaining - revokeFromLot })
            .where(eq(creditLots.id, lot.id))

          revoked += revokeFromLot
          creditsToRevoke -= revokeFromLot
        }

        if (revoked > 0) {
          await tx
            .update(users)
            .set({ creditsRemaining: sql`greatest(0, ${users.creditsRemaining} - ${revoked})` })
            .where(eq(users.id, userId))
        }

        return {
          revoked,
          manualReviewReason: creditsToRevoke > 0 ? 'refund_after_credits_spent' : null,
        }
      })

      await markWebhookProcessed(webhookLog.id, result.manualReviewReason)
      return NextResponse.json(
        { received: true, revokedCredits: result.revoked, manualReview: !!result.manualReviewReason },
        { status: 200 }
      )
    }

    await markWebhookProcessed(webhookLog.id)
    return NextResponse.json({ received: true, ignored: true }, { status: 200 })
  } catch (error) {
    console.error('Lemon Squeezy webhook processing error:', error)
    return NextResponse.json(
      { code: 'processing_error', message: 'Error processing webhook' },
      { status: 500 }
    )
  }
}
