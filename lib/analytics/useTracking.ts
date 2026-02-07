'use client'

import { useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePostHog } from './usePostHog'

export function useTracking() {
  const { data: session } = useSession()
  const { posthog } = usePostHog()

  const track = useCallback(
    async (eventName: string, properties: Record<string, any> = {}) => {
      // Track in our own database
      try {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventName,
            properties,
            context: {
              page: typeof window !== 'undefined' ? window.location.pathname : undefined,
            },
          }),
        })
      } catch (error) {
        console.error('Failed to track event:', error)
      }

      // Track in PostHog if initialized
      if (posthog) {
        try {
          posthog.capture(eventName, {
            ...properties,
            user_id: session?.user?.id,
          })
        } catch (error) {
          console.error('Failed to track PostHog event:', error)
        }
      }
    },
    [posthog, session]
  )

  const identify = useCallback(
    (userId: string, traits: Record<string, any> = {}) => {
      if (posthog) {
        try {
          posthog.identify(userId, traits)
        } catch (error) {
          console.error('Failed to identify PostHog user:', error)
        }
      }
    },
    [posthog]
  )

  return { track, identify }
}
