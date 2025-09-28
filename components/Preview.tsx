'use client'

import { useMemo, useState } from 'react'
import DiffView from './DiffView'
import ATSCheck from './ATSCheck'
import ExportModal from './ExportModal'

export default function Preview({ session }:{ session:any }) {
  const [showExport, setShowExport] = useState(false)
  const [tab, setTab] = useState<'tailored'|'original'>('tailored')
  const [honesty, setHonesty] = useState<any>(null)
  const [loadingHonesty, setLoadingHonesty] = useState(false)

  const tailored = useMemo(()=>JSON.stringify(session.preview_sections_json, null, 2), [session])
  const original = useMemo(()=>JSON.stringify(session.original_sections_json, null, 2), [session])

  // expose a minimal snapshot for export fallback
  if (typeof window !== 'undefined') {
    ;(window as any).__TAILOR_SESSION__ = session
  }

  return (
    <section className="card p-6">
      <div className="flex items-center gap-4 mb-4">
        <h2>Preview</h2>
        <div className="ml-auto flex items-center gap-2">
          <button className={`button-outline ${tab==='tailored'?'border-black':''}`} onClick={()=>setTab('tailored')}>Tailored</button>
          <button className={`button-outline ${tab==='original'?'border-black':''}`} onClick={()=>setTab('original')}>Original</button>
          <button className="button-outline" onClick={async()=>{ setLoadingHonesty(true); try{ const res = await fetch('/api/honesty', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id: session.session_id })}); const data = await res.json(); if(!res.ok) throw new Error(data?.error||'Honesty scan failed'); setHonesty(data);} catch(e:any){ alert(e?.message||'Honesty scan failed') } finally { setLoadingHonesty(false) } }}>Honesty scan</button>
          <button className="button" onClick={()=>setShowExport(true)}>Export</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="label mb-2">JSON structure ({tab})</div>
          <pre className="bg-gray-50 p-3 rounded overflow-auto text-xs h-96">{tab==='tailored' ? tailored : original}</pre>
        </div>
        <div>
          <div className="label mb-2">Changes</div>
          <DiffView diffs={session.diffs || []} />
          <div className="mt-4">
            <ATSCheck stats={session.keyword_stats} />
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
