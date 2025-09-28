import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type OcrOptions = {
  maxPages?: number
  lang?: string
  denoise?: boolean
  deskew?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as unknown as File | null
    const optionsRaw = form.get('options')?.toString() || '{}'
    const options: OcrOptions = safeJson(optionsRaw) || {}

    if (!file) {
      return NextResponse.json({ code: 'bad_request', message: 'Missing file' }, { status: 400 })
    }

    const mime = (file as any).type || ''
    const name = (file as any).name || ''
    const lower = (name||'').toLowerCase()
    const isPdf = mime.includes('pdf') || lower.endsWith('.pdf')
    if (isPdf) {
      return NextResponse.json({ code: 'unsupported_pdf', message: 'Server OCR worker supports images only in this deployment. Rasterize client-side or use external OCR_ENDPOINT.' }, { status: 415 })
    }
    const text = await ocrImage(file, options)
    return NextResponse.json({ text })
  } catch (err:any) {
    return NextResponse.json({ code: 'ocr_failed', message: err?.message || 'OCR failed' }, { status: 500 })
  }
}

function safeJson(s:string) {
  try { return JSON.parse(s) } catch { return null }
}

async function ocrImage(file: File | Blob, options: OcrOptions): Promise<string> {
  const Tesseract: any = (await import('tesseract.js')).default || (await import('tesseract.js'))
  const arrayBuffer = await file.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)
  // Optional denoise: simple pass-through for now; tesseract is resilient
  const { data: { text } } = await Tesseract.recognize(buf, options.lang || 'eng')
  return (text || '').toString()
}

// Note: PDF rasterization requires native canvas or external service; not supported here.


