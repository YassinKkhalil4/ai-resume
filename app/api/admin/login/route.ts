import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { key } = body || {}
  if (!key || key !== process.env.ADMIN_KEY) return NextResponse.json({ error: 'Invalid admin key' }, { status: 403 })
  const res = NextResponse.json({ ok: true })
  res.headers.append('Set-Cookie', 'admin=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400')
  return res
}
