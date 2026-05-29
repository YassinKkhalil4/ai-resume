import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from './config'
import { getCurrentUser } from './auth/utils'
import { checkRateLimit, checkUrlFetchRateLimit } from './rate-limiter'

function cookieValue(req: NextRequest, name: string): string | null {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[1]) : null
}

/** Private/loopback CIDR prefixes — these cannot be a real client IP */
const PRIVATE_PREFIXES = ['10.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
  '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.', '127.', 'fc00:', 'fd', '::1']

function isPrivateIP(ip: string): boolean {
  return PRIVATE_PREFIXES.some(prefix => ip.startsWith(prefix))
}

export function clientIP(req: NextRequest): string {
  // x-real-ip is injected by Vercel's edge and cannot be spoofed by clients
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp && !isPrivateIP(realIp)) return realIp

  // Fall back to x-forwarded-for — pick the rightmost non-private IP
  // (proxies append their own IP so the leftmost is easiest to spoof)
  const fwd = req.headers.get('x-forwarded-for') || ''
  const ips = fwd.split(',').map(s => s.trim()).filter(Boolean).reverse()
  const publicIp = ips.find(ip => !isPrivateIP(ip))
  return publicIp || ips[0] || '0.0.0.0'
}

export function sessionID(req: NextRequest) {
  return cookieValue(req, 'sid') || 'anon'
}

export async function enforceGuards(req: NextRequest) {
  const cfg = await getConfig()
  const ip = clientIP(req)
  const sid = sessionID(req)

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

  const rateLimitResult = await checkUrlFetchRateLimit(ip, sid, 10, 5, 3600_000)
  if (!rateLimitResult.allowed) {
    return {
      ok: false,
      res: rateLimitResult.error || NextResponse.json({
        code: 'rate_limit',
        message: 'Too many URL fetch requests. Please wait before trying again.',
      }, { status: 429 }),
    }
  }

  return { ok: true }
}

export async function requireEmailVerification(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { ok: false, res: NextResponse.json({ code: 'unauthorized', message: 'You must be logged in' }, { status: 401 }) }
    }

    if (!user.emailVerified) {
      return { ok: false, res: NextResponse.json({ code: 'email_not_verified', message: 'Please verify your email address before continuing.' }, { status: 403 }) }
    }

    return { ok: true, user }
  } catch (error) {
    return { ok: false, res: NextResponse.json({ code: 'auth_error', message: 'Authentication error' }, { status: 401 }) }
  }
}
