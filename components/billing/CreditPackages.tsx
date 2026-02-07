'use client'

import { CREDIT_PACKAGES } from '../../lib/stripe/config'

interface CreditPackagesProps {
  onPurchase: (priceId: string) => void
  loading: boolean
}

// Note: In production, you would fetch actual prices from Stripe
// For now, this is a placeholder that shows the structure
const PACKAGE_INFO: Array<{ priceId: string; credits: number; name: string; popular?: boolean; tagline?: string }> = [
  { priceId: 'price_5_credits', credits: 5, name: 'Starter', tagline: 'Best for trying Tailora' },
  { priceId: 'price_15_credits', credits: 15, name: 'Job Seeker', popular: true, tagline: 'Most popular for active searches' },
  { priceId: 'price_40_credits', credits: 40, name: 'Power Apply', tagline: 'Great for high-volume applications' },
  { priceId: 'price_career_coach_pack', credits: 120, name: 'Career Coach', tagline: 'Built for coaches and power users' },
]

export default function CreditPackages({ onPurchase, loading }: CreditPackagesProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {PACKAGE_INFO.map((pkg) => (
        <div
          key={pkg.priceId}
          className={`relative rounded-xl border-2 p-6 ${
            pkg.popular
              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
          }`}
        >
          {pkg.popular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white dark:bg-blue-500">
              Popular
            </div>
          )}
          <div className="text-center">
            <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">{pkg.name}</h3>
            {pkg.tagline && (
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">{pkg.tagline}</p>
            )}
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{pkg.credits}</span>
              <span className="ml-1 text-sm text-slate-600 dark:text-slate-400">credits</span>
            </div>
            <button
              onClick={() => onPurchase(pkg.priceId)}
              disabled={loading}
              className={`w-full rounded-lg px-4 py-2 font-semibold ${
                pkg.popular
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600'
              } disabled:opacity-50`}
            >
              {loading ? 'Processing...' : 'Buy Now'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

