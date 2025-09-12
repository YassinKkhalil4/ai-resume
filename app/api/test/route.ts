import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Test basic functionality
    const testData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      environmentVariables: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasInviteCodes: !!process.env.INVITE_CODES,
        hasAdminKey: !!process.env.ADMIN_KEY,
        inviteCodesCount: process.env.INVITE_CODES ? process.env.INVITE_CODES.split(',').length : 0,
        inviteCodes: process.env.INVITE_CODES ? process.env.INVITE_CODES.split(',').map(s => s.trim()) : []
      },
      request: {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries())
      }
    }

    console.log('Test endpoint called:', testData)
    
    return NextResponse.json(testData)
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({ 
      error: 'Test endpoint failed', 
      details: String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    
    const testData = {
      status: 'ok',
      method: 'POST',
      timestamp: new Date().toISOString(),
      receivedBody: body,
      environment: process.env.NODE_ENV || 'unknown',
      environmentVariables: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasInviteCodes: !!process.env.INVITE_CODES,
        hasAdminKey: !!process.env.ADMIN_KEY
      }
    }

    console.log('Test POST endpoint called:', testData)
    
    return NextResponse.json(testData)
  } catch (error) {
    console.error('Test POST endpoint error:', error)
    return NextResponse.json({ 
      error: 'Test POST endpoint failed', 
      details: String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
