import { useId } from 'react'
import { MARK, MARK_SIZE } from './brand/geometry'
import { LOCKUP_HEIGHT, LOCKUP_WIDTH, WORDMARK_PATH } from './brand/wordmark.generated'

type LogoProps = {
  /** `full` is the mark plus wordmark; `mark` is the icon alone. */
  variant?: 'full' | 'mark'
  /** Height in px; width follows the artwork's aspect ratio. */
  height?: number
  className?: string
}

/**
 * Rolefit logo as inline SVG. Colors come from Tailwind fill utilities so the logo
 * follows the page theme without a second asset. Static exports live in /public/brand.
 */
export default function Logo({ variant = 'full', height = 32, className = '' }: LogoProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const full = variant === 'full'
  const width = full ? (LOCKUP_WIDTH / LOCKUP_HEIGHT) * height : height
  const c = MARK.cutouts
  const b = MARK.badge

  return (
    <svg
      role="img"
      aria-label="Rolefit"
      viewBox={`0 0 ${full ? LOCKUP_WIDTH : MARK_SIZE} ${MARK_SIZE}`}
      width={width}
      height={height}
      className={className}
    >
      <defs>
        <mask id={`${id}-doc`} maskUnits="userSpaceOnUse" x="0" y="0" width={MARK_SIZE} height={MARK_SIZE}>
          <rect width={MARK_SIZE} height={MARK_SIZE} fill="#fff" />
          {c.lines.map((l) => (
            <rect key={l.y} x={l.x} y={l.y} width={l.w} height={l.h} rx={l.h / 2} fill="#000" />
          ))}
          <circle cx={c.head.cx} cy={c.head.cy} r={c.head.r} fill="#000" />
          <path d={c.shoulders} fill="#000" />
          <circle cx={b.cx} cy={b.cy} r={MARK.badgeGap} fill="#000" />
        </mask>
        <mask id={`${id}-badge`} maskUnits="userSpaceOnUse" x="0" y="0" width={MARK_SIZE} height={MARK_SIZE}>
          <rect width={MARK_SIZE} height={MARK_SIZE} fill="#fff" />
          <path d={MARK.check} fill="none" stroke="#000" strokeWidth={MARK.checkWidth} strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <path d={MARK.doc} mask={`url(#${id}-doc)`} className="fill-blue-600 dark:fill-blue-400" />
      <path d={MARK.fold} className="fill-blue-300 dark:fill-blue-200" />
      <circle cx={b.cx} cy={b.cy} r={b.r} mask={`url(#${id}-badge)`} className="fill-blue-500 dark:fill-blue-300" />
      {full && <path d={WORDMARK_PATH} className="fill-slate-900 dark:fill-slate-50" />}
    </svg>
  )
}

/** Mark only, for tight spaces. */
export function LogoCompact({ height = 28, className = '' }: { height?: number; className?: string }) {
  return <Logo variant="mark" height={height} className={className} />
}
