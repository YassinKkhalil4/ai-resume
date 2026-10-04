const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

import type { Tone } from './types'

const TONES: readonly Tone[] = ['professional', 'concise', 'impact-heavy']

/** Tone reaches the LLM prompt, so only known values may pass; anything else falls back. */
export function parseTone(value: unknown): Tone {
  return TONES.includes(value as Tone) ? (value as Tone) : 'professional'
}

/** Upper bounds on user-supplied text that is forwarded to the LLM or stored. */
export const LIMITS = {
  jdChars: 20_000,
  experienceChars: 30_000,
  resumeChars: 60_000,
  contactName: 200,
  contactMessage: 5_000,
  eventPayloadChars: 4_000,
} as const

/** True when `value` is not a string or is longer than `max` characters. */
export function textTooLong(value: unknown, max: number): boolean {
  return typeof value !== 'string' || value.length > max
}

/** Parse `page`/`limit` query params defensively (NaN, negatives and huge values are clamped). */
export function clampPage(pageRaw: string | null, limitRaw: string | null, maxLimit = 100, defaultLimit = 50) {
  const page = Math.max(1, Number.parseInt(pageRaw ?? '', 10) || 1)
  const parsedLimit = Number.parseInt(limitRaw ?? '', 10)
  const limit = Number.isNaN(parsedLimit) ? defaultLimit : Math.min(maxLimit, Math.max(1, parsedLimit))
  return { page, limit, offset: (page - 1) * limit }
}
