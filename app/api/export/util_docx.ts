import { JSDOM } from 'jsdom'
import htmlDocx from 'html-docx-js'
import sanitizeHtml from 'sanitize-html'

export async function convertHtmlToDocument(html: string): Promise<Buffer> {
  try {
    // Create a much simpler HTML structure that html-docx-js can handle
    const simpleHtml = createSimpleHtml(html)
    
    const buf = htmlDocx.asBlob(simpleHtml) as Blob
    const arrayBuffer = await buf.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('DOCX generation failed:', error)
    // Fallback: create a basic text document
    return createBasicDocx(html)
  }
}

function createSimpleHtml(html: string): string {
  // Extract text content and create simple paragraphs
  const textContent = html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  const lines = textContent.split(' ').filter(word => word.length > 0)
  const paragraphs = []
  
  for (let i = 0; i < lines.length; i += 10) {
    const paragraph = lines.slice(i, i + 10).join(' ')
    if (paragraph.trim()) {
      paragraphs.push(`<p>${paragraph}</p>`)
    }
  }
  
  return `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          p { margin: 10px 0; }
        </style>
      </head>
      <body>
        ${paragraphs.join('')}
      </body>
    </html>
  `
}

async function createBasicDocx(html: string): Promise<Buffer> {
  const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  
  const simpleHtml = `
    <html>
      <body>
        <h1>Resume</h1>
        <p>${textContent.substring(0, 2000)}</p>
      </body>
    </html>
  `
  
  try {
    const buf = htmlDocx.asBlob(simpleHtml) as Blob
    const arrayBuffer = await buf.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('Even simple DOCX creation failed:', error)
    // Ultimate fallback
    return Buffer.from('DOCX generation failed. Please try PDF export instead.', 'utf8')
  }
}

function normalizeForDocx(html: string): string {
  const dom = new JSDOM(html)
  const document = (dom as any).window.document
  
  // Remove all style attributes and complex CSS
  const allElements = document.querySelectorAll('*')
  allElements.forEach((el: any) => {
    el.removeAttribute('style')
    el.removeAttribute('class')
  })
  
  // Convert div elements to paragraphs where appropriate
  const divs = document.querySelectorAll('div')
  divs.forEach((div: any) => {
    if (div.children.length === 0 && div.textContent?.trim()) {
      const p = document.createElement('p')
      p.textContent = div.textContent
      div.parentNode?.replaceChild(p, div)
    }
  })
  
  // Ensure proper paragraph structure
  const body = document.body
  if (body) {
    const children = Array.from(body.children)
    children.forEach((child: any) => {
      if (child.tagName === 'DIV' && child.children.length === 0) {
        const p = document.createElement('p')
        p.textContent = child.textContent || ''
        body.replaceChild(p, child)
      }
    })
  }
  
  return dom.serialize()
}
