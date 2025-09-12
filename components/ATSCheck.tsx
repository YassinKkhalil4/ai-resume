'use client'

export default function ATSCheck({ stats }:{ stats:any }) {
  const pct = Math.round((stats?.coverage || 0) * 100)
  const mustPct = Math.round((stats?.mustCoverage || 0) * 100)
  const nicePct = Math.round((stats?.niceCoverage || 0) * 100)

  return (
    <div className="border rounded-md p-3 bg-white">
      <div className="font-medium mb-1">ATS Check</div>
      <div className="text-sm text-gray-600 mb-2">Keyword coverage and sanity checks.</div>
      <div className="flex items-center gap-3">
        <div className="w-full bg-gray-100 h-2 rounded">
          <div className="h-2 rounded" style={{ width: pct + '%', background: pct>=80 ? '#10B981' : pct>=60 ? '#F59E0B' : '#EF4444' }} />
        </div>
        <div className="text-sm">{pct}% overall</div>
      </div>

      <div className="mt-2 text-xs text-gray-600">Must-haves</div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-full bg-gray-100 h-2 rounded">
          <div className="h-2 rounded" style={{ width: mustPct + '%', background: mustPct>=80 ? '#10B981' : mustPct>=60 ? '#F59E0B' : '#EF4444' }} />
        </div>
        <div className="text-sm">{mustPct}%</div>
      </div>
      <div className="mt-2 text-xs text-gray-600">Nice-to-haves</div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-full bg-gray-100 h-2 rounded">
          <div className="h-2 rounded" style={{ width: nicePct + '%', background: nicePct>=80 ? '#10B981' : nicePct>=60 ? '#F59E0B' : '#EF4444' }} />
        </div>
        <div className="text-sm">{nicePct}%</div>
      </div>

      <div className="text-xs mb-2"><strong>Top missing:</strong> {(stats?.topMissing||[]).slice(0,5).join(', ')||'—'}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="label">Matched</div>
          <div className="flex flex-wrap gap-1">
            {(stats?.matched||[]).slice(0,20).map((k:string, i:number)=>(<span key={i} className="badge border-green-300">{k}</span>))}
          </div>
        </div>
        <div>
          <div className="label">Missing (relevant)</div>
          <div className="flex flex-wrap gap-1">
            {(stats?.missing||[]).slice(0,20).map((k:string, i:number)=>(<span key={i} className="badge border-red-300">{k}</span>))}
          </div>
        </div>
      </div>
      {stats?.warnings?.length>0 && (
        <div className="mt-3 text-xs text-red-600">
          {stats.warnings.map((w:string, i:number)=>(<div key={i}>⚠️ {w}</div>))}
        </div>
      )}
    </div>
  )
}
