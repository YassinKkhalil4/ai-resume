import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '../../../lib/sessions'
import { renderHTML, htmlToPDF, htmlToDOCX, generatePDFWithFallback } from '../../../lib/pdf-service-v2'
import { ResumeJSON, TailoredResult } from '../../../lib/types'
import { enforceGuards } from '../../../lib/guards'
import { getConfig } from '../../../lib/config'
import { startTrace, logPDFGeneration, logError, logRequestTelemetry } from '../../../lib/telemetry'

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
      return NextResponse.json({ code: 'export_paused', message: 'Export functionality is temporarily disabled' }, { status: 503 })
    }
    console.log('Guard check passed')

    const trace = startTrace({ route: 'export' })
    console.log('Trace started')

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return NextResponse.json({ code: 'invalid_content_type', message: 'Request must be JSON format' }, { status: 415 })
    }
    const body = await req.json();

    const {
      session_id,
      template = 'minimal',
      format = 'pdf',
      options = { includeSummary: true, includeSkills: true },
      session_snapshot
    } = body || {};

    const s = session_snapshot ?? (session_id ? getSession(session_id) : null);

    if (!s) {
      return NextResponse.json({ code: 'session_not_found', message: 'No session data available' }, { status: 404 });
    }
    
    console.log('Export parameters:', {
      session_id: session_id ? 'present' : 'missing',
      template,
      format,
      options,
      has_snapshot: !!session_snapshot
    })

    console.log('Building resume object...')
    const tailored: TailoredResult = s.tailored || s.preview_sections_json
    const original = s.original || s.original_sections_json
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
        
        // Try enhanced PDF generation with multiple fallbacks
        const pdfResult = await generatePDFWithFallback(html)
        const pdf = pdfResult.buffer
        const pdfMethod = pdfResult.method
        const pdfQuality = pdfResult.quality
        
        console.log(`PDF generated successfully using ${pdfMethod} (${pdfQuality} quality), size:`, pdf.length)
        if (!pdf || pdf.length === 0) throw new Error('PDF generation returned empty buffer')
        
        const pdfMs = Date.now() - t0
        logPDFGeneration(1, true, undefined, pdfMethod, pdf.length)
        
        // Log successful PDF export telemetry
        logRequestTelemetry({
          req_id: trace.id,
          route: 'export',
          timing: Date.now() - (trace as any).startTime,
          pdf_launch_ms: pdfMs,
          pdf_render_ms: pdfMs,
          final_status: 'success',
          was_snapshot_used: !!session_snapshot,
          additional_metrics: { 
            format: 'pdf',
            template,
            html_length: html.length,
            pdf_size: pdf.length,
            pdf_method: pdfMethod,
            pdf_quality: pdfQuality
          }
        })
        
        trace.end(true, { size: pdf.length, pdf_ms: pdfMs, method: pdfMethod, quality: pdfQuality })
        const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)
        
        // Add quality warning header for low-quality PDFs
        const headers: Record<string, string> = {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="resume.pdf"',
          'Content-Length': String(pdf.length)
        }
        
        if (pdfQuality === 'low') {
          headers['X-PDF-Quality'] = 'low'
          headers['X-PDF-Method'] = pdfMethod
        }
        
        return new NextResponse(pdfArrayBuffer as ArrayBuffer, { headers })
      } catch (pdfError) {
        console.error('All PDF generation methods failed:', pdfError)
        console.error('PDF error stack:', pdfError instanceof Error ? pdfError.stack : 'No stack trace')
        
        // Log failed PDF generation
        logPDFGeneration(1, false, String(pdfError), 'all_methods_failed')
        logError(pdfError as Error, { format, template, session_id, htmlLength: html.length })
        
        trace.end(false, { error: String(pdfError) })
        
        // Attempt DOCX fallback as last resort
        try {
          console.log('Attempting DOCX fallback...')
          const t1 = Date.now()
          const docxBuffer = await htmlToDOCX(html)
          const docxMs = Date.now() - t1
          logPDFGeneration(1, true, undefined, 'docx_fallback', docxBuffer.length)
          
          // Log successful DOCX fallback telemetry
          logRequestTelemetry({
            req_id: trace.id,
            route: 'export',
            timing: Date.now() - (trace as any).startTime,
            docx_ms: docxMs,
            final_status: 'success',
            was_snapshot_used: !!session_snapshot,
            additional_metrics: { 
              format: 'docx_fallback',
              template,
              html_length: html.length,
              docx_size: docxBuffer.length,
              pdf_failed: true
            }
          })
          
          trace.end(true, { size: docxBuffer.length, fallback: 'docx', docx_ms: docxMs })
          const ab = docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength)
          return new NextResponse(ab as ArrayBuffer, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'Content-Disposition': 'attachment; filename="resume.docx"',
              'Content-Length': String(docxBuffer.length),
              'X-Fallback-Reason': 'PDF generation failed'
            }
          })
        } catch (docxFallbackError) {
          console.error('DOCX fallback also failed:', docxFallbackError)
          return NextResponse.json({ 
            code: 'export_generation_failed', 
            message: 'Failed to generate both PDF and DOCX files. Please try again or contact support.',
            details: process.env.NODE_ENV === 'development' ? String(pdfError) : undefined,
            fallback_suggestion: 'Try exporting as DOCX format instead'
          }, { status: 500 })
        }
      }
    } else {
      console.log('Generating DOCX...')
      try {
        const t0 = Date.now()
        const docxBuffer = await htmlToDOCX(html)
        console.log('DOCX generated successfully, size:', docxBuffer.length)
        const docxMs = Date.now() - t0
        
        // Log successful DOCX export telemetry
        logRequestTelemetry({
          req_id: trace.id,
          route: 'export',
          timing: Date.now() - (trace as any).startTime,
          docx_ms: docxMs,
          final_status: 'success',
          was_snapshot_used: !!session_snapshot,
          additional_metrics: { 
            format: 'docx',
            template,
            html_length: html.length,
            docx_size: docxBuffer.length
          }
        })
        
        trace.end(true, { size: docxBuffer.length, docx_ms: docxMs })
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
          code: 'docx_generation_failed', 
          message: 'Failed to generate DOCX file',
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
        code: 'server_error', 
        message: 'An unexpected error occurred during export',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    } catch (jsonError) {
      console.error('Failed to create JSON response:', jsonError)
      // Fallback to JSON response even if JSON creation fails
      return NextResponse.json({ 
        code: 'server_error', 
        message: 'An unexpected error occurred'
      }, { status: 500 })
    }
  }
}
