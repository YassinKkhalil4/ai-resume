import { NextRequest, NextResponse } from 'next/server'
import { getOpenAI } from '../../../lib/openai'

export async function GET(req: NextRequest) {
  try {
    console.log('Debug OpenAI configuration...')
    
    // Check environment variables
    const envCheck = {
      hasApiKey: !!process.env.OPENAI_API_KEY,
      hasProjectId: !!process.env.OPENAI_PROJECT_ID,
      hasOrgId: !!process.env.OPENAI_ORG_ID,
      hasModel: !!process.env.OPENAI_MODEL,
      apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'NOT_SET',
      projectId: process.env.OPENAI_PROJECT_ID || 'NOT_SET',
      orgId: process.env.OPENAI_ORG_ID || 'NOT_SET',
      model: process.env.OPENAI_MODEL || 'NOT_SET'
    }
    
    console.log('Environment check:', envCheck)
    
    // Try to create OpenAI client
    const client = getOpenAI()
    console.log('OpenAI client created successfully')
    
    // Try a simple API call
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "OpenAI test successful"' }],
      max_tokens: 10
    })
    
    console.log('OpenAI API call successful')
    
    return NextResponse.json({
      status: 'success',
      environment: envCheck,
      apiResponse: response.choices[0]?.message?.content,
      tokens: response.usage?.total_tokens
    })
    
  } catch (error: any) {
    console.error('OpenAI debug error:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
