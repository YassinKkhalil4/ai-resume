'use client'

import { Coins } from '@phosphor-icons/react'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import BuyCreditsModal from './BuyCreditsModal'

export default function CreditDisplay() {
  const { data: session, status } = useSession()
  const [credits, setCredits] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showBuyModal, setShowBuyModal] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchCredits()
    } else {
      setLoading(false)
    }
  }, [status, session])

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/billing/credits')
      if (response.ok) {
        const data = await response.json()
        setCredits(data.creditsRemaining)
        setIsAdmin(data.isAdmin || false)
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-4 py-2 dark:border-slate-700 dark:bg-slate-900/70">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
        <span className="text-sm text-slate-600 dark:text-slate-400">Loading...</span>
      </div>
    )
  }

  if (status !== 'authenticated' || credits === null) {
    return null
  }

  const displayText = isAdmin ? 'Unlimited' : `${credits} ${credits === 1 ? 'credit' : 'credits'}`

  return (
    <>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
            !isAdmin && credits === 0
              ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'
              : isAdmin
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/20'
              : 'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70'
          }`}
        >
          <Coins className={`h-5 w-5 ${
              !isAdmin && credits === 0
                ? 'text-red-600 dark:text-red-400'
                : isAdmin
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-blue-600 dark:text-blue-400'
            }`} aria-hidden="true" />
          <span
            className={`text-sm font-semibold ${
              !isAdmin && credits === 0
                ? 'text-red-600 dark:text-red-400'
                : isAdmin
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-700 dark:text-slate-300'
            }`}
          >
            {displayText}
          </span>
        </div>
        {!isAdmin && credits === 0 && (
          <button
            onClick={() => setShowBuyModal(true)}
            className="button"
          >
            Buy Credits
          </button>
        )}
        {!isAdmin && credits > 0 && (
          <button
            onClick={() => setShowBuyModal(true)}
            className="button-outline"
          >
            Top Up
          </button>
        )}
      </div>
      {!isAdmin && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Credits are available immediately after purchase.
        </p>
      )}
      {showBuyModal && <BuyCreditsModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} onSuccess={fetchCredits} />}
    </>
  )
}
