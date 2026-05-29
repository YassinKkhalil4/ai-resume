'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CREDIT_PACKAGE_DEFINITIONS, CreditPackageId } from '../../lib/billing/checkout-links'

export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loadingPackage, setLoadingPackage] = useState<CreditPackageId | null>(null)
  const [checkoutError, setCheckoutError] = useState('')

  async function handlePurchase(packageId: CreditPackageId) {
    if (!session) {
      router.push('/tailor')
      return
    }

    setLoadingPackage(packageId)
    setCheckoutError('')

    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.url) {
        setCheckoutError(data.message || 'Checkout is not available right now. Please try again later.')
        setLoadingPackage(null)
        return
      }

      window.location.href = data.url
    } catch {
      setCheckoutError('Checkout is not available right now. Please try again later.')
      setLoadingPackage(null)
    }
  }

  return (
    <main className="space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-semibold text-slate-900 dark:text-slate-100 md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">
            Pay once and use your credits within 12 months. Each credit lets you tailor one resume to one job description.
          </p>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Get 1 free credit when you sign up
          </div>
        </div>
      </section>

      <section>
        <div className="grid gap-6 md:grid-cols-3">
          {CREDIT_PACKAGE_DEFINITIONS.map((pkg) => {
            return (
            <div
              key={pkg.name}
              className={`relative rounded-2xl border-2 p-6 transition hover:-translate-y-1 hover:shadow-lg ${
                pkg.popular
                  ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-slate-200/60 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white dark:bg-blue-500">
                  Most Popular
                </div>
              )}
              <div className="text-center">
                <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {pkg.name}
                </h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                    ${pkg.price}
                  </span>
                </div>
                <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                  {pkg.credits} credits
                </div>
                <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
                  {pkg.description}
                </p>
                <ul className="mb-6 space-y-2 text-left text-sm text-slate-600 dark:text-slate-300">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M5 12L10 17L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loadingPackage !== null}
                  className="button block w-full text-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingPackage === pkg.id ? 'Opening checkout...' : session ? 'Buy Credits' : 'Sign in to Buy'}
                </button>
              </div>
            </div>
          )})}
        </div>
        {checkoutError && (
          <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
        )}
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Sign in and verify your email before purchasing credits.
        </p>
      </section>

      <section className="rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Do credits expire?
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Yes. Credits are valid for 12 months from the date they&apos;re added to your account. We always use the credits that expire soonest first, and you can see your next expiry date in your dashboard.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                How many credits do I need?
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Each credit allows you to tailor one resume to one job description. Most users find that 5-15 credits is enough for a typical job search.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                What payment methods do you accept?
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Payments are handled by Lemon Squeezy.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Can I get a refund?
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                If you&apos;re not satisfied with Rolefit, please contact us within 30 days of purchase for a full refund.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-50/60 via-white/50 to-white/20 p-12 backdrop-blur-xl dark:border-blue-500/30 dark:from-blue-900/40 dark:via-slate-900/40 dark:to-slate-950/40 md:p-16">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Ready to get started?
          </h2>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">
            Start with 1 free credit when you sign up, no credit card required.
          </p>
          <Link
            href="/tailor"
            className="button inline-block"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </main>
  )
}
