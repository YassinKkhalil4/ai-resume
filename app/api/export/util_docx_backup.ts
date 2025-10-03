import { JSDOM } from 'jsdom'
import htmlDocx from 'html-docx-js'
import sanitizeHtml from 'sanitize-html'

export async function convertHtmlToDocument(html: string): Promise<Buffer> {
  // First sanitize HTML to remove complex CSS and problematic elements
  const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1','h2','h3','ul','li','strong','em']),
    allowedAttributes: { '*': [] } // strip inline styles; DOCX does not like complex CSS
  })
  
  // Normalize for DOCX compatibility
  const normalized = normalizeForDocx(clean)
  
  const buf = htmlDocx.asBlob(normalized) as Blob
  const arrayBuffer = await buf.arrayBuffer()
  return Buffer.from(arrayBuffer)
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
