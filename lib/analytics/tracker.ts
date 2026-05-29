import { NextRequest } from 'next/server'
import { db, analyticsEvents, analyticsSessions } from '../db'
import { eq } from 'drizzle-orm'
import { v4 as uuid } from 'uuid'
import { getCurrentUser } from '../auth/utils'

export interface EventContext {
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  country?: string
  referralSource?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  userAgent?: string
  ip?: string
}

export interface EventProperties {
  [key: string]: any
}

// Whitelist of valid event names
const VALID_EVENT_NAMES = new Set([
  // Layer 1: Identity & Session
  'visit_landing',
  'signup_started',
  'signup_completed',
  'university_domain_detected',
  
  // Layer 2: Core Funnel
  'resume_uploaded',
  'resume_parse_success',
  'resume_parse_failed',
  'job_description_added',
  'tailor_clicked',
  'tailor_completed',
  'tailor_failed',
  'credit_deducted',
  
  // Layer 3: Tailoring Intelligence
  'ats_score_calculated',
  'keywords_added',
  'honesty_scan_completed',
  'polish_applied',
  
  // Layer 4: Monetization
  'credit_balance_viewed',
  'credits_exhausted',
  'pricing_page_viewed',
  'checkout_started',
  'checkout_completed',
])

export async function trackEvent(
  eventName: string,
  properties: EventProperties = {},
  context: EventContext = {},
  userId?: string
): Promise<void> {
  // Validate event name
  if (!VALID_EVENT_NAMES.has(eventName)) {
    console.warn(`Invalid event name: ${eventName}`)
    return
  }

  try {
    // Get or create session ID
    const sessionId = await getOrCreateSession(context, userId)

    // Get user ID if not provided
    let finalUserId = userId
    if (!finalUserId) {
      try {
        const user = await getCurrentUser()
        finalUserId = user?.id
      } catch {
        // Not authenticated, continue as guest
      }
    }

    // Insert event
    await db.insert(analyticsEvents).values({
      id: uuid(),
      eventName,
      userId: finalUserId || null,
      sessionId,
      properties: properties || {},
      context: context || {},
      timestamp: new Date(),
    })
  } catch (error) {
    console.error('Failed to track event:', error)
    // Don't throw - tracking failures shouldn't break the app
  }
}

export async function identifyUser(userId: string, traits: Record<string, any>): Promise<void> {
  try {
    // Update user properties in PostHog (if integrated)
    // For now, we'll just track an identify event
    await trackEvent('user_identified', traits, {}, userId)
  } catch (error) {
    console.error('Failed to identify user:', error)
  }
}

export async function getOrCreateSession(context: EventContext, userId?: string): Promise<string> {
  // For now, generate a session ID per request
  // In production, you might want to use a cookie-based session
  const sessionId = uuid()
  
  try {
    // Check if session exists
    const existing = await db.query.analyticsSessions.findFirst({
      where: eq(analyticsSessions.id, sessionId),
    })

    if (!existing) {
      // Create new session
      await db.insert(analyticsSessions).values({
        id: sessionId,
        userId: userId || null,
        deviceType: context.deviceType || 'desktop',
        country: context.country || null,
        referralSource: context.referralSource || null,
        utmSource: context.utmSource || null,
        utmMedium: context.utmMedium || null,
        utmCampaign: context.utmCampaign || null,
        startedAt: new Date(),
        pageViews: 1,
      })
    } else {
      // Update page views
      await db
        .update(analyticsSessions)
        .set({ pageViews: existing.pageViews + 1 })
        .where(eq(analyticsSessions.id, sessionId))
    }
  } catch (error) {
    console.error('Failed to create/update session:', error)
  }

  return sessionId
}

export function getContext(req: NextRequest): EventContext {
  const userAgent = req.headers.get('user-agent') || ''
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || undefined

  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
  if (/mobile|android|iphone|ipod/i.test(userAgent)) {
    deviceType = 'mobile'
  } else if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'tablet'
  }

  // Extract UTM parameters from URL
  const url = new URL(req.url)
  const utmSource = url.searchParams.get('utm_source') || undefined
  const utmMedium = url.searchParams.get('utm_medium') || undefined
  const utmCampaign = url.searchParams.get('utm_campaign') || undefined

  // Determine referral source
  const referer = req.headers.get('referer')
  let referralSource: string | undefined
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      referralSource = refererUrl.hostname
    } catch {
      referralSource = 'direct'
    }
  } else {
    referralSource = 'direct'
  }

  // Country detection (simplified - in production, use a geolocation service)
  // For now, we'll leave it undefined and can add later

  return {
    deviceType,
    referralSource,
    utmSource,
    utmMedium,
    utmCampaign,
    userAgent,
    ip,
  }
}
