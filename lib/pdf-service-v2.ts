import { minimalTemplate } from './templates/minimal'
import { modernTemplate } from './templates/modern'
import { classicTemplate } from './templates/classic'
import { executiveTemplate } from './templates/executive'
import { academicTemplate } from './templates/academic'
import type { ResumeJSON } from './types'
import { logPDFGeneration, logError } from './telemetry'
import { trackPDFSuccess, trackPDFFailure } from './pdf-monitoring'

export async function renderHTML(
  resume: ResumeJSON,
  template: 'classic' | 'modern' | 'minimal' | 'executive' | 'academic',
  options: { includeSkills: boolean; includeSummary: boolean }
) {
  if (template === 'classic') return classicTemplate(resume, options)
  if (template === 'modern') return modernTemplate(resume, options)
  if (template === 'executive') return executiveTemplate(resume, options)
  if (template === 'academic') return academicTemplate(resume, options)
  return minimalTemplate(resume, options)
}

// Convenience: DOCX from HTML for server routes that want a unified surface
export async function htmlToDOCX(html: string): Promise<Buffer> {
  const { convertHtmlToDocument } = await import('../app/api/export/util_docx')
  const buf = await convertHtmlToDocument(html)
  return buf
}

export async function htmlToPDF(html: string): Promise<Buffer> {
  const maxRetries = 3
  let lastError: Error | null = null

  console.log('Starting PDF generation with HTML length:', html.length)

  // Try external PDF service first (most reliable)
  try {
    console.log('Attempting external PDF service...')
    const startTime = Date.now()
    const pdfBuffer = await generatePDFWithExternalService(html)
    const responseTime = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('External PDF service returned empty buffer')
    }
    
    console.log('External PDF service successful, size:', pdfBuffer.length)
    await trackPDFSuccess('external_service', responseTime, 'high')
    logPDFGeneration(1, true, undefined, 'external_service', pdfBuffer.length)
    return pdfBuffer
  } catch (error) {
    console.warn('External PDF service failed:', error)
    lastError = error as Error
    await trackPDFFailure('external_service', String(error))
    logPDFGeneration(1, false, String(error), 'external_service')
  }

  // Try Puppeteer as fallback (if available)
  try {
    console.log('Attempting Puppeteer fallback...')
    const startTime = Date.now()
    const pdfBuffer = await generatePDFWithPuppeteer(html)
    const responseTime = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Puppeteer returned empty buffer')
    }
    
    console.log('Puppeteer fallback successful, size:', pdfBuffer.length)
    await trackPDFSuccess('puppeteer_fallback', responseTime, 'high')
    logPDFGeneration(2, true, undefined, 'puppeteer_fallback', pdfBuffer.length)
    return pdfBuffer
  } catch (error) {
    console.warn('Puppeteer fallback failed:', error)
    lastError = error as Error
    await trackPDFFailure('puppeteer_fallback', String(error))
    logPDFGeneration(2, false, String(error), 'puppeteer_fallback')
  }

  // Try basic PDF generation as final fallback
  try {
    console.log('Attempting basic PDF fallback...')
    const startTime = Date.now()
    const pdfBuffer = await createBasicPDF(html)
    const responseTime = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Basic PDF generation returned empty buffer')
    }
    
    console.log('Basic PDF fallback successful, size:', pdfBuffer.length)
    await trackPDFSuccess('basic_pdf', responseTime, 'low')
    logPDFGeneration(3, true, undefined, 'basic_pdf', pdfBuffer.length)
    return pdfBuffer
  } catch (error) {
    console.error('All PDF generation methods failed:', error)
    await trackPDFFailure('basic_pdf', String(error))
    logPDFGeneration(3, false, String(error), 'basic_pdf')
    logError(error as Error, { htmlLength: html.length, lastError: lastError?.message })
    throw new Error(`PDF generation failed: ${lastError?.message}`)
  }
}

// External PDF service integration
async function generatePDFWithExternalService(html: string): Promise<Buffer> {
  const apiKey = process.env.PDF_SERVICE_API_KEY
  const apiUrl = process.env.PDF_SERVICE_URL || 'https://api.html-pdf-service.com/generate'
  
  if (!apiKey) {
    throw new Error('PDF service API key not configured')
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      html,
      format: 'A4',
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
      printBackground: true,
      preferCSSPageSize: true,
      timeout: 30000 // 30 second timeout
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PDF service API failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const pdfBuffer = await response.arrayBuffer()
  return Buffer.from(pdfBuffer)
}

// Puppeteer fallback (for local development)
async function generatePDFWithPuppeteer(html: string): Promise<Buffer> {
  try {
    const puppeteer = await import('puppeteer')
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    try {
      const page = await browser.newPage()
      await page.emulateMediaType('screen')
      await page.setContent(html, { waitUntil: 'domcontentloaded' })
      
      const pdf = await page.pdf({
        format: 'a4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' }
      })
      
      return pdf
    } finally {
      await browser.close()
    }
  } catch (error) {
    throw new Error(`Puppeteer failed: ${error}`)
  }
}

// Basic PDF generation fallback
async function createBasicPDF(html: string): Promise<Buffer> {
  // Clean HTML for basic PDF
  const cleanHtml = html
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove complex CSS
    .replace(/class="[^"]*"/g, '') // Remove class attributes
    .replace(/style="[^"]*"/g, '') // Remove inline styles
    .replace(/<div[^>]*>/g, '<p>') // Convert divs to paragraphs
    .replace(/<\/div>/g, '</p>')
  
  // Extract text content and split into lines
  const textContent = cleanHtml
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 2000) // Limit length

  // Split text into lines (approximately 60 characters per line)
  const lines = []
  const words = textContent.split(' ')
  let currentLine = ''
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length > 60 && currentLine.length > 0) {
      lines.push(currentLine.trim())
      currentLine = word
    } else {
      currentLine += (currentLine.length > 0 ? ' ' : '') + word
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }

  // Create PDF content with multiple lines
  const lineHeight = 20
  const startY = 750
  const leftMargin = 50
  const maxLines = Math.min(lines.length, 30) // Limit to 30 lines to fit on page
  
  let pdfStream = 'BT\n'
  pdfStream += '/F1 12 Tf\n'
  
  for (let i = 0; i < maxLines; i++) {
    const y = startY - (i * lineHeight)
    if (y < 50) break // Don't go below bottom margin
    
    const line = lines[i].replace(/[()\\]/g, '\\$&') // Escape PDF special characters
    pdfStream += `${leftMargin} ${y} Td\n`
    pdfStream += `(${line}) Tj\n`
    pdfStream += '0 0 Td\n' // Reset position for next line
  }
  
  pdfStream += 'ET\n'

  // Create a minimal PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${pdfStream.length + 100}
>>
stream
${pdfStream}endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000500 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
${600 + pdfStream.length}
%%EOF`

  return Buffer.from(pdfContent, 'utf8')
}

// Alternative PDF services for redundancy
export async function generatePDFWithAlternativeService(html: string, serviceName: string): Promise<Buffer> {
  const services = {
    'htmlcsstoimage': {
      url: 'https://htmlcsstoimage.com/demo',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        css: '',
        device_scale_factor: 1,
        format: 'pdf',
        width: 210,
        height: 297
      })
    },
    'weasyprint': {
      url: process.env.WEASYPRINT_SERVICE_URL || 'https://api.weasyprint.io/html',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEASYPRINT_API_KEY}`
      },
      body: JSON.stringify({
        html,
        base_url: process.env.BASE_URL || 'https://ai-resume-tailor.vercel.app'
      })
    }
  }

  const service = services[serviceName as keyof typeof services]
  if (!service) {
    throw new Error(`Unknown PDF service: ${serviceName}`)
  }

  const response = await fetch(service.url, {
    method: service.method,
    headers: service.headers,
    body: service.body
  })

  if (!response.ok) {
    throw new Error(`PDF service ${serviceName} failed: ${response.status} ${response.statusText}`)
  }

  const pdfBuffer = await response.arrayBuffer()
  return Buffer.from(pdfBuffer)
}

// Enhanced error handling with alternative export options
export async function generatePDFWithFallback(html: string): Promise<{ buffer: Buffer; method: string; quality: 'high' | 'medium' | 'low' }> {
  const methods = [
    { name: 'external_service', fn: () => generatePDFWithExternalService(html), quality: 'high' as const },
    { name: 'puppeteer', fn: () => generatePDFWithPuppeteer(html), quality: 'high' as const },
    { name: 'basic_pdf', fn: () => createBasicPDF(html), quality: 'low' as const }
  ]

  for (const method of methods) {
    try {
      const buffer = await method.fn()
      if (buffer && buffer.length > 0) {
        return { buffer, method: method.name, quality: method.quality }
      }
    } catch (error) {
      console.warn(`PDF method ${method.name} failed:`, error)
      continue
    }
  }

  // If all methods fail, create a basic PDF
  console.warn('All PDF methods failed, creating basic PDF')
  const basicPdf = await createBasicPDF(html)
  return { buffer: basicPdf, method: 'basic_fallback', quality: 'low' }
}


// Ultimate fallback: create a simple text-based PDF
function createTextBasedPDF(html: string): Buffer {
  const textContent = html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 2000) // Limit length

  // Create a minimal PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${textContent.length + 100}
>>
stream
BT
/F1 12 Tf
50 750 Td
(${textContent.substring(0, 100)}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000500 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
${600 + textContent.length}
%%EOF`

  return Buffer.from(pdfContent, 'utf8')
}
