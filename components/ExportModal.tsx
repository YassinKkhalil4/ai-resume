'use client'

import { useState } from 'react'

export default function ExportModal({ sessionId, onClose }:{ sessionId:string, onClose:()=>void }) {
  const [template, setTemplate] = useState<'classic'|'modern'|'minimal'|'executive'|'academic'>('minimal')
  const [format, setFormat] = useState<'pdf'|'docx'>('pdf')
  const [includeSkills, setIncludeSkills] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState<string| null>(null)

  function downloadBlob(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
  }

  async function exportFile() {
    setLoading(true)
    try {
      // Include snapshot in export requests
      const snapshot = (typeof window !== 'undefined' && (window as any).__TAILOR_SESSION__) || null;
      
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          session_id: sessionId,
          template,
          format,
          options: { includeSkills, includeSummary },
          session_snapshot: snapshot
        })
      })
      if (!res.ok) {
        let err: any = null;
        try { err = await res.json(); } catch {}
        throw new Error(err?.message || `Export HTTP ${res.status}`);
      }
      const ct = res.headers.get('content-type') || '';
      const isPdf = /^application\/pdf/i.test(ct);
      const isDocx = /^application\/vnd\.openxmlformats/i.test(ct);
      if (!isPdf && !isDocx) {
        const txt = await res.text();
        throw new Error(`Malformed export response: ${txt.slice(0,300)}`);
      }
      const blob = await res.blob();
      downloadBlob(blob, isPdf ? 'resume.pdf' : 'resume.docx');
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
              <option value="executive">Executive</option>
              <option value="academic">Academic/Projects</option>
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
