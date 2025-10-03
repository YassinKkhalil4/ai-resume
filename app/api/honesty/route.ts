import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { honestyScan } from '../../../lib/honesty'
import { enforceGuards } from '../../../lib/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ code: 'no_openai_key', message: 'Server not configured' }, { status: 503 })
    }
    
    const guard = enforceGuards(req)
    if (!guard.ok) return guard.res

    const body = await req.json()
    const { session_id } = body || {}
    
    if (!session_id) {
      return NextResponse.json({ code: 'missing_session_id', message: 'Session ID required' }, { status: 400 })
    }
    
    const s = getSession(session_id)
    if (!s) {
      return NextResponse.json({ code: 'session_not_found', message: 'Session not found' }, { status: 404 })
    }
    
    // Check if we have the required data
    if (!s.original || !s.tailored) {
      return NextResponse.json({ code: 'missing_data', message: 'Original or tailored data missing' }, { status: 400 })
    }
    
    const res = honestyScan(s.original.experience || [], s.tailored.experience || [])
    return NextResponse.json(res)
  } catch (error) {
    console.error('Honesty scan error:', error)
    return NextResponse.json({ 
      code: 'honesty_scan_failed', 
      message: 'Honesty scan failed. Please try again.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}
