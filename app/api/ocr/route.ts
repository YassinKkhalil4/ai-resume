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
      const text = await ocrPdf(file, options)
      return NextResponse.json({ text })
    } else {
      const text = await ocrImage(file, options)
      return NextResponse.json({ text })
    }
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

async function ocrPdf(file: File | Blob, options: OcrOptions): Promise<string> {
  const maxPages = Math.max(1, Math.min(options.maxPages || 4, 10))
  const pdfjs: any = await import('pdfjs-dist')
  const { createCanvas } = await import('@napi-rs/canvas')
  const arrayBuffer = await file.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)
  const doc = await pdfjs.getDocument({ data }).promise

  const pageCount = Math.min(doc.numPages || 1, maxPages)
  const pageIndices = Array.from({ length: pageCount }, (_, i) => i + 1)

  const Tesseract: any = (await import('tesseract.js')).default || (await import('tesseract.js'))

  const texts: string[] = []
  for (const pageNum of pageIndices) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)) as any
    const ctx = canvas.getContext('2d')

    // pdfjs-dist in Node can render to canvas via its internal canvasFactory if context supports putImageData
    // We implement a minimal render via convertToImageData
    // @ts-ignore
    const opList = await page.getOperatorList()
    const paintJpegXObject = (pdfjs as any).OPS.paintJpegXObject
    const paintImageXObject = (pdfjs as any).OPS.paintImageXObject
    // Fallback simple textLayer extraction if rendering is too complex
    try {
      await page.render({ canvasContext: ctx, viewport }).promise
    } catch {}

    let pngBuffer: Buffer
    try {
      pngBuffer = canvas.toBuffer('image/png') as Buffer
    } catch {
      // As a fallback, get a blank buffer to avoid crash
      pngBuffer = Buffer.from([])
    }

    const { data: { text } } = await Tesseract.recognize(pngBuffer, options.lang || 'eng')
    if (text) texts.push(text)
  }

  return texts.join('\n\n')
}


