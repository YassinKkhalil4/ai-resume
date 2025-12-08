'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CreditDisplay from '../../components/billing/CreditDisplay'
import BuyCreditsModal from '../../components/billing/BuyCreditsModal'

interface CreditTransaction {
  id: string
  creditsAdded: number
  amount: string
  createdAt: string
}

interface UsageLog {
  id: string
  timestamp: string
  tokensUsed: number | null
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const [credits, setCredits] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuyModal, setShowBuyModal] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchDashboardData()
      
      // Check for Stripe redirect
      const sessionId = searchParams.get('session_id')
      const canceled = searchParams.get('canceled')
      
      if (sessionId) {
        // Payment successful, refresh credits
        setTimeout(() => {
          fetchDashboardData()
        }, 2000)
      }
    } else {
      setLoading(false)
    }
  }, [status, session, searchParams])

  const fetchDashboardData = async () => {
    try {
      // Fetch credits
      const creditsRes = await fetch('/api/billing/credits')
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json()
        setCredits(creditsData.creditsRemaining)
      }

      // TODO: Add endpoints for transactions and usage logs
      // For now, we'll just show credits
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Please sign in</h1>
          <p className="text-slate-600 dark:text-slate-400">You need to be signed in to view your dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Manage your credits and view usage history</p>
        </div>
        <CreditDisplay />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Credit Balance</h2>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{credits ?? 0}</span>
            <span className="text-slate-600 dark:text-slate-400">credits</span>
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Each credit allows you to tailor one resume to a job description.
          </p>
          <button
            onClick={() => setShowBuyModal(true)}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
          >
            Buy More Credits
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Quick Stats</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Tailorings</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {usageLogs.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Credits Purchased</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {transactions.reduce((sum, t) => sum + t.creditsAdded, 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No transactions yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    +{transaction.creditsAdded} credits
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  ${transaction.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">Usage History</h2>
        {usageLogs.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No usage history yet.</p>
        ) : (
          <div className="space-y-2">
            {usageLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Resume Tailored</div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
                {log.tokensUsed && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {log.tokensUsed} tokens
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showBuyModal && (
        <BuyCreditsModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
          onSuccess={fetchDashboardData}
        />
      )}
    </main>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

