import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { buildDiffs } from '../../../lib/diff'
import { enforceGuards } from '../../../lib/guards'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const guard = enforceGuards(req)
    if (!guard.ok) return guard.res

    const body = await req.json()
    const { 
      session_id, 
      original_experience, 
      tailored_experience,
      session_version,
      original_payload,
      tailored_payload
    } = body || {}
    
    if (!session_id) {
      return NextResponse.json({ code: 'missing_session_id', message: 'Session ID required' }, { status: 400 })
    }
    
    let originalExp = original_experience
    let tailoredExp = tailored_experience
    
    // Try to get data from direct payloads first (preferred)
    if (original_payload && tailored_payload) {
      originalExp = original_payload.experience || []
      tailoredExp = tailored_payload.experience || []
      console.log('Using direct payloads for diff generation')
    } else {
      // Fallback to session lookup
      const s = getSession(session_id)
      if (s && s.original && s.tailored) {
        originalExp = s.original.experience || []
        tailoredExp = s.tailored.experience || []
        console.log('Using session data for diff generation')
      }
    }
    
    // If still no data, return error
    if (!originalExp || !tailoredExp) {
      return NextResponse.json({ 
        code: 'missing_data', 
        message: 'Original or tailored experience data required for diff generation.',
        suggestion: 'Try refreshing the page and try again.',
        session_version: session_version || 'unknown'
      }, { status: 400 })
    }
    
    // Check session version if provided
    if (session_version) {
      const currentSession = getSession(session_id)
      if (currentSession && currentSession.version !== session_version) {
        return NextResponse.json({ 
          code: 'stale_session', 
          message: 'Session data is outdated. Please refresh the page and try again.',
          session_version: currentSession.version,
          provided_version: session_version
        }, { status: 409 })
      }
    }
    
    const diffs = buildDiffs(originalExp, tailoredExp)
    return NextResponse.json({
      diffs,
      session_version: session_version || 'unknown'
    })
  } catch (error) {
    console.error('Diff generation error:', error)
    return NextResponse.json({ 
      code: 'diff_generation_failed', 
      message: 'Failed to generate diffs. Please try again.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}
