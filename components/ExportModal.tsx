'use client'

import { useState } from 'react'

export default function ExportModal({ sessionId, onClose }:{ sessionId:string, onClose:()=>void }) {
  const [template, setTemplate] = useState<'classic'|'modern'|'minimal'>('minimal')
  const [format, setFormat] = useState<'pdf'|'docx'>('pdf')
  const [includeSkills, setIncludeSkills] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState<string| null>(null)

  async function exportFile() {
    setLoading(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          session_id: sessionId,
          template,
          format,
          options: { includeSkills, includeSummary },
          // provide snapshot fallback so export works even if memory session expired
          session_snapshot: (window as any).__TAILOR_SESSION__ || null
        })
      })
      // Read as text first to avoid JSON parse errors on empty/body-less responses
      const rawText = await res.text()
      let data: any = null
      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch {
        data = null
      }
      if (!res.ok) {
        const message = (data && (data.error || data.message)) || rawText || `Export failed (${res.status})`
        throw new Error(typeof message === 'string' ? message : 'Export failed')
      }
      if (!data || !data.download_url) {
        throw new Error('Malformed response from export API')
      }
      setUrl(data.download_url)
    } catch (e:any) {
      alert(e?.message || 'Failed to export.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="card p-6 w-[560px] max-w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">Export</div>
          <button className="button-outline" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Template</div>
            <select className="input" value={template} onChange={e=>setTemplate(e.target.value as any)}>
              <option value="classic">Classic</option>
              <option value="modern">Modern</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div>
            <div className="label mb-1">Format</div>
            <select className="input" value={format} onChange={e=>setFormat(e.target.value as any)}>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeSummary} onChange={e=>setIncludeSummary(e.target.checked)} />Include Summary</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeSkills} onChange={e=>setIncludeSkills(e.target.checked)} />Include Skills</label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="button" onClick={exportFile} disabled={loading}>{loading?'Exporting…':'Export'}</button>
          {url && <a className="button-outline" href={url} target="_blank" rel="noreferrer">Download</a>}
        </div>
        <div className="text-xs text-gray-500 mt-3">DOCX exports instantly. PDF may take a few seconds. All exports are text-selectable and ATS-safe.</div>
      </div>
    </div>
  )
}
