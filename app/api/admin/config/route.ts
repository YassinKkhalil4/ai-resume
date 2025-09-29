import { NextRequest, NextResponse } from 'next/server'
import { getConfig, updateConfig } from '../../../../lib/config'

function isAdmin(req:NextRequest) {
  const cookie = req.headers.get('cookie') || ''
  return /(?:^|; )admin=1/.test(cookie)
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(getConfig())
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  updateConfig(body || {})
  return NextResponse.json({ ok: true })
}
