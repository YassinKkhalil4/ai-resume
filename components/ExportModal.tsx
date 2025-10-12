'use client'

import { useState } from 'react'

export default function ExportModal({ onClose }:{ onClose:()=>void }) {
  const [template, setTemplate] = useState<'classic'|'modern'|'minimal'>('minimal')
  const [format, setFormat] = useState<'pdf'|'docx'>('pdf')
  const [includeSkills, setIncludeSkills] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)
  const [loading, setLoading] = useState(false)

  async function exportFile() {
    setLoading(true)
    try {
      // Get the snapshot directly from the preview state
      const previewJson = (typeof window !== 'undefined' && (window as any).__TAILOR_SESSION__) || null;
      
      // Guard clause: ensure we have preview data
      if (!previewJson) {
        alert('Nothing to export yet. Please tailor your resume first.');
        setLoading(false);
        return;
      }
      
      // inside your export handler
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,                  // 'pdf' | 'docx'
          template,                // 'classic' | 'modern' | 'minimal'
          options: { includeSummary, includeSkills },
          session_snapshot: previewJson, // <<< full tailored result JSON from Preview
        }),
      });

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) {
        const err = ct.includes('application/json') ? await res.json() : { code: 'export_failed', message: await res.text() };
        throw new Error(`${err.code}: ${err.message}`);
      }
      if (format === 'pdf' && !ct.startsWith('application/pdf')) {
        const body = await res.text().catch(() => '');
        throw new Error(`pdf_bad_content_type: ${ct} body: ${body.slice(0, 200)}`);
      }

      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `resume.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
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
        </div>
        <div className="text-xs text-gray-500 mt-3">DOCX exports instantly. PDF may take a few seconds. All exports are text-selectable and ATS-safe.</div>
      </div>
    </div>
  )
}
