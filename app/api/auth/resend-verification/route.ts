import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth/utils'
import { generateVerificationToken } from '../../../../lib/auth/verification'
import { sendVerificationResend } from '../../../../lib/email/resend'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'You must be logged in to resend verification email' },
        { status: 401 }
      )
    }

    // Check if already verified
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    })

    if (dbUser?.emailVerified) {
      return NextResponse.json(
        { code: 'already_verified', message: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Generate both code and link tokens
    // Note: generateVerificationToken deletes existing tokens, so we need to generate them separately
    // First generate code token
    const codeResult = await generateVerificationToken(user.id, 'code')
    // Then generate link token (this won't delete the code token since they're separate records)
    const linkResult = await generateVerificationToken(user.id, 'link')

    // Send email with both options
    if (codeResult.code && linkResult.token) {
      try {
        await sendVerificationResend(
          dbUser?.email || user.email || '',
          codeResult.code,
          linkResult.token
        )
      } catch (emailError) {
        throw emailError
      }
    } else {
      throw new Error('Failed to generate verification tokens')
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { code: 'resend_failed', message: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}

