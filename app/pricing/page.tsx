'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CREDIT_PACKAGE_DEFINITIONS, CreditPackageId } from '../../lib/billing/checkout-links'

const faqs = [
  {
    q: 'Do credits expire?',
    a: "Yes. Credits are valid for 12 months from the date they're added to your account. We always use the credits that expire soonest first, and you can see your next expiry date in your dashboard.",
  },
  {
    q: 'How many credits do I need?',
    a: 'Each credit allows you to tailor one resume to one job description. Most users find that 5-15 credits is enough for a typical job search.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'Payments are handled by Lemon Squeezy.',
  },
  {
    q: 'Can I get a refund?',
    a: "If you're not satisfied with Rolefit, please contact us within 30 days of purchase for a full refund.",
  },
]

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
    <main className="space-y-14 md:space-y-20">
      <section aria-labelledby="pricing-heading" className="max-w-3xl">
        <h1 id="pricing-heading" className="enter enter-1 text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl lg:text-6xl">
          Simple, transparent pricing
        </h1>
        <p className="enter enter-2 mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
          Pay once and use your credits within 12 months. Each credit tailors one resume to one job description.
        </p>
        <p className="mt-4 text-sm font-medium text-blue-700 dark:text-blue-300">
          Get 1 free credit when you sign up.
        </p>
      </section>

      <section aria-label="Credit packages" className="enter enter-3">
        <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {CREDIT_PACKAGE_DEFINITIONS.map((pkg) => (
            <li
              key={pkg.id}
              className={`grid gap-6 py-8 md:-mx-6 md:grid-cols-12 md:items-center md:gap-8 md:px-6 ${
                pkg.popular ? 'bg-blue-50 dark:bg-blue-950' : ''
              }`}
            >
              <div className="md:col-span-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight">{pkg.name}</h2>
                  {pkg.popular && (
                    <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-blue-400 dark:text-slate-950">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{pkg.description}</p>
              </div>

              <div className="md:col-span-2">
                <div className="text-3xl font-semibold tracking-tighter">${pkg.price}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{pkg.credits} credits</div>
              </div>

              <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400 md:col-span-4">
                {pkg.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 text-blue-600 dark:text-blue-400">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="md:col-span-2 md:text-right">
                <button
                  type="button"
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loadingPackage !== null}
                  className={`${pkg.popular ? 'button' : 'button-outline'} w-full md:w-auto`}
                >
                  {loadingPackage === pkg.id ? 'Opening checkout...' : session ? 'Buy Credits' : 'Sign in to Buy'}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {checkoutError && (
          <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">{checkoutError}</p>
        )}
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Sign in and verify your email before purchasing credits.
        </p>
      </section>

      <section aria-labelledby="faq-heading" className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <h2 id="faq-heading" className="text-3xl font-semibold tracking-tighter sm:text-4xl lg:col-span-4">
          Questions, answered.
        </h2>
        <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800 lg:col-span-8">
          {faqs.map((faq) => (
            <details key={faq.q} className="faq group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span aria-hidden="true" className="faq-icon text-xl font-normal text-slate-500">+</span>
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-slate-600 dark:text-slate-400">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="start-heading" className="flex flex-col items-start gap-6 border-t border-slate-200 pt-14 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="start-heading" className="text-3xl font-semibold tracking-tighter sm:text-4xl">Ready to get started?</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Start with 1 free credit when you sign up. No credit card required.
          </p>
        </div>
        <Link href="/tailor" className="button">
          Get Started Free
        </Link>
      </section>
    </main>
  )
}
