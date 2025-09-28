'use client'

import { useState } from 'react'

export default function OCRBanner({ onText }: { onText: (text: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleOCR(file: File) {
    setBusy(true); setError(null)
    try {
      const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')
      if (!isPdf) throw new Error('OCR is only for scanned PDFs')

      // light client-side OCR using tesseract.js on first page preview; warn users
      const Tesseract: any = (await import('tesseract.js')).default || (await import('tesseract.js'))
      const arr = await file.arrayBuffer()
      // render first page to image using pdf.js (client) for demo
      const pdfjsLib: any = await import('pdfjs-dist')
      const pdf = await (pdfjsLib as any).getDocument({ data: arr }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: ctx, viewport }).promise
      const dataUrl = canvas.toDataURL('image/png')

      const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng')

      if (!text || text.trim().length < 30) throw new Error('OCR produced too little text')
      onText(text)
    } catch (e: any) {
      setError(e?.message || 'OCR failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 p-3 border rounded bg-yellow-50 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          Scanned PDF? Try OCR (experimental). Extracts text from the first page only.
        </div>
        <label className="button-outline cursor-pointer">
          {busy ? 'Running OCR…' : 'Run OCR'}
          <input type="file" accept="application/pdf" onChange={e=>{ const f=e.target.files?.[0]; if (f) handleOCR(f) }} hidden />
        </label>
      </div>
      {error && <div className="text-red-600 mt-2">{error}</div>}
    </div>
  )
}


