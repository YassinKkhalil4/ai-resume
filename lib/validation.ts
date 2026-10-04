const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

import { z } from 'zod'
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

const EVENT_NAME_RE = /^[a-zA-Z0-9_.:-]{1,64}$/

export function isValidEventName(value: unknown): value is string {
  return typeof value === 'string' && EVENT_NAME_RE.test(value)
}

/** True when the JSON-serialised value exceeds `maxChars` (or cannot be serialised). */
export function payloadTooLarge(value: unknown, maxChars: number): boolean {
  try {
    return JSON.stringify(value ?? null).length > maxChars
  } catch {
    return true
  }
}

const adminConfigSchema = z
  .object({
    pauseTailor: z.boolean().optional(),
    pauseExport: z.boolean().optional(),
    rate: z
      .object({
        ipPerMin: z.number().int().min(1).max(1000).optional(),
        sessionPerMin: z.number().int().min(1).max(1000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type AdminConfigUpdate = z.infer<typeof adminConfigSchema>

/** Validates the admin config POST body. Secrets (e.g. openaiKey) are deliberately not accepted. */
export function parseAdminConfigUpdate(body: unknown): { ok: true; value: AdminConfigUpdate } | { ok: false; message: string } {
  const parsed = adminConfigSchema.safeParse(body)
  if (parsed.success) return { ok: true, value: parsed.data }
  return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') }
}
