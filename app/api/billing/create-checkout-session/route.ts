import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '../../../../lib/auth/utils'
import { stripe, isValidPriceId, getCreditsForPriceId } from '../../../../lib/stripe/config'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { priceId } = body

    if (!priceId) {
      return NextResponse.json(
        { code: 'missing_price_id', message: 'Price ID is required' },
        { status: 400 }
      )
    }

    if (!isValidPriceId(priceId)) {
      return NextResponse.json(
        { code: 'invalid_price_id', message: 'Invalid price ID' },
        { status: 400 }
      )
    }

    const credits = getCreditsForPriceId(priceId)
    if (!credits) {
      return NextResponse.json(
        { code: 'invalid_price_id', message: 'Could not determine credits for price ID' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      })
      customerId = customer.id

      // Update user with Stripe customer ID
      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id))
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard?canceled=true`,
      metadata: {
        userId: user.id,
        credits: credits.toString(),
      },
    })

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('Checkout session creation error:', error)
    return NextResponse.json(
      { code: 'checkout_failed', message: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

