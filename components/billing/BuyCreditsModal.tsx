'use client'

import Modal, { ModalClose } from '../Modal'
import { useState } from 'react'
import CreditPackages from './CreditPackages'
import { CreditPackageId } from '../../lib/billing/checkout-links'

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
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: priceId }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.url) {
        setError(data.message || 'Checkout is not available right now. Please try again later.')
        setLoading(false)
        return
      }

      if (onSuccess) onSuccess()
      window.location.href = data.url
    } catch (err) {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="buy-title" size="lg">
      <ModalClose onClick={onClose} />

        <h2 id="buy-title" className="mb-2 text-2xl font-semibold tracking-tight">Buy Credits</h2>
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
          Secure checkout is handled by Lemon Squeezy. Sign in and verify your email before purchasing credits.
        </p>
    </Modal>
  )
}
