import { JSDOM } from 'jsdom'
import htmlDocx from 'html-docx-js'

export async function convertHtmlToDocument(html: string): Promise<Buffer> {
  const dom = new JSDOM(html)
  const cleanHtml = dom.serialize()
  const buf = htmlDocx.asBlob(cleanHtml) as Blob
  const arrayBuffer = await buf.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
