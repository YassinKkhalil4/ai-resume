import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    console.log('Debug Tailor API called:', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      contentType: req.headers.get('content-type'),
      contentLength: req.headers.get('content-length'),
      userAgent: req.headers.get('user-agent'),
      xInviteCode: req.headers.get('x-invite-code')
    })

    // Parse form data
    const form = await req.formData()
    console.log('Form data parsed successfully')
    
    const resumeFile = form.get('resume_file')
    const jdText = form.get('jd_text')?.toString()
    const tone = form.get('tone')?.toString()
    
    console.log('Form data extracted:', {
      hasResumeFile: !!resumeFile,
      resumeFileType: resumeFile?.constructor.name,
      resumeFileName: resumeFile instanceof File ? resumeFile.name : 'not a file',
      resumeFileSize: resumeFile instanceof File ? resumeFile.size : 'unknown',
      jdTextLength: jdText?.length || 0,
      tone
    })
    
    // Test file processing
    if (resumeFile instanceof File) {
      console.log('Testing file processing...')
      try {
        const buffer = Buffer.from(await resumeFile.arrayBuffer())
        console.log('File buffer created:', {
          size: buffer.length,
          firstBytes: buffer.slice(0, 50).toString('utf8')
        })
      } catch (error) {
        console.error('File processing error:', error)
        return NextResponse.json({
          status: 'error',
          error: 'File processing failed',
          details: error.message
        }, { status: 500 })
      }
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Debug endpoint working',
      data: {
        hasResumeFile: !!resumeFile,
        jdTextLength: jdText?.length || 0,
        tone,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('Debug Tailor API error:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
