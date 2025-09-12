'use client'

import { useMemo, useState } from 'react'

type Diff = { role:string, original:string[], tailored:string[], reasons?:string[] }

export default function DiffView({ diffs }:{ diffs: Diff[] }) {
  const [filter, setFilter] = useState<string>('all')
  const roles = useMemo(()=>['all', ...new Set(diffs.map(d=>d.role))], [diffs])
  const shown = useMemo(()=> diffs.filter(d => filter==='all' || d.role===filter), [diffs, filter])

  return (
    <div className="border rounded-md p-3 bg-gray-50 text-xs max-h-96 overflow-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="label">Section</span>
        <select className="input w-auto" value={filter} onChange={e=>setFilter(e.target.value)}>
          {roles.map(r=>(<option key={r} value={r}>{r}</option>))}
        </select>
      </div>
      {shown.length===0 && <div className="text-gray-500">No changes.</div>}
      {shown.map((d, i) => (
        <div key={i} className="mb-4">
          <div className="font-medium">{d.role}</div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div>
              <div className="label">Original</div>
              <ul className="list-disc pl-4">
                {d.original.map((b, bi)=>(<li key={bi} className="line-through text-gray-500">{b}</li>))}
              </ul>
            </div>
            <div>
              <div className="label">Tailored</div>
              <ul className="list-disc pl-4">
                {d.tailored.map((b, bi)=>(
                  <li key={bi} className="text-green-700 underline decoration-green-400" title={(d.reasons||[]).join(' • ')}>
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
