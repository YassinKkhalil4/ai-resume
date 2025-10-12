'use client'

import { useMemo, useState } from 'react'

type Diff = { role:string, original:string[], tailored:string[], reasons?:string[] }

export default function DiffView({ diffs }:{ diffs: Diff[] }) {
  const [filter, setFilter] = useState<string>('all')
  const roles = useMemo(()=>['all', ...new Set(diffs.map(d=>d.role))], [diffs])
  const shown = useMemo(()=> diffs.filter(d => filter==='all' || d.role===filter), [diffs, filter])

  return (
    <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200/70 bg-white/90 p-4 text-xs leading-relaxed text-slate-600 shadow-inner dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Section</span>
        <select
          className="rounded-full border border-slate-200/60 bg-white/80 px-3 py-1 text-xs text-slate-600 shadow-sm focus:border-blue-400/70 focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          {roles.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      {shown.length === 0 && <div className="text-slate-400 dark:text-slate-500">No changes.</div>}
      {shown.map((d, i) => (
        <div key={i} className="mb-4 rounded-2xl border border-slate-200/60 bg-white/75 p-3 shadow-sm last:mb-0 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold text-slate-800 dark:text-slate-100">{d.role}</div>
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-blue-600 dark:bg-blue-500/20 dark:text-blue-200">
              {d.tailored.length} bullets
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Original</div>
              <ul className="mt-1 space-y-1 border-l-2 border-dashed border-slate-200 pl-3 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {d.original.map((b, bi) => (
                  <li key={bi} className="line-through decoration-slate-400/70">{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Tailored</div>
              <ul className="mt-1 space-y-1 border-l-2 border-blue-300/50 pl-3 text-slate-700 dark:border-blue-500/40 dark:text-slate-200">
                {d.tailored.map((b, bi) => (
                  <li
                    key={bi}
                    className="rounded-md bg-blue-500/10 px-2 py-1 font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-200"
                    title={(d.reasons || []).join(' • ')}
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
