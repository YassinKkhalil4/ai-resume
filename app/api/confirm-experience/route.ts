import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '../../../../lib/sessions'
import { validateParsingResult } from '../../../../lib/parsing-validation'
import { enforceGuards } from '../../../../lib/guards'
import { requireEmailVerification } from '../../../../lib/guards'
import type { ResumeJSON, Role } from '../../../../lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Confirmed role shape from client: bullets are user-assigned from selection only. */
type ConfirmedRole = {
  company: string
  role: string
  dates?: string
  bullets: string[]
}

export async function POST(req: NextRequest) {
  try {
    const guard = await enforceGuards(req)
    if (!guard.ok) return guard.res

    const verificationCheck = await requireEmailVerification(req)
    if (!verificationCheck.ok) return verificationCheck.res

    const body = await req.json()
    const { sessionId, confirmedExperience } = body as {
      sessionId?: string
      confirmedExperience?: ConfirmedRole[]
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { code: 'invalid_input', message: 'sessionId is required' },
        { status: 400 }
      )
    }
    if (!Array.isArray(confirmedExperience)) {
      return NextResponse.json(
        { code: 'invalid_input', message: 'confirmedExperience must be an array' },
        { status: 400 }
      )
    }

    // Validate: at least one bullet per role, no empty bullets
    for (let i = 0; i < confirmedExperience.length; i++) {
      const role = confirmedExperience[i]
      if (!role || typeof role.company !== 'string' || typeof role.role !== 'string') {
        return NextResponse.json(
          { code: 'invalid_input', message: `Role ${i + 1}: company and role are required` },
          { status: 400 }
        )
      }
      const bullets = Array.isArray(role.bullets) ? role.bullets : []
      const nonEmpty = bullets.filter((b: unknown) => typeof b === 'string' && b.trim().length > 0)
      if (nonEmpty.length === 0) {
        return NextResponse.json(
          { code: 'invalid_input', message: `Role "${role.role}" must have at least one bullet` },
          { status: 400 }
        )
      }
    }

    const session = await getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { code: 'session_not_found', message: 'Session expired or not found. Please upload and try again.' },
        { status: 404 }
      )
    }

    const original: ResumeJSON = { ...session.original }

    const confirmedRoles: Role[] = confirmedExperience.map((r) => ({
      company: r.company,
      role: r.role,
      dates: r.dates ?? '',
      bullets: (Array.isArray(r.bullets) ? r.bullets : [])
        .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
        .map((b) => b.trim()),
      hasBullets: true,
      source: 'user_confirmed',
    }))

    original.experience = confirmedRoles
    original.experienceSource = 'user_confirmed'
    original.userConfirmedExperience = true

    await updateSession(sessionId, { original })

    const validation = validateParsingResult(original)

    return NextResponse.json({
      success: true,
      resume: original,
      validation,
      message: validation.isValid
        ? 'Experience confirmed. You can now tailor your resume.'
        : 'Experience updated. Please ensure every role has at least one bullet.',
    })
  } catch (error) {
    console.error('Confirm experience error:', error)
    return NextResponse.json(
      {
        code: 'server_error',
        message: error instanceof Error ? error.message : 'Failed to confirm experience',
      },
      { status: 500 }
    )
  }
}
