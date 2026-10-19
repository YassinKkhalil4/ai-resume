import { sanitizeHtmlForDocx } from './docx-sanitize'
import htmlDocx from 'html-docx-js'

export async function htmlToDocxSafe(html: string): Promise<Buffer> {
  const clean = sanitizeHtmlForDocx(html)
  // html-docx-js returns a Blob on Node 18+, not a Buffer
  const blob = htmlDocx.asBlob(clean) as unknown as Blob
  const buf = Buffer.from(await blob.arrayBuffer())
  if (!buf || buf.length < 1024) {
    throw new Error('docx_generation_failed_too_small')
  }
  return buf
}
