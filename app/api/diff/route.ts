import { NextRequest, NextResponse } from 'next/server'
import { buildDiffs } from '../../../lib/diff'
import { enforceGuards, requireEmailVerification } from '../../../lib/guards'
import { resolveExperiencePair } from '../../../lib/experience-pair'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const guard = await enforceGuards(req)
    if (!guard.ok) return guard.res

    const auth = await requireEmailVerification(req)
    if (!auth.ok) return auth.res

    const body = await req.json().catch(() => null)
    const pair = await resolveExperiencePair(body, auth.user.id)
    if (pair.ok === false) {
      return NextResponse.json({ code: pair.code, message: pair.message, ...pair.extra }, { status: pair.status })
    }

    const diffs = await buildDiffs(pair.original, pair.tailored)
    return NextResponse.json({
      diffs,
      session_version: body?.session_version || 'unknown',
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
