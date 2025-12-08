import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

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

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { code: 'invalid_credentials', message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { code: 'invalid_credentials', message: 'Invalid email or password' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        creditsRemaining: user.creditsRemaining,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { code: 'login_failed', message: 'Failed to login' },
      { status: 500 }
    )
  }
}

