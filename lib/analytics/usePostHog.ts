'use client'

import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { hasAnalyticsConsent } from './consent'

export function usePostHog() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const consent = hasAnalyticsConsent()
    if (!consent) {
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || ''
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

    if (!apiKey) {
      console.warn('PostHog API key not configured')
      return
    }

    if (!initialized) {
      posthog.init(apiKey, {
        api_host: host,
        loaded: (posthog) => {
          setInitialized(true)
        },
        capture_pageview: true,
        capture_pageleave: true,
      })
    }

    return () => {
      // Cleanup on unmount
    }
  }, [initialized])

  return {
    posthog: initialized ? posthog : null,
    initialized,
  }
}
