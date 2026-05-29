import { NextRequest, NextResponse } from 'next/server'
import { db, users, creditLots } from '../../../../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { detectUniversity } from '../../../../lib/analytics/university-detector'
import { trackEvent, getContext } from '../../../../lib/analytics/tracker'
import { generateVerificationToken } from '../../../../lib/auth/verification'
import { sendVerificationResend } from '../../../../lib/email/resend'

function oneYearFromNow() {
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  return expiresAt
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    let existingUser
    try {
      existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      })
    } catch (dbError) {
      console.error('Database query failed during signup:', dbError)
      return NextResponse.json(
        {
          code: 'database_error',
          message: 'Database connection error. Please ensure the database is set up and migrations have been run. Run: npm run db:migrate',
        },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { code: 'user_exists', message: 'User with this email already exists' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const newUser = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          creditsRemaining: 1,
          emailVerified: false,
          emailVerifiedAt: null,
        })
        .returning()

      await tx.insert(creditLots).values({
        userId: created.id,
        source: 'signup',
        creditsTotal: 1,
        creditsRemaining: 1,
        expiresAt: oneYearFromNow(),
      })

      return created
    })

    const context = getContext(req)
    const university = detectUniversity(email)
    if (university) {
      await trackEvent(
        'university_domain_detected',
        {
          domain: university.domain,
          universityName: university.name,
        },
        context,
        newUser.id
      )
    }

    let emailSent = false
    try {
      const codeResult = await generateVerificationToken(newUser.id, 'code')
      const linkResult = await generateVerificationToken(newUser.id, 'link')

      if (codeResult.code && linkResult.token) {
        await sendVerificationResend(newUser.email, codeResult.code, linkResult.token)
        emailSent = true
      }
    } catch (verificationError) {
      console.error('Failed to send verification email:', verificationError)
    }

    await trackEvent('signup_completed', { emailSent }, context, newUser.id).catch(console.error)

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        creditsRemaining: newUser.creditsRemaining,
        emailVerified: newUser.emailVerified,
      },
      message: emailSent
        ? 'Account created successfully. Please check your email to verify your account.'
        : 'Account created successfully. Please use the "Resend verification email" button to verify your account.',
      emailSent,
    })
  } catch (error) {
    console.error('Signup error:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Failed query') || errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
      return NextResponse.json(
        {
          code: 'database_error',
          message: 'Database connection error. Please ensure the database is set up and migrations have been run. Run: npm run db:migrate',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { code: 'signup_failed', message: 'Failed to create account' },
      { status: 500 }
    )
  }
}
