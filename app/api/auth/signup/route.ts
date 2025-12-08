import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { validateInviteCode } from '../../../../lib/auth/invite-codes'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, inviteCode } = body

    if (!email || !password) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate invite code if provided
    const inviteValidation = validateInviteCode(inviteCode)
    if (!inviteValidation.valid) {
      return NextResponse.json(
        { code: 'invalid_invite', message: inviteValidation.message },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existingUser) {
      return NextResponse.json(
        { code: 'user_exists', message: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with 1 free credit
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        creditsRemaining: 1, // Free credit on signup
      })
      .returning()

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        creditsRemaining: newUser.creditsRemaining,
      },
      message: 'Account created successfully. You received 1 free credit!',
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { code: 'signup_failed', message: 'Failed to create account' },
      { status: 500 }
    )
  }
}

