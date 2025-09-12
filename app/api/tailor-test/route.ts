import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    error: 'Method not allowed', 
    message: 'This endpoint only accepts POST requests',
    method: req.method
  }, { status: 405 })
}

export async function POST(req: NextRequest) {
  console.log('Tailor-test API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })
  
  try {
    console.log('Starting form data parsing...')
    const form = await req.formData()
    console.log('Form data parsed successfully')
    
    const resume_file = form.get('resume_file')
    const jd_text = form.get('jd_text')?.toString()
    const tone = form.get('tone')?.toString()
    
    console.log('Form data extracted:', {
      hasResumeFile: !!resume_file,
      jdTextLength: jd_text?.length || 0,
      tone
    })
    
    // Test if we can access the mammoth library without errors
    console.log('Testing mammoth import...')
    try {
      const mammoth = require('mammoth')
      console.log('mammoth imported successfully')
    } catch (e) {
      console.error('mammoth import failed:', e)
      return NextResponse.json({ 
        error: 'mammoth import failed', 
        details: String(e),
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    // Test if we can access the pdfjs-dist library without errors
    console.log('Testing pdfjs-dist import...')
    try {
      const pdfjs = await import('pdfjs-dist')
      console.log('pdfjs-dist imported successfully')
    } catch (e) {
      console.error('pdfjs-dist import failed:', e)
      return NextResponse.json({ 
        error: 'pdfjs-dist import failed', 
        details: String(e),
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Tailor-test endpoint working',
      data: {
        hasResumeFile: !!resume_file,
        jdTextLength: jd_text?.length || 0,
        tone,
        mammothWorking: true,
        pdfjsDistWorking: true
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Tailor-test API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'server_error',
      details: String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
