'use client'

import { useState } from 'react'

export default function JDInput({ value, onChange }:{ value:string, onChange:(v:string)=>void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const charCount = value.trim().length

  async function fetchUrl() {
    if (!url) return
    setLoading(true)
    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        body: (() => {
          const fd = new FormData()
          fd.append('jd_url', url)
          fd.append('mode', 'fetchOnly')
          return fd
        })()
      })
      const data = await res.json()
      if (res.ok && data?.jd_text) onChange(data.jd_text)
      else alert((data?.error) || 'Could not fetch that URL. Paste text instead.')
    } catch (e:any) {
      alert(e?.message || 'Failed to fetch URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-inner focus-within:border-blue-400/60 focus-within:ring-2 focus-within:ring-blue-200 dark:border-slate-800 dark:bg-slate-900/70 dark:focus-within:border-blue-500/50 dark:focus-within:ring-blue-900/50">
        <textarea
          className="h-48 w-full resize-none rounded-3xl bg-transparent px-5 py-5 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder="Paste the job description here. Include responsibilities, requirements, and key qualifications so we can match keywords precisely."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <div className="pointer-events-none absolute bottom-4 right-5 text-xs text-slate-400 dark:text-slate-500">
          {charCount.toLocaleString()} characters
        </div>
      </div>
      <div className="glass-panel flex flex-col gap-3 rounded-3xl p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Job URL</div>
          <input
            className="input mt-2 rounded-2xl border border-slate-200/70 bg-white/70 dark:border-slate-800 dark:bg-slate-900/70"
            placeholder="https://company.com/careers/role"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>
        <div className="flex items-end sm:self-stretch">
          <button
            className="button-outline w-full whitespace-nowrap sm:w-auto"
            onClick={fetchUrl}
            disabled={loading || !url}
          >
            {loading ? 'Fetching…' : 'Fetch job listing'}
          </button>
        </div>
      </div>
    </div>
  )
}
