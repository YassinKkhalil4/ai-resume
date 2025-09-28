import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { renderHTML, htmlToPDF, htmlToDOCX } from '../../../lib/pdf-service'
import { ResumeJSON, TailoredResult } from '../../../lib/types'
import { enforceGuards } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { startTrace, logPDFGeneration, logError } from '../../../lib/telemetry'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

  // Declare variables outside try block for error handling
  let session_id: string | undefined
  let format: string | undefined
  let template: 'classic' | 'modern' | 'minimal' = 'minimal'

  try {
    const guard = enforceGuards(req)
    if (!guard.ok) {
      console.log('Guard check failed:', guard.res)
      return guard.res
    }
    const cfg = getConfig()
    if (cfg.pauseExport) {
      return NextResponse.json({ error: 'Export is paused', code: 'paused' }, { status: 503 })
    }
    console.log('Guard check passed')

    const trace = startTrace({ route: 'export' })
    console.log('Trace started')

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return NextResponse.json({ code: 'bad_request', message: 'JSON only' }, { status: 415 })
    }
    const body = await req.json()

    const bodyData = body || {}
    session_id = bodyData.session_id
    template = (bodyData.template as 'classic' | 'modern' | 'minimal') || 'minimal'
    format = bodyData.format || 'pdf'
    const options = bodyData.options || { includeSummary: true, includeSkills: true }
    const snapshot = bodyData.session_snapshot || null
    
    console.log('Export parameters:', {
      session_id: session_id ? 'present' : 'missing',
      template,
      format,
      options
    })

    if (!session_id && !snapshot) {
      console.log('Missing session_id and no snapshot provided')
      return NextResponse.json({ 
        error: 'Missing session context', 
        code: 'missing_session' 
      }, { status: 400 })
    }

    const session = snapshot ?? (session_id ? getSession(session_id) : null)
    if (!session) {
      return NextResponse.json({ code: 'session_not_found', message: 'No session' }, { status: 404 })
    }

    console.log('Building resume object...')
    const tailored: TailoredResult = session.tailored || session.preview_sections_json
    const original = session.original || session.original_sections_json
    const resume: ResumeJSON = {
      summary: options.includeSummary ? (tailored.summary || '') : '',
      skills: options.includeSkills ? (tailored.skills_section || []) : [],
      experience: (tailored.experience || []).filter((exp:any)=>exp.company && exp.role) as any,
      education: original?.education || [],
      certifications: original?.certifications || []
    }
    console.log('Resume object built')

    console.log('Rendering HTML...')
    const html = await renderHTML(resume, template, { includeSkills: !!options.includeSkills, includeSummary: !!options.includeSummary })
    console.log('HTML rendered successfully')

    if (format === 'pdf') {
      console.log('Generating PDF...')
      console.log('HTML length:', html.length)
      try {
        const t0 = Date.now()
        const pdf = await htmlToPDF(html)
        console.log('PDF generated successfully, size:', pdf.length)
        if (!pdf || pdf.length === 0) throw new Error('PDF generation returned empty buffer')
        const pdfMs = Date.now() - t0
        logPDFGeneration(1, true, undefined, 'external_service', pdf.length)
        trace.end(true, { size: pdf.length, pdf_ms: pdfMs })
        const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)
        return new NextResponse(pdfArrayBuffer as ArrayBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="resume.pdf"',
            'Content-Length': String(pdf.length)
          }
        })
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError)
        console.error('PDF error stack:', pdfError instanceof Error ? pdfError.stack : 'No stack trace')
        
        // Log failed PDF generation
        logPDFGeneration(1, false, String(pdfError), 'external_service')
        logError(pdfError as Error, { format, template, session_id, htmlLength: html.length })
        
        trace.end(false, { error: String(pdfError) })
        // Attempt DOCX fallback (single-shot)
        try {
          const t1 = Date.now()
          const docxBuffer = await htmlToDOCX(html)
          logPDFGeneration(1, true, undefined, 'docx_fallback', docxBuffer.length)
          trace.end(true, { size: docxBuffer.length, fallback: 'docx', docx_ms: Date.now()-t1 })
          const ab = docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength)
          return new NextResponse(ab as ArrayBuffer, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'Content-Disposition': 'attachment; filename="resume.docx"',
              'Content-Length': String(docxBuffer.length)
            }
          })
        } catch (docxFallbackError) {
          console.error('DOCX fallback failed:', docxFallbackError)
          return NextResponse.json({ 
            error: 'PDF generation failed', 
            code: 'pdf_generation_failed',
            details: process.env.NODE_ENV === 'development' ? String(pdfError) : undefined
          }, { status: 500 })
        }
      }
    } else {
      console.log('Generating DOCX...')
      try {
        const t0 = Date.now()
        const docxBuffer = await htmlToDOCX(html)
        console.log('DOCX generated successfully, size:', docxBuffer.length)
        trace.end(true, { size: docxBuffer.length, docx_ms: Date.now()-t0 })
        const ab = docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength)
        return new NextResponse(ab as ArrayBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': 'attachment; filename="resume.docx"',
            'Content-Length': String(docxBuffer.length)
          }
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
    
    // Log the error with context
    logError(error as Error, {
      route: 'export',
      session_id: session_id || 'unknown',
      format: format || 'unknown',
      template: template || 'unknown'
    })
    
    // Ensure we always return a proper JSON response
    try {
      return NextResponse.json({ 
        error: 'Internal server error', 
        code: 'server_error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    } catch (jsonError) {
      console.error('Failed to create JSON response:', jsonError)
      // Fallback to plain text response if JSON fails
      return new NextResponse('Internal server error', { status: 500 })
    }
  }
}
