import { NextRequest, NextResponse } from 'next/server'
import { trackEvent, getContext } from '../../../lib/analytics/tracker'
import { trackPostHogEvent } from '../../../lib/analytics/posthog'
import { getCurrentUser } from '../../../lib/auth/utils'
import { hasAnalyticsConsent } from '../../../lib/analytics/consent'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/events/session - Get current session ID
export async function GET(req: NextRequest) {
  try {
    // For now, return a new session ID
    // In production, you might want to use a cookie-based session
    const sessionId = crypto.randomUUID()
    return NextResponse.json({ sessionId })
  } catch (error) {
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to get session' },
      { status: 500 }
    )
  }
}

// POST /api/events - Track an event
export async function POST(req: NextRequest) {
  try {

    let body: any
    try {
      body = await req.json()
    } catch (parseError) {
      throw parseError
    }
    const { eventName, properties = {}, context = {} } = body

    if (!eventName || typeof eventName !== 'string') {
      return NextResponse.json(
        { code: 'bad_request', message: 'eventName is required' },
        { status: 400 }
      )
    }

    // Get user ID from session
    let userId: string | undefined
    try {
      const user = await getCurrentUser()
      userId = user?.id
    } catch {
      // Not authenticated, continue as guest
    }

    // Get request context
    const requestContext = getContext(req)
    const mergedContext = { ...requestContext, ...context }

    // Track event in database
    await trackEvent(eventName, properties, mergedContext, userId)

    // Forward to PostHog if consent given (check cookie)
    const consentCookie = req.cookies.get('analytics_consent')
    const hasConsent = consentCookie?.value === 'true'

    if (hasConsent && userId) {
      await trackPostHogEvent(
        userId,
        eventName,
        { ...properties, ...mergedContext },
        hasConsent
      )
    } else if (hasConsent) {
      // For anonymous users, use session ID
      const sessionId = context.sessionId || crypto.randomUUID()
      await trackPostHogEvent(
        sessionId,
        eventName,
        { ...properties, ...mergedContext },
        hasConsent
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error tracking event:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to track event' },
      { status: 500 }
    )
  }
}
