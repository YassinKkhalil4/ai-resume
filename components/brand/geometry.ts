/**
 * Rolefit logo geometry: one source of truth for the React <Logo /> component and
 * scripts/brand/build-brand-assets.ts (which exports the static SVG/PNG files).
 *
 * The mark is flat solid shapes on a 64x64 grid. Details (text lines, person, check)
 * are negative-space cutouts, so the mark works on any background and in either theme.
 */

export const MARK_SIZE = 64

export const MARK = {
  /** Document silhouette with a folded top-right corner. */
  doc: 'M14 4H36L52 20V50a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8Z',
  /** The fold, drawn in a lighter tint. */
  fold: 'M36 4V14a6 6 0 0 0 6 6H52Z',
  /** Verified badge, overlapping the document's bottom-right corner. */
  badge: { cx: 46, cy: 46, r: 13 },
  /** Ring cut out of the document around the badge so the two shapes read as separate. */
  badgeGap: 16.5,
  /** Negative-space details cut from the document. */
  cutouts: {
    lines: [
      { x: 14, y: 13, w: 18, h: 3.6 },
      { x: 14, y: 20.5, w: 12, h: 3.6 },
    ],
    head: { cx: 21, cy: 31.5, r: 5.5 },
    shoulders: 'M12.5 49a8.5 8.5 0 0 1 17 0v1.5h-17Z',
  },
  /** Check mark, cut from the badge (stroke width CHECK_WIDTH). */
  check: 'M39.5 46.5L44.5 51.5L53 41',
  checkWidth: 4.5,
} as const

/** Palettes. Only one accent: the brand blue, in three tints. */
export const BRAND_COLORS = {
  light: { main: '#2c4fd6', badge: '#4268e8', fold: '#94b0ff', ink: '#14171c', bg: '#f7f8fa' },
  dark: { main: '#7b9cff', badge: '#94b0ff', fold: '#c0d1ff', ink: '#e8ebef', bg: '#0b0d10' },
} as const

export const WORDMARK_TEXT = 'RoleFit'
