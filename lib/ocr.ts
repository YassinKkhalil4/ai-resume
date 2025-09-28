/**
 * Server-side OCR client for calling an external OCR worker/microservice.
 * The worker is expected to accept multipart/form-data with fields:
 *  - file: PDF or image blob
 *  - options: JSON string for OCR options { maxPages, lang, denoise, deskew }
 * And respond with JSON: { text: string }
 */

export type OcrOptions = {
  maxPages?: number
  lang?: string
  denoise?: boolean
  deskew?: boolean
}

export async function ocrExtractText(file: Blob, options: OcrOptions = {}): Promise<string> {
  const endpoint = process.env.OCR_ENDPOINT || ''
  if (!endpoint) throw new Error('OCR endpoint not configured')

  const fd = new FormData()
  const filename = (file as any).name || 'upload.pdf'
  fd.append('file', file, filename)
  fd.append('options', JSON.stringify({
    maxPages: options.maxPages ?? 4,
    lang: options.lang ?? 'eng',
    denoise: options.denoise ?? true,
    deskew: options.deskew ?? true
  }))

  const headers: Record<string, string> = {}
  if (process.env.OCR_API_KEY) headers['x-api-key'] = process.env.OCR_API_KEY as string

  const res = await fetch(endpoint, { method: 'POST', body: fd as any, headers })
  if (!res.ok) {
    const msg = await safeText(res)
    throw new Error(`OCR failed (${res.status}): ${msg}`)
  }
  let json: any
  try { json = await res.json() } catch { throw new Error('OCR returned non-JSON') }
  const text = (json?.text || '').toString()
  return text
}

async function safeText(res: Response): Promise<string> {
  try { return (await res.text()).slice(0, 500) } catch { return '' }
}


