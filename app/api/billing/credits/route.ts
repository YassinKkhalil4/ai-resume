import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserCredits } from '../../../../lib/auth/utils'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const credits = await getUserCredits(user.id)

    return NextResponse.json({
      success: true,
      creditsRemaining: credits,
      userId: user.id,
    })
  } catch (error) {
    return NextResponse.json(
      { code: 'unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }
}

