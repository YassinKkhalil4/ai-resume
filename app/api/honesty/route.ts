import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { honestyScan } from '../../../lib/honesty'
import { enforceGuards } from '../../../lib/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Server not configured', code: 'no_openai_key' }, { status: 503 })
  }
  const guard = enforceGuards(req)
  if (!guard.ok) return guard.res

  const body = await req.json()
  const { session_id } = body || {}
  const s = getSession(session_id || '')
  if (!s) return NextResponse.json({ error:'Session not found' }, { status:404 })
  const res = honestyScan(s.original.experience || [], s.tailored.experience || [])
  return NextResponse.json(res)
}
