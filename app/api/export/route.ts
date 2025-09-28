import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { renderHTML, htmlToPDF } from '../../../lib/pdf-service'
import { ResumeJSON } from '../../../lib/types'
import { convertHtmlToDocument } from './util_docx'
import { enforceGuards } from '../../../lib/guards'
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
    console.log('Guard check passed')

    const trace = startTrace({ route: 'export' })
    console.log('Trace started')

    console.log('Parsing request body...')
    const body = await req.json()
    console.log('Request body parsed successfully')

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

    console.log('Getting session...')
    const s = session_id ? getSession(session_id) : null
    if (!s && !snapshot) {
      console.log('Session not found and no snapshot provided:', session_id)
      return NextResponse.json({ 
        error: 'Session expired or not found', 
        code: 'session_not_found' 
      }, { status: 404 })
    }
    console.log(s ? 'Session found' : 'Using snapshot fallback')

    console.log('Building resume object...')
    const resume: ResumeJSON = s ? {
      summary: options.includeSummary ? s.tailored.summary : '',
      skills: options.includeSkills ? s.tailored.skills_section : [],
      experience: s.tailored.experience.filter((exp:any) => exp.company && exp.role) as any,
      education: s.original.education,
      certifications: s.original.certifications
    } : {
      summary: options.includeSummary ? (snapshot?.preview_sections_json?.summary || '') : '',
      skills: options.includeSkills ? (snapshot?.preview_sections_json?.skills || []) : [],
      experience: (snapshot?.preview_sections_json?.experience || []).filter((exp:any)=>exp.company && exp.role) as any,
      education: snapshot?.original_sections_json?.education || [],
      certifications: snapshot?.original_sections_json?.certifications || []
    }
    console.log('Resume object built')

    console.log('Rendering HTML...')
    const html = await renderHTML(resume, template, { includeSkills: !!options.includeSkills, includeSummary: !!options.includeSummary })
    console.log('HTML rendered successfully')

    if (format === 'pdf') {
      console.log('Generating PDF...')
      console.log('HTML length:', html.length)
      try {
        const pdf = await htmlToPDF(html)
        console.log('PDF generated successfully, size:', pdf.length)
        if (!pdf || pdf.length === 0) throw new Error('PDF generation returned empty buffer')
        logPDFGeneration(1, true, undefined, 'external_service', pdf.length)
        trace.end(true, { size: pdf.length })
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
          const docxBuffer = await convertHtmlToDocument(html)
          logPDFGeneration(1, true, undefined, 'docx_fallback', docxBuffer.length)
          trace.end(true, { size: docxBuffer.length, fallback: 'docx' })
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
        const docxBuffer = await convertHtmlToDocument(html)
        console.log('DOCX generated successfully, size:', docxBuffer.length)
        trace.end(true, { size: docxBuffer.length })
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
