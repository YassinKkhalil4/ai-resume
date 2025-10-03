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
    const { session_id, original_experience, tailored_experience } = body || {}
    
    if (!session_id) {
      return NextResponse.json({ code: 'missing_session_id', message: 'Session ID required' }, { status: 400 })
    }
    
    // Try to get session first
    let s = getSession(session_id)
    let originalExp = original_experience
    let tailoredExp = tailored_experience
    
    // If session exists, use its data
    if (s && s.original && s.tailored) {
      originalExp = s.original.experience || []
      tailoredExp = s.tailored.experience || []
    }
    
    // If no session data and no request data, return error
    if (!originalExp || !tailoredExp) {
      return NextResponse.json({ 
        code: 'missing_data', 
        message: 'Original or tailored experience data required. Please ensure the resume has been processed first.',
        suggestion: 'Try refreshing the page and running the honesty scan again.'
      }, { status: 400 })
    }
    
    const res = honestyScan(originalExp, tailoredExp)
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
