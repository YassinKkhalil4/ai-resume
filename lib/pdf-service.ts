import { minimalTemplate } from './templates/minimal'
import { modernTemplate } from './templates/modern'
import { classicTemplate } from './templates/classic'
import { executiveTemplate } from './templates/executive'
import { academicTemplate } from './templates/academic'
import type { ResumeJSON } from './types'

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
  const maxRetries = 2
  let lastError: Error | null = null

  console.log('Starting PDF generation with HTML length:', html.length)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`PDF generation attempt ${attempt}/${maxRetries}`)
      // Try external PDF service first
      const pdfBuffer = await generatePDFWithExternalService(html)
      
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF generation returned empty buffer')
      }
      
      console.log(`PDF generation successful on attempt ${attempt}, size:`, pdfBuffer.length)
      return pdfBuffer
    } catch (error) {
      lastError = error as Error
      console.warn(`PDF generation attempt ${attempt} failed:`, error)
      
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        const delay = 1000 * attempt
        console.log(`Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // Final fallback: try lightweight HTML-to-PDF
  try {
    console.warn('All PDF service attempts failed, trying fallback method')
    return await generatePDFWithFallback(html)
  } catch (fallbackError) {
    console.error('All PDF generation methods failed:', fallbackError)
    throw new Error(`PDF generation failed after ${maxRetries} attempts: ${lastError?.message}`)
  }
}

async function generatePDFWithExternalService(html: string): Promise<Buffer> {
  const useLambda = process.env.USE_LAMBDA_CHROMIUM === '1' || process.env.VERCEL === '1';
  
  console.log('Using PDF generation method:', useLambda ? 'Lambda/Chromium' : 'Local Puppeteer')
  
  if (useLambda) {
    const chromium = await import('@sparticuz/chromium');
    const pcore = await import('puppeteer-core');

    const browser = await pcore.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless
    });

    try {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      await page.emulateMediaType('screen');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top:'18mm', right:'16mm', bottom:'18mm', left:'16mm' }
      });
      return pdf;
    } finally {
      await browser.close();
    }
  } else {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.emulateMediaType('screen');
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = await page.pdf({
        format: 'A4', printBackground: true, preferCSSPageSize: true,
        margin: { top:'18mm', right:'16mm', bottom:'18mm', left:'16mm' }
      });
      return pdf;
    } finally {
      await browser.close();
    }
  }
}

async function generatePDFWithFallback(html: string): Promise<Buffer> {
  // Fallback: Use a simple HTML-to-PDF conversion
  // This is a basic implementation that creates a minimal PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .page-break { page-break-before: always; }
        @media print {
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `

  // For now, return a simple text-based representation
  // In production, you might want to use a different service
  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
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

// Alternative: Use external PDF service API
async function generatePDFWithAPI(html: string): Promise<Buffer> {
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
      preferCSSPageSize: true
    })
  })

  if (!response.ok) {
    throw new Error(`PDF service API failed: ${response.status} ${response.statusText}`)
  }

  const pdfBuffer = await response.arrayBuffer()
  return Buffer.from(pdfBuffer)
}
