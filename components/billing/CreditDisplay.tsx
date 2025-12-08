'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import BuyCreditsModal from './BuyCreditsModal'

export default function CreditDisplay() {
  const { data: session, status } = useSession()
  const [credits, setCredits] = useState<number | null>(null)
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

  return (
    <>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 ${
            credits === 0
              ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'
              : 'border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70'
          }`}
        >
          <svg
            className={`h-5 w-5 ${credits === 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className={`text-sm font-semibold ${credits === 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {credits} {credits === 1 ? 'credit' : 'credits'}
          </span>
        </div>
        {credits === 0 && (
          <button
            onClick={() => setShowBuyModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Buy Credits
          </button>
        )}
      </div>
      {showBuyModal && <BuyCreditsModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} onSuccess={fetchCredits} />}
    </>
  )
}

