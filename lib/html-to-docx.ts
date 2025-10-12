import { sanitizeHtmlForDocx } from './docx-sanitize'
import htmlDocx from 'html-docx-js'

export async function htmlToDocxSafe(html: string): Promise<Buffer> {
  const clean = sanitizeHtmlForDocx(html)
  const buf = htmlDocx.asBlob(clean) as unknown as Buffer
  if (!buf || buf.length < 1024*5) {
    throw new Error('docx_generation_failed_too_small')
  }
  return buf
}
