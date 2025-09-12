import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }:{ params: { file: string } }) {
  try {
    const file = params.file
    if (!file) {
      return NextResponse.json({ 
        error: 'Missing file parameter', 
        code: 'missing_file' 
      }, { status: 400 })
    }

    const fs = await import('fs')
    const p = `/tmp/${file}`
    
    if (!fs.existsSync(p)) {
      return NextResponse.json({ 
        error: 'File not found or expired', 
        code: 'file_not_found' 
      }, { status: 404 })
    }

    const data = fs.readFileSync(p)
    const isPdf = file.endsWith('.pdf')
    
    // Clean up the file after reading
    try {
      fs.unlinkSync(p)
    } catch (cleanupError) {
      console.warn('Failed to cleanup file:', cleanupError)
    }

    return new NextResponse(data, {
      headers: {
        'Content-Type': isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="resume.${isPdf?'pdf':'docx'}"`,
        'Content-Length': data.length.toString()
      }
    })
  } catch (error) {
    console.error('File download error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'download_error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}
