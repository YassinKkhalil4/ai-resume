'use client'

import { CREDIT_PACKAGE_DEFINITIONS, CreditPackageId } from '../../lib/billing/checkout-links'

interface CreditPackagesProps {
  onPurchase: (priceId: CreditPackageId) => void
  loading: boolean
}

export default function CreditPackages({ onPurchase, loading }: CreditPackagesProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {CREDIT_PACKAGE_DEFINITIONS.map((pkg) => (
        <div
          key={pkg.id}
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
              onClick={() => onPurchase(pkg.id)}
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

