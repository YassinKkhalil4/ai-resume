import { logPDFGeneration, logError } from './telemetry'
import { trackPDFSuccess, trackPDFFailure } from './pdf-monitoring'
import type { TailoredResume } from './export-normalize'

// Null-safe HTML builder with proper defaults
type Opts = { includeSummary?: boolean; includeSkills?: boolean };

const esc = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const deriveName = (contact: TailoredResume['contact']) =>
  contact?.name ||
  `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() ||
  contact?.full_name ||
  '';

const buildContactBlock = (contact: TailoredResume['contact']) => {
  if (!contact) return '';
  const parts: string[] = [];
  if (contact.email) {
    const mail = esc(contact.email);
    parts.push(`<a href="mailto:${mail}">${mail}</a>`);
  }
  if (contact.phone) {
    const phone = esc(contact.phone);
    parts.push(`<a href="tel:${phone.replace(/[^0-9+]/g, '')}">${phone}</a>`);
  }
  if (contact.location) {
    parts.push(`<span>${esc(contact.location)}</span>`);
  }
  const custom = Object.entries(contact)
    .filter(([key]) => !['name', 'email', 'phone', 'location', 'first_name', 'last_name', 'full_name'].includes(key))
    .map(([, value]) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .map(value => `<span>${esc(value)}</span>`);
  parts.push(...custom);
  if (!parts.length) return '';
  return `<div class="contact">${parts.join(' • ')}</div>`;
};

const listHtml = (heading: string, items: string[]) => {
  if (!items.length) return '';
  return `<section><h2>${esc(heading)}</h2><ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>`;
};

const paragraphsHtml = (heading: string, items: string[]) => {
  if (!items.length) return '';
  return `<section><h2>${esc(heading)}</h2>${items.map(item => `<p>${esc(item)}</p>`).join('')}</section>`;
};

export function renderTemplateHTML(tailored: TailoredResume, template: 'classic'|'modern'|'minimal', opts: Opts) {
  const name = esc(deriveName(tailored.contact) || 'Resume');
  const contactHtml = buildContactBlock(tailored.contact);
  const summaryHtml = opts?.includeSummary !== false && tailored.summary
    ? `<section><h2>Summary</h2><p>${esc(tailored.summary)}</p></section>`
    : '';
  const skillsHtml = opts?.includeSkills !== false
    ? listHtml('Skills', tailored.skills)
    : '';

  const experienceHtml = tailored.experience.length
    ? `<section><h2>Experience</h2>${tailored.experience.map(exp => {
        const role = esc(exp.role || exp.title || '');
        const company = esc(exp.company || '');
        const dates = esc(exp.dates || '');
        const location = exp.location ? `<span>${esc(exp.location)}</span>` : '';
        const headingParts = [`<strong>${role}</strong>`];
        if (company) headingParts.push(`&mdash; ${company}`);
        const meta = [dates, location].filter(Boolean).join(' • ');
        const bullets = exp.bullets.length
          ? `<ul>${exp.bullets.map(bullet => `<li>${esc(bullet)}</li>`).join('')}</ul>`
          : '';
        return `<div class="exp">
          <div class="exp-h">
            ${headingParts.join(' ')}
            ${meta ? `<span class="meta">${meta}</span>` : ''}
          </div>
          ${bullets}
        </div>`;
      }).join('')}</section>`
    : '';

  const educationHtml = paragraphsHtml('Education', tailored.education);
  const certsHtml = listHtml('Certifications', tailored.certifications);
  const projectsHtml = tailored.projects.length
    ? `<section><h2>Projects</h2>${tailored.projects.map(project => `
        <div class="project">
          <div class="project-h"><strong>${esc(project.name)}</strong></div>
          ${project.bullets.length ? `<ul>${project.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        </div>`).join('')}</section>`
    : '';

  const additionalHtml = tailored.additional_sections.length
    ? tailored.additional_sections.map(section => paragraphsHtml(section.heading, section.lines)).join('')
    : '';

  const css = `
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Helvetica Neue",Helvetica,sans-serif;font-size:12pt;line-height:1.35;color:#111;margin:0;padding:32px;background:#fff}
  h1{margin:0 0 4pt;font-size:22pt;font-weight:700;color:#0f172a}
  h2{margin:16pt 0 6pt;font-size:12pt;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:#1e293b}
  section + section{margin-top:14pt}
  .contact{margin-top:6pt;font-size:10pt;color:#334155;display:flex;flex-wrap:wrap;gap:8px}
  .exp{margin-top:10pt}
  .exp-h{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;font-size:11.5pt;color:#0f172a}
  .exp-h .meta{margin-left:auto;font-size:10pt;color:#475569;white-space:nowrap}
  ul{margin:6pt 0 0 16pt;padding:0;list-style:disc;color:#0f172a}
  li{margin:0 0 4pt}
  p{margin:0 0 6pt}
  @page{margin:18mm 16mm}
  `;

  const html = `
    <!doctype html><html><head><meta charset="utf-8">
      <style>${css}</style>
    </head><body>
      <h1>${name}</h1>
      ${contactHtml}
      ${summaryHtml}
      ${skillsHtml}
      ${experienceHtml}
      ${educationHtml}
      ${certsHtml}
      ${projectsHtml}
      ${additionalHtml}
    </body></html>
  `;

  return html.trim();
}

export async function renderHTML(
  resume: TailoredResume,
  template: 'classic' | 'modern' | 'minimal',
  options: { includeSkills: boolean; includeSummary: boolean }
) {
  // Use the new null-safe HTML builder for all templates
  return renderTemplateHTML(resume, template, options)
}

// Convenience: DOCX from HTML for server routes that want a unified surface
export async function htmlToDOCX(html: string): Promise<Buffer> {
  const { convertHtmlToDocument } = await import('../app/api/export/util_docx')
  const buf = await convertHtmlToDocument(html)
  return buf
}

export async function htmlToPDF(html: string): Promise<Buffer> {
  let lastError: Error | null = null

  if (!html || html.trim().length === 0) {
    throw new Error('HTML content is empty or invalid')
  }

  console.log('[PDF] Starting PDF generation with HTML length:', html.length)

  // Try external PDF service first (most reliable) - PDFShift
  try {
    console.log('[PDF] Attempting PDFShift service...')
    const startTime = Date.now()
    const pdfBuffer = await generatePDFWithExternalService(html)
    const responseTime = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDFShift returned empty buffer')
    }
    
    if (pdfBuffer.length < 1024) {
      throw new Error(`PDFShift returned suspiciously small PDF (${pdfBuffer.length} bytes)`)
    }
    
    console.log(`[PDF] PDFShift successful: ${pdfBuffer.length} bytes in ${responseTime}ms`)
    await trackPDFSuccess('pdfshift', responseTime, 'high')
    logPDFGeneration(1, true, undefined, 'pdfshift', pdfBuffer.length)
    return pdfBuffer
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.warn('[PDF] PDFShift failed:', errorMessage)
    lastError = error as Error
    await trackPDFFailure('pdfshift', errorMessage)
    logPDFGeneration(1, false, errorMessage, 'pdfshift')
  }

  // Try Puppeteer as fallback (if available - mainly for local development)
  const isVercel = process.env.VERCEL === '1'
  if (!isVercel) {
    try {
      console.log('[PDF] Attempting Puppeteer fallback...')
      const startTime = Date.now()
      const pdfBuffer = await generatePDFWithPuppeteer(html)
      const responseTime = Date.now() - startTime
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Puppeteer returned empty buffer')
      }
      
      if (pdfBuffer.length < 1024) {
        throw new Error(`Puppeteer returned suspiciously small PDF (${pdfBuffer.length} bytes)`)
      }
      
      console.log(`[PDF] Puppeteer fallback successful: ${pdfBuffer.length} bytes in ${responseTime}ms`)
      await trackPDFSuccess('puppeteer_fallback', responseTime, 'high')
      logPDFGeneration(2, true, undefined, 'puppeteer_fallback', pdfBuffer.length)
      return pdfBuffer
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.warn('[PDF] Puppeteer fallback failed:', errorMessage)
      lastError = error as Error
      await trackPDFFailure('puppeteer_fallback', errorMessage)
      logPDFGeneration(2, false, errorMessage, 'puppeteer_fallback')
    }
  } else {
    console.log('[PDF] Skipping Puppeteer (not available on Vercel)')
  }

  // Try basic PDF generation as final fallback
  try {
    console.log('[PDF] Attempting basic PDF fallback (low quality)...')
    const startTime = Date.now()
    const pdfBuffer = await createBasicPDF(html)
    const responseTime = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('Basic PDF generation returned empty buffer')
    }
    
    console.log(`[PDF] Basic PDF fallback successful: ${pdfBuffer.length} bytes in ${responseTime}ms`)
    console.warn('[PDF] WARNING: Using low-quality basic PDF fallback. PDFShift should be configured for production.')
    await trackPDFSuccess('basic_pdf', responseTime, 'low')
    logPDFGeneration(3, true, undefined, 'basic_pdf', pdfBuffer.length)
    return pdfBuffer
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[PDF] All PDF generation methods failed!')
    console.error('[PDF] Last error:', lastError?.message || errorMessage)
    await trackPDFFailure('basic_pdf', errorMessage)
    logPDFGeneration(3, false, errorMessage, 'basic_pdf')
    logError(error as Error, { 
      htmlLength: html.length, 
      lastError: lastError?.message,
      pdfshiftConfigured: !!process.env.PDF_SERVICE_API_KEY
    })
    
    // Provide helpful error message
    const helpfulMessage = process.env.PDF_SERVICE_API_KEY 
      ? `PDF generation failed after all fallbacks. Last error: ${lastError?.message || errorMessage}`
      : `PDF generation failed. PDF_SERVICE_API_KEY is not configured. Please set it in your environment variables.`
    
    throw new Error(helpfulMessage)
  }
}

// External PDF service integration - PDFShift
async function generatePDFWithExternalService(html: string): Promise<Buffer> {
  const apiKey = process.env.PDF_SERVICE_API_KEY
  const apiUrl = process.env.PDF_SERVICE_URL || 'https://api.pdfshift.io/v3/convert/pdf'
  const serviceType = process.env.PDF_SERVICE_TYPE || 'pdfshift'
  
  if (!apiKey) {
    throw new Error('PDF service API key not configured. Set PDF_SERVICE_API_KEY environment variable.')
  }

  // PDFShift uses Basic Auth with format: api:api_key
  const authHeader = `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`
  
  // PDFShift API request body
  const requestBody = {
    source: html,
    format: 'A4',
    margin: '18mm 16mm',
    print_media: true,
    use_print_media: true,
    landscape: false,
    wait_for: 'networkidle0', // Wait for network to be idle
    wait: 2000, // Additional wait time in milliseconds
  }

  console.log(`[PDFShift] Generating PDF with ${serviceType}, HTML length: ${html.length} bytes`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'User-Agent': 'AI-Resume-Tailor/2.0'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let errorMessage = `PDFShift API failed: ${response.status} ${response.statusText}`
      
      try {
        const errorData = await response.json()
        if (errorData.error || errorData.message) {
          errorMessage += ` - ${errorData.error || errorData.message}`
        }
        console.error('[PDFShift] API error response:', errorData)
      } catch {
        // If JSON parsing fails, try text
        const errorText = await response.text()
        if (errorText) {
          errorMessage += ` - ${errorText.substring(0, 200)}`
          console.error('[PDFShift] API error text:', errorText)
        }
      }
      
      throw new Error(errorMessage)
    }

    // Check content type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/pdf') && !contentType.includes('application/octet-stream')) {
      const errorText = await response.text()
      throw new Error(`PDFShift returned non-PDF content: ${contentType}. Response: ${errorText.substring(0, 200)}`)
    }

    const pdfBuffer = await response.arrayBuffer()
    
    if (!pdfBuffer || pdfBuffer.byteLength < 1024) {
      throw new Error(`PDFShift returned invalid or empty PDF (${pdfBuffer.byteLength} bytes)`)
    }
    
    console.log(`[PDFShift] PDF generated successfully: ${pdfBuffer.byteLength} bytes`)
    return Buffer.from(pdfBuffer)
    
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('PDFShift API request timed out after 30 seconds')
    }
    
    // Re-throw if it's already our formatted error
    if (error.message && error.message.includes('PDFShift')) {
      throw error
    }
    
    // Wrap other errors
    throw new Error(`PDFShift API error: ${error.message || String(error)}`)
  }
}

// Puppeteer fallback (for local development only - not available on Vercel)
async function generatePDFWithPuppeteer(html: string): Promise<Buffer> {
  try {
    console.log('[Puppeteer] Launching browser...')
    // Dynamic import with error handling - puppeteer is optional
    // Use Function constructor to prevent webpack from statically analyzing this import
    const puppeteerModule = 'puppeteer'
    const puppeteer = await new Function('return import("' + puppeteerModule + '")')()
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })
    
    try {
      const page = await browser.newPage()
      await page.emulateMediaType('screen')
      
      console.log('[Puppeteer] Setting HTML content...')
      await page.setContent(html, { 
        waitUntil: 'networkidle0',
        timeout: 15000 
      })
      
      console.log('[Puppeteer] Generating PDF...')
      const pdf = await page.pdf({
        format: 'a4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' }
      })
      
      if (!pdf || pdf.length === 0) {
        throw new Error('Puppeteer generated empty PDF')
      }
      
      if (pdf.length < 1024) {
        throw new Error(`Puppeteer generated suspiciously small PDF (${pdf.length} bytes)`)
      }
      
      console.log(`[Puppeteer] PDF generated: ${pdf.length} bytes`)
      return pdf
    } finally {
      await browser.close()
    }
  } catch (error: any) {
    if (error.message && error.message.includes('Cannot find module')) {
      throw new Error('Puppeteer is not installed. Install with: npm install puppeteer')
    }
    throw new Error(`Puppeteer failed: ${error.message || String(error)}`)
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
  
  // Extract text content
  const textContent = cleanHtml
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    // Remove length limit to include full resume content

  // Create a simple, reliable PDF using a different approach
  const pdfContent = createSimplePDF(textContent)
  return Buffer.from(pdfContent, 'utf8')
}

// Create a simple PDF with proper structure
function createSimplePDF(text: string): string {
  // Split text into chunks that fit on a line
  const words = text.split(' ')
  const lines = []
  let currentLine = ''
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length > 80 && currentLine.length > 0) {
      lines.push(currentLine.trim())
      currentLine = word
    } else {
      currentLine += (currentLine.length > 0 ? ' ' : '') + word
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }

  // Allow more lines to accommodate longer resumes
  const maxLines = Math.min(lines.length, 50) // Increased from 25 to 50
  const displayLines = lines.slice(0, maxLines)

  // Create PDF content
  let content = ''
  let y = 750
  
  for (const line of displayLines) {
    if (y < 30) break // Allow more content by going closer to bottom
    const escapedLine = line.replace(/[()\\]/g, '\\$&')
    content += `50 ${y} Td (${escapedLine}) Tj 0 0 Td `
    y -= 15 // Reduced line height to fit more content
  }

  const stream = `BT /F1 12 Tf ${content}ET`
  const streamLength = stream.length

  return `%PDF-1.4
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
/Length ${streamLength}
>>
stream
${stream}endstream
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
${600 + streamLength}
%%EOF`
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
        base_url: process.env.BASE_URL || 'https://tailora.vercel.app'
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
