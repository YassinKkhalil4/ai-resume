'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useTracking } from '../lib/analytics/useTracking'

export default function LandingPage() {
  const { data: session, status } = useSession()
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const { track } = useTracking()

  const highlightPhrases = [
    'busy product leads',
    'staff-level ICs',
    'growing teams',
    'career switchers',
    'new grads who need traction'
  ]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHighlightIndex(prev => (prev + 1) % highlightPhrases.length)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [highlightPhrases.length])

  useEffect(() => {
    // Track landing page visit
    track('visit_landing', {})
  }, [track])

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      checkAdminStatus()
    }
  }, [status, session])

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/billing/credits')
      if (response.ok) {
        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
      }
    } catch (error) {
      // Not admin or error
    }
  }

  const features = [
    {
      title: 'Guided Accuracy Checks',
      description: 'Mark the lines that prove your achievements—no guessing. Select resume lines, group related bullets, and we transform them into structured evidence.',
      icon: (
        <svg className="h-6 w-6 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 12L10 17L20 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Keyword Radar',
      description: 'Spot hard requirements before you tailor. Our ATS coverage map highlights missing phrases, then suggests rewrites that weave them in naturally.',
      icon: (
        <svg className="h-6 w-6 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12" stroke="currentColor" strokeLinecap="round" />
          <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12" stroke="currentColor" strokeLinecap="round" />
          <path d="M12 13.5C12.8284 13.5 13.5 12.8284 13.5 12C13.5 11.1716 12.8284 10.5 12 10.5C11.1716 10.5 10.5 11.1716 10.5 12C10.5 12.8284 11.1716 13.5 12 13.5Z" stroke="currentColor" />
        </svg>
      )
    },
    {
      title: 'Export-Ready Previews',
      description: 'See recruiter view, diff view, and ATS score together. Flip between templates, compare line-by-line diffs, and run honesty + ATS checks.',
      icon: (
        <svg className="h-6 w-6 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 5H19V19H5V5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 5V19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 11H19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Honesty Guardrails',
      description: 'Every bullet links back to your original resume. If we cannot find support, we flag it for you first—no fabrication, ever.',
      icon: (
        <svg className="h-6 w-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeLinecap="round" />
          <path d="M12 8V12" stroke="currentColor" strokeLinecap="round" />
          <path d="M12 16H12.01" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    },
    {
      title: 'ATS-Native Formatting',
      description: 'We stick to recruiter-approved structure—no columns, no graphics—just clean, keyword-optimized sections that pass every ATS.',
      icon: (
        <svg className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6H20M4 12H20M4 18H12" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    },
    {
      title: 'Privacy by Default',
      description: 'Files never leave memory. Exports are generated on-demand and wiped instantly after download. Your data stays yours.',
      icon: (
        <svg className="h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeLinecap="round" />
          <path d="M8 12L11 15L16 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ]

  const benefits = [
    'Tailor your resume in under 60 seconds',
    'ATS-safe keyword optimization',
    'Human-vetted AI prompts',
    'Zero fabrication guarantee',
    'Privacy-first processing',
    'Export to DOCX, PDF, or TXT'
  ]

  return (
    <main className="space-y-20 pb-20">
      {/* Admin Banner */}
      {isAdmin && (
        <section className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50/90 to-emerald-100/90 p-6 backdrop-blur-sm dark:border-emerald-500 dark:from-emerald-900/40 dark:to-emerald-800/40">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">Admin Account</h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">Quick access to admin dashboard and system management</p>
              </div>
            </div>
            <Link
              href="/admin"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
            >
              Go to Admin Dashboard →
            </Link>
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-12 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="pointer-events-none absolute -left-28 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.35),_transparent_65%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-120px] right-[-40px] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.25),_transparent_70%)] blur-3xl" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-700 dark:border-blue-400/40 dark:text-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            ATS-safe rewriting • human-vetted prompts • no fabrication
          </div>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            This tool optimizes resumes to pass ATS systems — not to game them.
          </p>
          <h1 className="mb-6 text-5xl font-semibold leading-tight text-slate-900 dark:text-slate-100 md:text-6xl lg:text-7xl">
            Tailor your resume to any role in under{' '}
            <span className="text-blue-600 dark:text-blue-400">60 seconds</span>
          </h1>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-300 md:text-xl">
            Upload your existing resume, drop in the job description, and get a deeply aligned version—complete with keyword coverage, honesty checks, and exports that stay ATS-friendly.
          </p>
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span>Designed for</span>
            <span key={highlightIndex} className="animate-fade-slide rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200">
              {highlightPhrases[highlightIndex]}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isAdmin ? (
              <>
                <Link
                  href="/admin"
                  className="button w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                >
                  Admin Dashboard
                </Link>
                <Link
                  href="/tailor"
                  className="button-outline w-full sm:w-auto"
                >
                  Start Tailoring
                </Link>
              </>
            ) : (
              <>
            <Link
              href="/tailor"
              className="button w-full sm:w-auto"
            >
              Start Tailoring
            </Link>
            <Link
              href="/pricing"
              className="button-outline w-full sm:w-auto"
            >
              View Pricing
            </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section>
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-slate-100 md:text-4xl">
            Everything you need to land your next role
          </h2>
          <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-300">
            Built for professionals who value integrity, privacy, and results.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="rounded-3xl border border-white/50 bg-white/70 p-12 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-3xl font-semibold text-slate-900 dark:text-slate-100 md:text-4xl">
            Why professionals choose tailora
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-xl border border-slate-200/60 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12L10 17L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-sm text-slate-700 dark:text-slate-300">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-50/60 via-white/50 to-white/20 p-12 backdrop-blur-xl dark:border-blue-500/30 dark:from-blue-900/40 dark:via-slate-900/40 dark:to-slate-950/40 md:p-16">
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-slate-100 md:text-4xl">
            Ready to tailor your resume?
          </h2>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">
            Join thousands of professionals who trust tailora to help them land their dream roles.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/tailor"
              className="button w-full sm:w-auto"
            >
              Get Started Free
            </Link>
            <Link
              href="/about"
              className="button-outline w-full sm:w-auto"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
