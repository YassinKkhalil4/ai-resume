'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { minimalTemplate } from '../lib/templates/minimal'
import { modernTemplate } from '../lib/templates/modern'
import { classicTemplate } from '../lib/templates/classic'
import DiffView from './DiffView'
import ATSCheck from './ATSCheck'
import ExportModal from './ExportModal'

export default function Preview({ session }:{ session:any }) {
  const [showExport, setShowExport] = useState(false)
  const [tab, setTab] = useState<'tailored'|'original'>('tailored')
  const [tpl, setTpl] = useState<'classic'|'modern'|'minimal'>('minimal')
  const [honesty, setHonesty] = useState<any>(null)
  const [loadingHonesty, setLoadingHonesty] = useState(false)
  const [diffs, setDiffs] = useState<any[]>([])
  const templateOptions: Array<{ id: 'classic' | 'modern' | 'minimal'; label: string; detail: string }> = [
    { id: 'classic', label: 'Classic', detail: 'Timeless recruiter favorite' },
    { id: 'modern', label: 'Modern', detail: 'Clean headings, clear hierarchy' },
    { id: 'minimal', label: 'Minimal', detail: 'Lean layout, ATS-first' }
  ]

  // Fix: Render HTML instead of JSON
  const tailored = useMemo(() => {
    if (!session.preview_sections_json) return '<p>No tailored content available</p>'
    return renderResumeHtml(session.preview_sections_json, tpl)
  }, [session, tpl])

  const original = useMemo(() => {
    if (!session.original_sections_json) return '<p>No original content available</p>'
    return renderResumeHtml(session.original_sections_json, tpl)
  }, [session, tpl])
  const originalRawText = session?.original_raw_text || ''

  function renderResumeHtml(resume: any, template: string): string {
    const opts = { includeSkills: true, includeSummary: true }
    if (template === 'classic') return classicTemplate(resume, opts)
    if (template === 'modern') return modernTemplate(resume, opts)
    return minimalTemplate(resume, opts)
  }

  // Persist snapshot on the client when preview renders
  useEffect(() => {
    try { 
      (window as any).__TAILOR_SESSION__ = session; 
    } catch {}
  }, [session]);

  function renderHTML() {
    const resume = session.preview_sections_json
    const opts = { includeSkills: true, includeSummary: true }
    if (tpl==='classic') return classicTemplate(resume, opts)
    if (tpl==='modern') return modernTemplate(resume, opts)
    return minimalTemplate(resume, opts)
  }

  const loadDiffs = useCallback(async () => {
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
  }, [session.session_id, session.version, session.original_sections_json, session.preview_sections_json])

  // Load diffs on component mount
  useEffect(() => {
    loadDiffs()
  }, [loadDiffs])

  async function runHonestyScan() {
    setLoadingHonesty(true)
    try {
      // Get invite code from cookie
      const inviteCode = document.cookie
        .split('; ')
        .find(row => row.startsWith('invite='))
        ?.split('=')[1]
      const decodedInviteCode = inviteCode ? decodeURIComponent(inviteCode) : ''
      
      const res = await fetch('/api/honesty', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-invite-code': decodedInviteCode
        }, 
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
    <section className="card space-y-8 p-8 shadow-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tailored resume preview</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review edits, compare against the original, and export when you’re confident every bullet is backed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-slate-200/70 bg-white/80 p-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <button
              className={`rounded-full px-4 py-1.5 transition ${
                tab === 'tailored'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/40'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/80'
              }`}
              onClick={() => setTab('tailored')}
              type="button"
            >
              Tailored
            </button>
            <button
              className={`rounded-full px-4 py-1.5 transition ${
                tab === 'original'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/40'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800/80'
              }`}
              onClick={() => setTab('original')}
              type="button"
            >
              Original
            </button>
          </div>
          <button className="button-outline" onClick={runHonestyScan} disabled={loadingHonesty}>
            {loadingHonesty ? 'Scanning…' : 'Run honesty scan'}
          </button>
          <button className="button" onClick={() => setShowExport(true)}>
            Export resume
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Template style
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {templateOptions.map(option => {
            const active = tpl === option.id
            return (
              <button
                key={option.id}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-blue-500/70 bg-blue-500/10 text-blue-600 shadow-md dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-200'
                    : 'border-slate-200/70 bg-white/90 hover:border-blue-400/40 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-500/40'
                }`}
                onClick={() => setTpl(option.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{option.label}</span>
                  {active && <span className="text-xs text-blue-500 dark:text-blue-200">Selected</span>}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{option.detail}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="glass-panel rounded-3xl p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {tab === 'tailored'
                ? 'Tailored version — fully editable and ATS compliant'
                : 'Original resume — parsed view with full text reference'}
            </span>
            <span className="rounded-full border border-slate-200/60 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:border-slate-700 dark:bg-slate-900/70">
              {tpl}
            </span>
          </div>
          <div className="h-[26rem] w-full overflow-auto rounded-2xl border border-slate-200/70 bg-white/90 p-4 text-xs leading-relaxed text-slate-700 shadow-inner dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
            {tab === 'tailored' ? (
              <div dangerouslySetInnerHTML={{ __html: tailored }} />
            ) : (
              <>
                <div dangerouslySetInnerHTML={{ __html: original }} />
                {originalRawText && (
                  <div className="mt-4 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:text-slate-300">
                    <div className="mb-2 font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Full upload text
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {originalRawText}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Changes</div>
            <div className="mt-3">
              <DiffView diffs={diffs} />
            </div>
          </div>
          <div className="glass-panel rounded-3xl p-5 shadow-lg">
            <ATSCheck stats={session.keyword_stats} />
          </div>
          <div className="glass-panel rounded-3xl p-5 shadow-lg">
            <div className="label mb-2">Visual preview</div>
            <iframe
              className="h-80 w-full rounded-2xl border border-slate-200/70 bg-white shadow-inner dark:border-slate-800 dark:bg-slate-950"
              srcDoc={renderHTML()}
            />
          </div>
        </div>
      </div>

      {honesty && (
        <div className="glass-panel rounded-3xl border border-emerald-400/30 p-5 shadow-lg dark:border-emerald-400/20">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">Honesty scan results</div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
              {honesty.flags?.length ? `${honesty.flags.length} review needed` : 'All clear'}
            </span>
          </div>
          {honesty.flags?.length ? (
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              {honesty.flags.map((f: any, i: number) => (
                <div key={i} className="rounded-2xl border border-amber-400/30 bg-amber-50/70 p-3 dark:border-amber-400/30 dark:bg-amber-900/30">
                  <div className="font-semibold text-amber-700 dark:text-amber-200">
                    ⚠️ {f.role}: {f.bullet}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-700/80 dark:text-amber-200/70">
                    Supported by: {(f.backing || []).join(' | ') || 'No close match detected in the original resume.'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-50/70 p-3 text-xs text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-900/30 dark:text-emerald-200">
              Every tailored bullet is backed by your original experience. You’re good to go.
            </div>
          )}
        </div>
      )}

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </section>
  )
}
