import { NextRequest, NextResponse } from 'next/server'
import { getConfig, updateConfig } from '../../../../lib/config'
import { getCurrentUser, isUserAdmin } from '../../../../lib/auth/utils'

async function checkAdmin(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ code: 'unauthorized', message: 'Not authenticated' }, { status: 401 }) }
  }
  // Use cached user data instead of making another query
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
  return NextResponse.json(getConfig())
}

export async function POST(req: NextRequest) {
  const adminCheck = await checkAdmin(req)
  if (!adminCheck.ok) return adminCheck.res
  const body = await req.json()
  updateConfig(body || {})
  return NextResponse.json({ ok: true })
}
