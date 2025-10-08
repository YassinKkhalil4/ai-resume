import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    hasApiKey: !!process.env.OPENAI_API_KEY,
    hasProjectId: !!process.env.OPENAI_PROJECT_ID,
    hasOrgId: !!process.env.OPENAI_ORG_ID,
    hasModel: !!process.env.OPENAI_MODEL,
    apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 20) || 'NOT_SET',
    projectId: process.env.OPENAI_PROJECT_ID || 'NOT_SET',
    orgId: process.env.OPENAI_ORG_ID || 'NOT_SET',
    model: process.env.OPENAI_MODEL || 'NOT_SET',
    timestamp: new Date().toISOString()
  })
}
