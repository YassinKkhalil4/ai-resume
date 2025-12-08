import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia' as any,
})

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

