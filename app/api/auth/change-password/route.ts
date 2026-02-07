import { NextRequest, NextResponse } from 'next/server'
import { db, users } from '../../../../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { requireAuth } from '../../../../lib/auth/utils'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json(
        { code: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { code: 'missing_fields', message: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { code: 'invalid_password', message: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Get user from database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    })

    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json(
        { code: 'no_password', message: 'Password change not available for this account type' },
        { status: 400 }
      )
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, dbUser.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { code: 'invalid_password', message: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Update password
    await db.update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, user.id))

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { code: 'server_error', message: 'Failed to change password' },
      { status: 500 }
    )
  }
}

