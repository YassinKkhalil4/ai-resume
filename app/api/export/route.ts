import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { renderHTML, htmlToPDF } from '../../../lib/pdf'
import { ResumeJSON } from '../../../lib/types'
import { randomUUID } from 'crypto'
import { convertHtmlToDocument } from './util_docx'
import { enforceGuards } from '../../../lib/guards'
import { startTrace } from '../../../lib/telemetry'

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
  console.log('Export API called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  })

  try {
    const guard = enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    console.log('Guard check passed')

    const trace = startTrace({ route: 'export' })
    console.log('Trace started')

    console.log('Parsing request body...')
    const body = await req.json()
    console.log('Request body parsed successfully')

    const { session_id, template='minimal', format='pdf', options={ includeSummary:true, includeSkills:true } } = body || {}
    
    console.log('Export parameters:', {
      session_id: session_id ? 'present' : 'missing',
      template,
      format,
      options
    })

    if (!session_id) {
      console.log('Missing session_id')
      return NextResponse.json({ 
        error: 'Missing session_id', 
        code: 'missing_session_id' 
      }, { status: 400 })
    }

    console.log('Getting session...')
    const s = getSession(session_id)
    if (!s) {
      console.log('Session not found:', session_id)
      return NextResponse.json({ 
        error: 'Session expired or not found', 
        code: 'session_not_found' 
      }, { status: 404 })
    }
    console.log('Session found')

    console.log('Building resume object...')
    const resume: ResumeJSON = {
      summary: options.includeSummary ? s.tailored.summary : '',
      skills: options.includeSkills ? s.tailored.skills_section : [],
      experience: s.tailored.experience.filter(exp => exp.company && exp.role) as any,
      education: s.original.education,
      certifications: s.original.certifications
    }
    console.log('Resume object built')

    console.log('Rendering HTML...')
    const html = await renderHTML(resume, template, { includeSkills: !!options.includeSkills, includeSummary: !!options.includeSummary })
    console.log('HTML rendered successfully')

    if (format === 'pdf') {
      console.log('Generating PDF...')
      try {
        const pdf = await htmlToPDF(html)
        console.log('PDF generated successfully, size:', pdf.length)
        
        const fileId = randomUUID() + '.pdf'
        const path = `/tmp/${fileId}`
        
        console.log('Writing PDF to file:', path)
        const fs = await import('fs')
        fs.writeFileSync(path, pdf)
        console.log('PDF file written successfully')
        
        trace.end(true, { size: pdf.length })
        return NextResponse.json({ 
          download_url: `/api/export/${fileId}`,
          format: 'pdf',
          file_id: fileId
        })
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError)
        trace.end(false, { error: String(pdfError) })
        return NextResponse.json({ 
          error: 'PDF generation failed', 
          code: 'pdf_generation_failed',
          details: process.env.NODE_ENV === 'development' ? String(pdfError) : undefined
        }, { status: 500 })
      }
    } else {
      console.log('Generating DOCX...')
      try {
        const docxBuffer = await convertHtmlToDocument(html)
        console.log('DOCX generated successfully, size:', docxBuffer.length)
        
        const fileId = randomUUID() + '.docx'
        const path = `/tmp/${fileId}`
        
        console.log('Writing DOCX to file:', path)
        const fs = await import('fs')
        fs.writeFileSync(path, docxBuffer)
        console.log('DOCX file written successfully')
        
        trace.end(true, { size: docxBuffer.length })
        return NextResponse.json({ 
          download_url: `/api/export/${fileId}`,
          format: 'docx',
          file_id: fileId
        })
      } catch (docxError) {
        console.error('DOCX generation failed:', docxError)
        trace.end(false, { error: String(docxError) })
        return NextResponse.json({ 
          error: 'DOCX generation failed', 
          code: 'docx_generation_failed',
          details: process.env.NODE_ENV === 'development' ? String(docxError) : undefined
        }, { status: 500 })
      }
    }
  } catch (error) {
    console.error('Export API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error', 
      code: 'server_error',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
