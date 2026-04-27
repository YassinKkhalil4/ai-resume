'use client'

import { useState } from 'react'
import CreditPackages from './CreditPackages'
import { CreditPackageId, getExternalCheckoutLink } from '../../lib/billing/checkout-links'

interface BuyCreditsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function BuyCreditsModal({ isOpen, onClose, onSuccess }: BuyCreditsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handlePurchase = async (priceId: CreditPackageId) => {
    setLoading(true)
    setError('')

    try {
      const checkoutLink = getExternalCheckoutLink(priceId)
      if (!checkoutLink) {
        setError('Checkout link is not configured yet. Please contact support.')
        setLoading(false)
        return
      }

      if (onSuccess) onSuccess()
      window.location.href = checkoutLink
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Buy Credits</h2>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          Each credit allows you to tailor one resume. Choose a package below:
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <CreditPackages onPurchase={handlePurchase} loading={loading} />

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Secure checkout is handled by our external provider. Purchase is allowed before invite approval.
        </p>
      </div>
    </div>
  )
}

