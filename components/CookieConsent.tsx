'use client'

import { useEffect, useState } from 'react'
import { setAnalyticsConsent, getConsentStatus, hasAnalyticsConsent } from '../lib/analytics/consent'

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    // Check if user has already made a choice
    const status = getConsentStatus()
    if (status === 'unknown') {
      // Show banner after a short delay
      timer = setTimeout(() => setShowBanner(true), 1000)
    }

    // Initialize analytics enabled state
    setAnalyticsEnabled(hasAnalyticsConsent())

    // Check for URL parameter to open preferences (works for all users)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('cookies') === 'preferences') {
        setIsOpen(true)
        // Clean up URL parameter
        params.delete('cookies')
        const newSearch = params.toString()
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '')
        window.history.replaceState({}, '', newUrl)
      }
    }

    // Listen for custom event to open preferences (works for all users)
    if (typeof window !== 'undefined') {
      const handleOpenPreferences = () => {
        setAnalyticsEnabled(hasAnalyticsConsent())
        setIsOpen(true)
      }
      window.addEventListener('openCookiePreferences', handleOpenPreferences)

      return () => {
        if (timer) clearTimeout(timer)
        window.removeEventListener('openCookiePreferences', handleOpenPreferences)
      }
    }

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    setAnalyticsConsent(true)
    setShowBanner(false)
    setIsOpen(false)
    // Reload to initialize PostHog if needed
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  const handleReject = () => {
    setAnalyticsConsent(false)
    setShowBanner(false)
    setIsOpen(false)
  }

  const handleCustomize = () => {
    setAnalyticsEnabled(hasAnalyticsConsent())
    setIsOpen(true)
  }

  // Always render if modal should be open, even if banner is hidden
  if (!showBanner && !isOpen) return null

  return (
    <>
      {/* Backdrop */}
      {(showBanner || isOpen) && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Banner */}
      {showBanner && !isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Cookie Preferences
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  We use cookies to improve your experience and analyze product usage. Essential cookies are required for the site to function. Analytics cookies help us understand how you use Tailora.
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <a
                    href="/privacy"
                    className="underline hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Privacy Policy
                  </a>
                  <span>•</span>
                  <a
                    href="/terms"
                    className="underline hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Terms of Service
                  </a>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={handleCustomize}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Customize
                </button>
                <button
                  onClick={handleAccept}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Cookie Preferences
            </h2>

            <div className="space-y-6 mb-6">
              {/* Essential Cookies */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Essential Cookies
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Required for the site to function. These cannot be disabled.
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full">
                    Always On
                  </span>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                  <li>• Session management</li>
                  <li>• Authentication</li>
                  <li>• Security (CSRF protection)</li>
                </ul>
              </div>

              {/* Analytics Cookies */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Analytics Cookies
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      Help us understand how you use Tailora to improve the product.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analyticsEnabled}
                      onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                      className="sr-only peer"
                      id="analytics-toggle"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                  <li>• Product usage analytics</li>
                  <li>• Funnel analysis</li>
                  <li>• Performance metrics</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => {
                  const currentConsent = hasAnalyticsConsent()
                  
                  setAnalyticsConsent(analyticsEnabled)
                  setIsOpen(false)
                  setShowBanner(false)
                  
                  // Only reload if consent changed (to initialize/cleanup PostHog)
                  if (analyticsEnabled !== currentConsent && typeof window !== 'undefined') {
                    window.location.reload()
                  }
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
