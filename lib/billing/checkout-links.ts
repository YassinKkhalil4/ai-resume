export type CreditPackageId =
  | 'price_5_credits'
  | 'price_15_credits'
  | 'price_40_credits'
  | 'price_career_coach_pack'

export interface CreditPackage {
  id: CreditPackageId
  name: string
  credits: number
  price: number
  lemonVariantEnv: string
  popular?: boolean
  description: string
  tagline: string
  features: string[]
}

export const CREDIT_PACKAGE_DEFINITIONS: CreditPackage[] = [
  {
    id: 'price_5_credits',
    name: 'Starter',
    credits: 5,
    price: 5.99,
    lemonVariantEnv: 'LEMON_SQUEEZY_VARIANT_STARTER',
    description: 'Best for testing Rolefit, single job applications, and first-time users',
    tagline: 'Best for trying Rolefit',
    features: [
      '5 resume tailorings',
      'All features included',
      'Credits valid for 12 months from purchase',
      '$1.20 per tailored resume',
    ],
  },
  {
    id: 'price_15_credits',
    name: 'Job Seeker',
    credits: 15,
    price: 12.99,
    lemonVariantEnv: 'LEMON_SQUEEZY_VARIANT_JOB_SEEKER',
    popular: true,
    description: 'Best for active job seekers and multiple applications per week',
    tagline: 'Most popular for active searches',
    features: [
      '15 resume tailorings',
      'All features included',
      'Credits valid for 12 months from purchase',
      '~$0.87 per resume',
    ],
  },
  {
    id: 'price_40_credits',
    name: 'Power Apply',
    credits: 40,
    price: 24.99,
    lemonVariantEnv: 'LEMON_SQUEEZY_VARIANT_POWER_APPLY',
    description: 'Best for aggressive applicants, graduates, and people applying at scale',
    tagline: 'Great for high-volume applications',
    features: [
      '40 resume tailorings',
      'All features included',
      'Credits valid for 12 months from purchase',
      '~$0.62 per resume',
    ],
  },
  {
    id: 'price_career_coach_pack',
    name: 'Career Coach',
    credits: 120,
    price: 64.99,
    lemonVariantEnv: 'LEMON_SQUEEZY_VARIANT_CAREER_COACH',
    description: 'Designed for career coaches and power users working with many clients or applications',
    tagline: 'Built for coaches and power users',
    features: [
      '120 resume tailorings',
      'All features included',
      'Credits valid for 12 months from purchase',
      '~$0.54 per resume',
    ],
  },
]

export const EXTERNAL_CHECKOUT_LINKS_BY_PACKAGE: Record<CreditPackageId, string> = {
  price_5_credits: process.env.NEXT_PUBLIC_CHECKOUT_LINK_STARTER || '',
  price_15_credits: process.env.NEXT_PUBLIC_CHECKOUT_LINK_JOB_SEEKER || '',
  price_40_credits: process.env.NEXT_PUBLIC_CHECKOUT_LINK_POWER_APPLY || '',
  price_career_coach_pack: process.env.NEXT_PUBLIC_CHECKOUT_LINK_CAREER_COACH || '',
}

export function getExternalCheckoutLink(packageId: CreditPackageId): string | null {
  const link = EXTERNAL_CHECKOUT_LINKS_BY_PACKAGE[packageId]
  return link ? link : null
}

export function getCreditPackage(packageId: string): CreditPackage | null {
  return CREDIT_PACKAGE_DEFINITIONS.find((pkg) => pkg.id === packageId) || null
}

export function isCreditPackageId(packageId: string): packageId is CreditPackageId {
  return CREDIT_PACKAGE_DEFINITIONS.some((pkg) => pkg.id === packageId)
}
