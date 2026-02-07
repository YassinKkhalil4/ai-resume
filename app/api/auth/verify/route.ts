import { NextRequest, NextResponse } from 'next/server'
import { validateVerificationToken, validateVerificationCode } from '../../../../lib/auth/verification'
import { getCurrentUser } from '../../../../lib/auth/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, token } = body

    if (!code && !token) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Either code or token is required' },
        { status: 400 }
      )
    }

    if (code && token) {
      return NextResponse.json(
        { code: 'invalid_request', message: 'Provide either code or token, not both' },
        { status: 400 }
      )
    }

    if (token) {
      // Verify using magic link token
      const result = await validateVerificationToken(token)
      if (!result.valid) {
        return NextResponse.json(
          { code: 'invalid_token', message: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Email verified successfully',
        user: {
          id: result.user?.id,
          email: result.user?.email,
          emailVerified: result.user?.emailVerified,
        },
      })
    }

    if (code) {
      // Verify using code - requires authenticated user
      const user = await getCurrentUser()
      if (!user) {
        return NextResponse.json(
          { code: 'unauthorized', message: 'You must be logged in to verify with a code' },
          { status: 401 }
        )
      }

      const result = await validateVerificationCode(user.id, code)
      if (!result.valid) {
        return NextResponse.json(
          { code: 'invalid_code', message: result.error },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Email verified successfully',
        user: {
          id: result.user?.id,
          email: result.user?.email,
          emailVerified: result.user?.emailVerified,
        },
      })
    }

    return NextResponse.json(
      { code: 'invalid_request', message: 'Invalid request' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { code: 'verification_failed', message: 'Failed to verify email' },
      { status: 500 }
    )
  }
}

