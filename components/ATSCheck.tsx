'use client'

export default function ATSCheck({ stats }:{ stats:any }) {
  const pct = Math.round((stats?.coverage || 0) * 100)
  const mustPct = Math.round((stats?.mustCoverage || 0) * 100)
  const nicePct = Math.round((stats?.niceCoverage || 0) * 100)
  const semPct = Math.round((stats?.semanticCoverage || 0) * 100)
  const topMissing = (stats?.topMissing || []).slice(0, 5)
  const matched = (stats?.matched || []).slice(0, 20)
  const missing = (stats?.missing || []).slice(0, 20)
  const barColor = (value:number) => value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444'

  return (
    <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">ATS signal coverage</div>
        <span
          className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200"
          style={{ borderColor: barColor(pct), color: barColor(pct) }}
        >
          {pct}% overall
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/80">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor(pct) }}
        />
      </div>

      <div className="grid gap-3">
        {[{ label: 'Must-haves', value: mustPct }, { label: 'Nice-to-haves', value: nicePct }, { label: 'Semantic coverage', value: semPct }].map(
          metric => (
            <div key={metric.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {metric.label}
                </span>
                <span className="font-medium" style={{ color: barColor(metric.value) }}>
                  {metric.value}%
                </span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800/70">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${metric.value}%`, background: barColor(metric.value) }}
                />
              </div>
            </div>
          )
        )}
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Top missing keywords
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {topMissing.length ? (
            topMissing.map((keyword: string, index: number) => (
              <span
                key={index}
                className="rounded-full border border-amber-400/40 bg-amber-100/50 px-3 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-200"
              >
                {keyword}
              </span>
            ))
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          )}
        </div>
      </div>

      {Array.isArray(stats?.gaps) && stats.gaps.length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <div className="label mb-2">Gap map (nearest support)</div>
          <ul className="space-y-2 text-[11px] leading-relaxed">
            {stats.gaps.slice(0, 5).map((g: any, i: number) => (
              <li key={i} className="rounded-2xl border border-slate-200/50 bg-white/70 p-3 shadow-inner dark:border-slate-700 dark:bg-slate-900/60">
                <div className="font-semibold text-slate-700 dark:text-slate-200">{g.requirement}</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  ↳ match “{g.nearestBullet}” (score {Math.round((g.score || 0) * 100) / 100})
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 text-[11px] md:grid-cols-2">
        <div>
          <div className="label mb-2">Matched</div>
          <div className="flex flex-wrap gap-2">
            {matched.map((k: string, i: number) => (
              <span key={i} className="badge border border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                {k}
              </span>
            ))}
            {!matched.length && <span className="text-slate-400 dark:text-slate-500">—</span>}
          </div>
        </div>
        <div>
          <div className="label mb-2">Missing (relevant)</div>
          <div className="flex flex-wrap gap-2">
            {missing.map((k: string, i: number) => (
              <span key={i} className="badge border border-amber-400/40 bg-amber-100/60 text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-200">
                {k}
              </span>
            ))}
            {!missing.length && <span className="text-slate-400 dark:text-slate-500">—</span>}
          </div>
        </div>
      </div>

      {stats?.warnings?.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-100/60 p-3 text-[11px] text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-200">
          {stats.warnings.map((w: string, i: number) => (
            <div key={i}>⚠️ {w}</div>
          ))}
        </div>
      )}
    </div>
  )
}
