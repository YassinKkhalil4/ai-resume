import { NextRequest, NextResponse } from 'next/server'
import { stripe, getCreditsForPriceId } from '../../../../lib/stripe/config'
import { db, users, creditTransactions, webhookLogs } from '../../../../lib/db'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { code: 'missing_signature', message: 'Missing signature or webhook secret' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { code: 'invalid_signature', message: 'Invalid signature' },
      { status: 400 }
    )
  }

  // Log webhook event
  await db.insert(webhookLogs).values({
    eventType: event.type,
    payload: event as any,
    processed: false,
  })

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    try {
      // Extract metadata
      const userId = session.metadata?.userId
      const creditsStr = session.metadata?.credits

      if (!userId || !creditsStr) {
        console.error('Missing metadata in checkout session:', session.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      const credits = parseInt(creditsStr, 10)
      const paymentIntentId = session.payment_intent as string

      if (!paymentIntentId) {
        console.error('Missing payment_intent in session:', session.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }

      // Check for duplicate (idempotency)
      const existingTransaction = await db.query.creditTransactions.findFirst({
        where: eq(creditTransactions.stripePaymentId, paymentIntentId),
      })

      if (existingTransaction) {
        console.log('Duplicate webhook event, already processed:', paymentIntentId)
        // Update webhook log as processed
        await db
          .update(webhookLogs)
          .set({ processed: true })
          .where(eq(webhookLogs.id, (await db.query.webhookLogs.findFirst({
            where: eq(webhookLogs.eventType, event.type),
            orderBy: (webhookLogs, { desc }) => [desc(webhookLogs.createdAt)],
          }))?.id || ''))

        return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
      }

      // Begin transaction
      await db.transaction(async (tx) => {
        // Insert credit transaction
        await tx.insert(creditTransactions).values({
          userId,
          stripePaymentId: paymentIntentId,
          creditsAdded: credits,
          amount: ((session.amount_total || 0) / 100).toString(), // Convert from cents to string
        })

        // Update user credits
        const user = await tx.query.users.findFirst({
          where: eq(users.id, userId),
        })

        if (!user) {
          throw new Error(`User not found: ${userId}`)
        }

        await tx
          .update(users)
          .set({
            creditsRemaining: user.creditsRemaining + credits,
          })
          .where(eq(users.id, userId))
      })

      // Mark webhook as processed
      const webhookLog = await db.query.webhookLogs.findFirst({
        where: eq(webhookLogs.eventType, event.type),
        orderBy: (webhookLogs, { desc }) => [desc(webhookLogs.createdAt)],
      })

      if (webhookLog) {
        await db
          .update(webhookLogs)
          .set({ processed: true })
          .where(eq(webhookLogs.id, webhookLog.id))
      }

      console.log(`Credits added: ${credits} to user ${userId}`)
    } catch (error) {
      console.error('Error processing webhook:', error)
      // Return 200 to prevent Stripe from retrying (we'll handle manually)
      return NextResponse.json(
        { code: 'processing_error', message: 'Error processing webhook' },
        { status: 200 }
      )
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}

