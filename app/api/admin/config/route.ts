import { NextRequest, NextResponse } from 'next/server'
import { getConfig, updateConfig } from '../../../../lib/config'
import { getCurrentUser } from '../../../../lib/auth/utils'

async function checkAdmin(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ code: 'unauthorized', message: 'Not authenticated' }, { status: 401 }) }
  }
  if (!user.isAdmin) {
    return { ok: false, res: NextResponse.json({ code: 'forbidden', message: 'Admin access required' }, { status: 403 }) }
  }
  return { ok: true }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res
  const cfg = await getConfig()
  return NextResponse.json(cfg)
}

export async function POST(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res
  const body = await req.json()
  const updated = await updateConfig(body || {})
  return NextResponse.json({ ok: true, config: updated })
}
