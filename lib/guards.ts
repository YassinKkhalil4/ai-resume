import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from './config'

const ipHits = new Map<string, number[]>()
const sidHits = new Map<string, number[]>()

function now() { return Date.now() }

function slide(arr:number[], windowMs:number) {
  const t = now()
  while (arr.length && (t - arr[0]) > windowMs) arr.shift()
}

function pushHit(map: Map<string, number[]>, key: string) {
  const arr = map.get(key) || []
  arr.push(now())
  map.set(key, arr)
  return arr
}

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

export function enforceGuards(req: NextRequest) {
  const cfg = getConfig()
  if (!hasInvite(req)) {
    return { ok: false, res: NextResponse.json({ error: 'Invite code required', code: 'invite_required' }, { status: 403 }) }
  }
  const ip = clientIP(req)
  const sid = sessionID(req)
  const ipArr = pushHit(ipHits, ip)
  const sidArr = pushHit(sidHits, sid)
  slide(ipArr, 60_000); slide(sidArr, 60_000)
  if (ipArr.length > cfg.rate.ipPerMin) {
    return { ok: false, res: NextResponse.json({ error: 'Rate limit exceeded (ip)', code: 'rate_ip' }, { status: 429 }) }
  }
  if (sidArr.length > cfg.rate.sessionPerMin) {
    return { ok: false, res: NextResponse.json({ error: 'Rate limit exceeded (session)', code: 'rate_session' }, { status: 429 }) }
  }
  return { ok: true }
}
