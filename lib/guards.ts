import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from './config'
import { getCurrentUser } from './auth/utils'
import { checkRateLimit, checkUrlFetchRateLimit } from './rate-limiter'

function cookieValue(req: NextRequest, name: string): string | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function clientIP(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for') || ''
  const ip = fwd.split(',')[0].trim() || '0.0.0.0'
  return ip
}

export function sessionID(req: NextRequest) {
  return cookieValue(req, 'sid') || 'anon'
}

export function hasInvite(req: NextRequest) {
  const cfg = getConfig()
  if (!cfg.invites.length) return true
  const header = req.headers.get('x-invite-code') || ''
  const cookie = cookieValue(req, 'invite') || ''
  const code = header || cookie
  if (!code) return false
  return cfg.invites.includes(code)
}

export async function enforceGuards(req: NextRequest) {
  const cfg = getConfig()
  if (!hasInvite(req)) {
    return { ok: false, res: NextResponse.json({ code: 'invite_required', message: 'Invite code required' }, { status: 403 }) }
  }
  const ip = clientIP(req)
  const sid = sessionID(req)
  
  // Check rate limits using Redis or in-memory fallback
  const rateLimitResult = await checkRateLimit(ip, sid, cfg.rate.ipPerMin, cfg.rate.sessionPerMin, 60_000)
  if (!rateLimitResult.allowed) {
    return { ok: false, res: rateLimitResult.error || NextResponse.json({ code: 'rate_limit', message: 'Too many requests' }, { status: 429 }) }
  }
  
  return { ok: true }
}

// Rate limiting specifically for URL fetching (more restrictive)
export async function enforceUrlFetchRateLimit(req: NextRequest) {
  const ip = clientIP(req)
  const sid = sessionID(req)
  
  // Check rate limits using Redis or in-memory fallback
  const rateLimitResult = await checkUrlFetchRateLimit(ip, sid, 10, 5, 3600_000) // 10 per IP, 5 per session, 1 hour window
  if (!rateLimitResult.allowed) {
    return { ok: false, res: rateLimitResult.error || NextResponse.json({ 
      code: 'rate_limit', 
      message: 'Too many URL fetch requests. Please wait before trying again.' 
    }, { status: 429 }) }
  }
  
  return { ok: true }
}

export async function requireEmailVerification(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, res: NextResponse.json({ code: 'unauthorized', message: 'You must be logged in' }, { status: 401 }) }
    }

    // TEMPORARILY DISABLED: Email verification check until Resend is set up
    // TODO: Re-enable after configuring RESEND_API_KEY
    // if (!user.emailVerified) {
    //   return { ok: false, res: NextResponse.json({ code: 'email_not_verified', message: 'Please verify your email address to continue' }, { status: 403 }) }
    // }

    return { ok: true, user }
  } catch (error) {
    return { ok: false, res: NextResponse.json({ code: 'auth_error', message: 'Authentication error' }, { status: 401 }) }
  }
}
