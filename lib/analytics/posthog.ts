import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogClient(): PostHog | null {
  if (posthogClient) return posthogClient

  const apiKey = process.env.POSTHOG_API_KEY
  const host = process.env.POSTHOG_HOST || 'https://app.posthog.com'

  if (!apiKey) {
    console.warn('PostHog API key not configured')
    return null
  }

  try {
    posthogClient = new PostHog(apiKey, {
      host,
      flushAt: 20, // Batch events
      flushInterval: 10000, // 10 seconds
    })
    return posthogClient
  } catch (error) {
    console.error('Failed to initialize PostHog:', error)
    return null
  }
}

export async function trackPostHogEvent(
  distinctId: string,
  eventName: string,
  properties: Record<string, any> = {},
  hasConsent: boolean = false
): Promise<void> {
  if (!hasConsent) {
    // Don't track if user hasn't consented
    return
  }

  const client = getPostHogClient()
  if (!client) return

  try {
    client.capture({
      distinctId,
      event: eventName,
      properties,
    })
  } catch (error) {
    console.error('Failed to track PostHog event:', error)
  }
}

export async function identifyPostHogUser(
  distinctId: string,
  traits: Record<string, any>,
  hasConsent: boolean = false
): Promise<void> {
  if (!hasConsent) return

  const client = getPostHogClient()
  if (!client) return

  try {
    client.identify({
      distinctId,
      properties: traits,
    })
  } catch (error) {
    console.error('Failed to identify PostHog user:', error)
  }
}

export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown()
    posthogClient = null
  }
}
