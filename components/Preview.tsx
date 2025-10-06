'use client'

import { useMemo, useState, useEffect } from 'react'
import { minimalTemplate } from '../lib/templates/minimal'
import { modernTemplate } from '../lib/templates/modern'
import { classicTemplate } from '../lib/templates/classic'
import { executiveTemplate } from '../lib/templates/executive'
import { academicTemplate } from '../lib/templates/academic'
import DiffView from './DiffView'
import ATSCheck from './ATSCheck'
import ExportModal from './ExportModal'

export default function Preview({ session }:{ session:any }) {
  const [showExport, setShowExport] = useState(false)
  const [tab, setTab] = useState<'tailored'|'original'>('tailored')
  const [tpl, setTpl] = useState<'classic'|'modern'|'minimal'|'executive'|'academic'>('minimal')
  const [honesty, setHonesty] = useState<any>(null)
  const [loadingHonesty, setLoadingHonesty] = useState(false)
  const [diffs, setDiffs] = useState<any[]>([])

  // Fix: Render HTML instead of JSON
  const tailored = useMemo(() => {
    if (!session.preview_sections_json) return '<p>No tailored content available</p>'
    return renderResumeHtml(session.preview_sections_json, tpl)
  }, [session, tpl])

  const original = useMemo(() => {
    if (!session.original_sections_json) return '<p>No original content available</p>'
    return renderResumeHtml(session.original_sections_json, tpl)
  }, [session, tpl])

  function renderResumeHtml(resume: any, template: string): string {
    const opts = { includeSkills: true, includeSummary: true }
    if (template === 'classic') return classicTemplate(resume, opts)
    if (template === 'modern') return modernTemplate(resume, opts)
    if (template === 'executive') return executiveTemplate(resume, opts)
    if (template === 'academic') return academicTemplate(resume, opts)
    return minimalTemplate(resume, opts)
  }

  // Persist snapshot on the client when preview renders
  useEffect(() => {
    try { 
      (window as any).__TAILOR_SESSION__ = session; 
    } catch {}
  }, [session]);

  // Load diffs on component mount
  useEffect(() => {
    loadDiffs()
  }, [session])

  function renderHTML() {
    const resume = session.preview_sections_json
    const opts = { includeSkills: true, includeSummary: true }
    if (tpl==='classic') return classicTemplate(resume, opts)
    if (tpl==='modern') return modernTemplate(resume, opts)
    if (tpl==='executive') return executiveTemplate(resume, opts)
    if (tpl==='academic') return academicTemplate(resume, opts)
    return minimalTemplate(resume, opts)
  }

  async function loadDiffs() {
    try {
      const res = await fetch('/api/diff', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          session_id: session.session_id,
          session_version: session.version,
          // Pass direct payloads to avoid session dependency
          original_payload: session.original_sections_json,
          tailored_payload: session.preview_sections_json
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        setDiffs(data.diffs || [])
      } else if (data.code === 'stale_session') {
        console.warn('Session is stale, refreshing...')
        // Could trigger a page refresh or show a warning
        alert('Session data is outdated. Please refresh the page.')
      }
    } catch (error) {
      console.error('Failed to load diffs:', error)
    }
  }

  async function runHonestyScan() {
    setLoadingHonesty(true)
    try {
      const res = await fetch('/api/honesty', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          session_id: session.session_id,
          session_version: session.version,
          // Pass direct payloads to avoid session dependency
          original_payload: session.original_sections_json,
          tailored_payload: session.preview_sections_json
        })
      })
      
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'stale_session') {
          alert('Session data is outdated. Please refresh the page and try again.')
          return
        }
        throw new Error(data?.message || 'Honesty scan failed')
      }
      setHonesty(data)
    } catch (e: any) {
      alert(e?.message || 'Honesty scan failed')
    } finally {
      setLoadingHonesty(false)
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-4 mb-4">
        <h2>Preview</h2>
        <div className="ml-auto flex items-center gap-2">
          <button className={`button-outline ${tab==='tailored'?'border-black':''}`} onClick={()=>setTab('tailored')}>Tailored</button>
          <button className={`button-outline ${tab==='original'?'border-black':''}`} onClick={()=>setTab('original')}>Original</button>
          <button className="button-outline" onClick={runHonestyScan} disabled={loadingHonesty}>
            {loadingHonesty ? 'Scanning...' : 'Honesty scan'}
          </button>
          <button className="button" onClick={()=>setShowExport(true)}>Export</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="label">Template</div>
        <select className="input w-auto" value={tpl} onChange={e=>setTpl(e.target.value as any)}>
          <option value="classic">Classic</option>
          <option value="modern">Modern</option>
          <option value="minimal">Minimal</option>
          <option value="executive">Executive</option>
          <option value="academic">Academic/Projects</option>
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="label mb-2">Resume Preview ({tab})</div>
          <div className="bg-gray-50 p-3 rounded overflow-auto text-xs h-96 border" 
               dangerouslySetInnerHTML={{ __html: tab==='tailored' ? tailored : original }} />
        </div>
        <div>
          <div className="label mb-2">Changes</div>
          <DiffView diffs={diffs} />
          <div className="mt-4">
            <ATSCheck stats={session.keyword_stats} />
          </div>
          <div className="mt-4">
            <div className="label mb-2">Visual preview</div>
            <iframe className="w-full h-96 bg-white border rounded" srcDoc={renderHTML()} />
          </div>
        </div>
      </div>

      {honesty && (
        <div className="mt-4 border rounded-md p-3 bg-white">
          <div className="font-medium mb-1">Honesty scan</div>
          {honesty.flags?.length? honesty.flags.map((f:any,i:number)=>(
            <div key={i} className="mb-2 text-xs">
              <div>⚠️ <strong>{f.role}</strong>: {f.bullet}</div>
              <div className="text-gray-600">Backed by: {(f.backing||[]).join(' | ') || 'No close match in original.'}</div>
            </div>
          )) : <div className="text-xs text-green-700">All rewritten bullets appear supported by the original.</div>}
        </div>
      )}

      {showExport && <ExportModal sessionId={session.session_id} onClose={()=>setShowExport(false)} />}
    </section>
  )
}
