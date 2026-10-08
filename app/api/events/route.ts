import { NextRequest, NextResponse } from 'next/server'
import { trackEvent, getContext } from '../../../lib/analytics/tracker'
import { trackPostHogEvent } from '../../../lib/analytics/posthog'
import { getCurrentUser } from '../../../lib/auth/utils'
import { hasAnalyticsConsent } from '../../../lib/analytics/consent'
import { checkNamedRateLimit } from '../../../lib/rate-limiter'
import { clientIP } from '../../../lib/guards'
import { LIMITS, isValidEventName, payloadTooLarge } from '../../../lib/validation'

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

    const limit = await checkNamedRateLimit('events', clientIP(req), 60, 60 * 1000)
    if (!limit.allowed) {
      // Analytics must never produce an error page or a failed request. If the limiter itself is down
      // (no Redis), drop the event quietly instead of answering 503. A real rate-limit hit still gets 429.
      if (limit.error?.status === 503) return new NextResponse(null, { status: 202 })
      return limit.error ?? NextResponse.json({ code: 'rate_limit', message: 'Too many events' }, { status: 429 })
    }

    const body: any = await req.json().catch(() => null)
    const { eventName, properties = {}, context = {} } = body || {}

    if (!isValidEventName(eventName)) {
      return NextResponse.json(
        { code: 'bad_request', message: 'eventName is required' },
        { status: 400 }
      )
    }

    if (payloadTooLarge(properties, LIMITS.eventPayloadChars) || payloadTooLarge(context, LIMITS.eventPayloadChars)) {
      return NextResponse.json(
        { code: 'input_too_large', message: 'Event payload is too large' },
        { status: 413 }
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
