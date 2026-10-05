import { NextRequest, NextResponse } from 'next/server'
import { db, users, creditLots } from '../../../../lib/db'
import bcrypt from 'bcryptjs'
import { detectUniversity } from '../../../../lib/analytics/university-detector'
import { trackEvent, getContext } from '../../../../lib/analytics/tracker'
import { generateVerificationToken } from '../../../../lib/auth/verification'
import { sendVerificationResend } from '../../../../lib/email/resend'
import { normalizeEmail } from '../../../../lib/auth/email'
import { validatePassword } from '../../../../lib/auth/password'
import { findUserByEmail } from '../../../../lib/auth/users'
import { checkNamedRateLimit } from '../../../../lib/rate-limiter'
import { clientIP } from '../../../../lib/guards'

function oneYearFromNow() {
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  return expiresAt
}

export async function POST(req: NextRequest) {
  try {
    const limit = await checkNamedRateLimit('signup', clientIP(req), 5, 60 * 60 * 1000, { failOpen: true })
    if (!limit.allowed) {
      return limit.error ?? NextResponse.json({ code: 'rate_limit', message: 'Too many sign-ups. Please try again later.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const password = body?.password

    if (!email || !password) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json(
        { code: 'invalid_email', message: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    const passwordCheck = validatePassword(password)
    if (passwordCheck.ok === false) {
      return NextResponse.json(
        { code: 'invalid_password', message: passwordCheck.message },
        { status: 400 }
      )
    }

    let existingUser
    try {
      existingUser = await findUserByEmail(email)
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

    // Two concurrent sign-ups for the same email: the unique index decides the winner
    if ((error as any)?.code === '23505' || (error as any)?.cause?.code === '23505') {
      return NextResponse.json(
        { code: 'user_exists', message: 'User with this email already exists' },
        { status: 409 }
      )
    }

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
