'use client'

import { KeywordStatsComparison } from '../lib/types'

type ATSCheckProps = {
  stats: KeywordStatsComparison | null
}

const barColor = (value: number) =>
  value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444'

const formatPercent = (value?: number) => Math.round((value || 0) * 100)

export default function ATSCheck({ stats }: ATSCheckProps) {
  if (!stats) {
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        ATS metrics unavailable.
      </div>
    )
  }

  const { original, tailored, deltas } = stats

  const originalCoverage = formatPercent(original.coverage)
  const tailoredCoverage = formatPercent(tailored.coverage)
  const coverageDelta = Math.round((deltas.coverage || 0) * 100)

  const mustOriginal = formatPercent(original.mustCoverage)
  const mustTailored = formatPercent(tailored.mustCoverage)
  const mustDelta = Math.round((deltas.mustCoverage || 0) * 100)

  const niceOriginal = formatPercent(original.niceCoverage)
  const niceTailored = formatPercent(tailored.niceCoverage)
  const niceDelta = Math.round((deltas.niceCoverage || 0) * 100)

  const newlyMatched = (deltas.matchedGain || []).slice(0, 12)
  const resolvedMissing = (deltas.resolvedMissing || []).slice(0, 12)
  const remainingMissing = (deltas.remainingMissing || []).slice(0, 12)
  const regressions = (deltas.regressions || []).slice(0, 8)
  const originalWarnings = original.warnings || []
  const tailoredTopMissing = (tailored.topMissing || tailored.missing || []).slice(0, 8)

  const improvementTone =
    coverageDelta >= 10
      ? 'text-emerald-600 dark:text-emerald-300'
      : coverageDelta >= 0
        ? 'text-blue-600 dark:text-blue-300'
        : 'text-amber-600 dark:text-amber-300'

  const deltaLabel = `${coverageDelta >= 0 ? '+' : ''}${coverageDelta} pts`

  return (
    <div className="space-y-5 text-xs text-slate-600 dark:text-slate-300">
      <div className="grid gap-4 rounded-3xl border border-slate-200/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Original resume
          </div>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {originalCoverage}%
            </span>
            <span className="text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              coverage
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/80">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${originalCoverage}%`, background: barColor(originalCoverage) }}
            />
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Tailored resume
          </div>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
              {tailoredCoverage}%
            </span>
            <span className="text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              coverage
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800/80">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${tailoredCoverage}%`, background: barColor(tailoredCoverage) }}
            />
          </div>
          <div className={`mt-3 text-sm font-semibold ${improvementTone}`}>
            {coverageDelta === 0 ? 'Coverage unchanged' : `Coverage ${coverageDelta > 0 ? 'up' : 'down'} ${deltaLabel}`}
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Must-have keywords
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {mustTailored}%
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">({mustOriginal}% → {mustTailored}%)</span>
            </div>
            <div className={`text-[11px] ${mustDelta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
              {mustDelta >= 0 ? '+' : ''}{mustDelta} pts
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Nice-to-have keywords
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {niceTailored}%
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">({niceOriginal}% → {niceTailored}%)</span>
            </div>
            <div className={`text-[11px] ${niceDelta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
              {niceDelta >= 0 ? '+' : ''}{niceDelta} pts
            </div>
          </div>
        </div>
        {newlyMatched.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Newly matched keywords
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {newlyMatched.map((keyword, idx) => (
                <span
                  key={idx}
                  className="badge border border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
        {resolvedMissing.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Missing keywords now covered
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {resolvedMissing.map((keyword, idx) => (
                <span
                  key={idx}
                  className="badge border border-blue-400/40 bg-blue-500/10 text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Remaining gaps
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {remainingMissing.length ? (
                remainingMissing.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="badge border border-amber-400/40 bg-amber-100/60 text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-200"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 dark:text-slate-500">All priority keywords covered.</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Potential regressions
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {regressions.length ? (
                regressions.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="badge border border-rose-400/40 bg-rose-100/60 text-rose-700 dark:border-rose-400/30 dark:bg-rose-900/30 dark:text-rose-200"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 dark:text-slate-500">No regressions detected.</span>
              )}
            </div>
          </div>
        </div>
        {tailoredTopMissing.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Highest-priority keywords still absent
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {tailoredTopMissing.map((keyword, idx) => (
                <span
                  key={idx}
                  className="badge border border-amber-400/40 bg-amber-100/50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-200"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {originalWarnings.length > 0 && (
        <div className="rounded-3xl border border-amber-400/30 bg-amber-100/60 p-3 text-[11px] text-amber-700 dark:border-amber-400/30 dark:bg-amber-900/30 dark:text-amber-200">
          {originalWarnings.map((warning, idx) => (
            <div key={idx}>⚠️ {warning}</div>
          ))}
        </div>
      )}
    </div>
  )
}
