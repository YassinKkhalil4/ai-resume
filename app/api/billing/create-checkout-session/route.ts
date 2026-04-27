import { NextRequest, NextResponse } from 'next/server'
import { requireEmailVerification } from '../../../../lib/guards'
import { trackEvent, getContext } from '../../../../lib/analytics/tracker'
import { assertValidPackageId, buildLemonCheckoutUrl } from '../../../../lib/billing/lemon-squeezy'
import { getCreditPackage } from '../../../../lib/billing/checkout-links'

export async function POST(req: NextRequest) {
  try {
    const verificationCheck = await requireEmailVerification(req)
    if (!verificationCheck.ok) {
      return verificationCheck.res
    }

    const body = await req.json()
    const packageId = String(body.packageId || body.priceId || '')
    assertValidPackageId(packageId)

    const pkg = getCreditPackage(packageId)
    const url = buildLemonCheckoutUrl(packageId, verificationCheck.user)

    if (!pkg || !url) {
      return NextResponse.json(
        { code: 'checkout_not_configured', message: 'Checkout is not configured for this package yet' },
        { status: 503 }
      )
    }

    const context = getContext(req)
    await trackEvent(
      'checkout_started',
      {
        provider: 'lemon_squeezy',
        packageId,
        credits: pkg.credits,
      },
      context,
      verificationCheck.user.id
    )

    return NextResponse.json({
      success: true,
      provider: 'lemon_squeezy',
      url,
      packageId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout URL'
    const status = message === 'Invalid credit package' ? 400 : 500
    return NextResponse.json(
      { code: status === 400 ? 'invalid_package' : 'checkout_failed', message },
      { status }
    )
  }
}
