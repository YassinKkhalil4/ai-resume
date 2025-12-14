import Stripe from 'stripe'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  // Skip Stripe initialization during build/static generation
  if (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build') {
    // Return a mock Stripe instance during build to prevent initialization errors
    return {} as Stripe
  }

  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set')
    }

    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as any,
    })
  }
  return _stripe
}

// Export Stripe instance - initialized on first use (not during build)
export const stripe = getStripe()

// Credit package mapping: Stripe Price ID -> Credits
// Developer must create these products in Stripe Dashboard and update the price IDs
export const CREDIT_PACKAGES: Record<string, number> = {
  // Example price IDs - replace with actual Stripe Price IDs
  // 'price_abc123': 10,
  // 'price_def456': 25,
  // 'price_ghi789': 50,
  // 'price_jkl000': 100,
}

// Helper function to get credits for a price ID
export function getCreditsForPriceId(priceId: string): number | null {
  return CREDIT_PACKAGES[priceId] || null
}

// Helper function to validate price ID
export function isValidPriceId(priceId: string): boolean {
  return priceId in CREDIT_PACKAGES
}

