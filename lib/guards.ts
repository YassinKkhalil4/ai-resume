import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from './config'

const ipHits = new Map<string, number[]>()
const sidHits = new Map<string, number[]>()
const urlFetchIpHits = new Map<string, number[]>()
const urlFetchSidHits = new Map<string, number[]>()

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
    return { ok: false, res: NextResponse.json({ code: 'invite_required', message: 'Invite code required' }, { status: 403 }) }
  }
  const ip = clientIP(req)
  const sid = sessionID(req)
  const ipArr = pushHit(ipHits, ip)
  const sidArr = pushHit(sidHits, sid)
  slide(ipArr, 60_000); slide(sidArr, 60_000)
  // prune empty and cap map sizes to avoid unbounded growth
  pruneMaps()
  if (ipArr.length > cfg.rate.ipPerMin) {
    return { ok: false, res: NextResponse.json({ code: 'rate_limit', message: 'Too many requests' }, { status: 429 }) }
  }
  if (sidArr.length > cfg.rate.sessionPerMin) {
    return { ok: false, res: NextResponse.json({ code: 'rate_limit', message: 'Too many requests' }, { status: 429 }) }
  }
  return { ok: true }
}

function pruneMaps(windowMs:number = 60_000, maxKeys = 5000) {
  const nowMs = now()
  for (const [k, arr] of ipHits) {
    while (arr.length && (nowMs - arr[0]) > windowMs) arr.shift()
    if (arr.length === 0) ipHits.delete(k)
  }
  for (const [k, arr] of sidHits) {
    while (arr.length && (nowMs - arr[0]) > windowMs) arr.shift()
    if (arr.length === 0) sidHits.delete(k)
  }
  for (const [k, arr] of urlFetchIpHits) {
    while (arr.length && (nowMs - arr[0]) > 3600_000) arr.shift() // 1 hour window
    if (arr.length === 0) urlFetchIpHits.delete(k)
  }
  for (const [k, arr] of urlFetchSidHits) {
    while (arr.length && (nowMs - arr[0]) > 3600_000) arr.shift() // 1 hour window
    if (arr.length === 0) urlFetchSidHits.delete(k)
  }
  if (ipHits.size > maxKeys) {
    for (const k of ipHits.keys()) { ipHits.delete(k); if (ipHits.size <= maxKeys) break }
  }
  if (sidHits.size > maxKeys) {
    for (const k of sidHits.keys()) { sidHits.delete(k); if (sidHits.size <= maxKeys) break }
  }
  if (urlFetchIpHits.size > maxKeys) {
    for (const k of urlFetchIpHits.keys()) { urlFetchIpHits.delete(k); if (urlFetchIpHits.size <= maxKeys) break }
  }
  if (urlFetchSidHits.size > maxKeys) {
    for (const k of urlFetchSidHits.keys()) { urlFetchSidHits.delete(k); if (urlFetchSidHits.size <= maxKeys) break }
  }
}

// Rate limiting specifically for URL fetching (more restrictive)
export function enforceUrlFetchRateLimit(req: NextRequest) {
  const ip = clientIP(req)
  const sid = sessionID(req)
  const ipArr = pushHit(urlFetchIpHits, ip)
  const sidArr = pushHit(urlFetchSidHits, sid)
  slide(ipArr, 3600_000); slide(sidArr, 3600_000) // 1 hour window
  pruneMaps()
  
  // Per-IP: 10 requests per hour
  if (ipArr.length > 10) {
    return { ok: false, res: NextResponse.json({ 
      code: 'rate_limit', 
      message: 'Too many URL fetch requests. Please wait before trying again.' 
    }, { status: 429 }) }
  }
  
  // Per-session: 5 requests per hour
  if (sidArr.length > 5) {
    return { ok: false, res: NextResponse.json({ 
      code: 'rate_limit', 
      message: 'Too many URL fetch requests. Please wait before trying again.' 
    }, { status: 429 }) }
  }
  
  return { ok: true }
}
