import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from './utils'

export async function requireAuthMiddleware(req: NextRequest) {
  try {
    const user = await requireAuth()
    return { user, error: null }
  } catch (error) {
    return {
      user: null,
      error: NextResponse.json(
        { code: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      ),
    }
  }
}

