import { getOwnedSession } from './sessions'

export type ExperiencePairResult =
  | { ok: true; original: any[]; tailored: any[] }
  | { ok: false; code: string; message: string; status: number; extra?: Record<string, unknown> }

/**
 * Resolves the original/tailored experience arrays for diff and honesty routes.
 * Client-supplied payloads are preferred (the data is the caller's own, so no
 * staleness check applies). Otherwise the caller's own stored session is used,
 * and the optional `session_version` must match it.
 */
export async function resolveExperiencePair(body: any, userId: string): Promise<ExperiencePairResult> {
  const { session_id, session_version, original_payload, tailored_payload } = body || {}

  if (!session_id) {
    return { ok: false, code: 'missing_session_id', message: 'Session ID required', status: 400 }
  }

  if (original_payload && tailored_payload) {
    return {
      ok: true,
      original: original_payload.experience || [],
      tailored: tailored_payload.experience || [],
    }
  }

  const session = await getOwnedSession(session_id, userId)
  if (!session?.original || !session?.tailored) {
    return {
      ok: false,
      code: 'missing_data',
      message: 'Original or tailored experience data required. Please ensure the resume has been processed first.',
      status: 400,
      extra: { suggestion: 'Try refreshing the page and try again.', session_version: session_version || 'unknown' },
    }
  }

  if (session_version && session.version !== session_version) {
    return {
      ok: false,
      code: 'stale_session',
      message: 'Session data is outdated. Please refresh the page and try again.',
      status: 409,
      extra: { session_version: session.version, provided_version: session_version },
    }
  }

  return { ok: true, original: session.original.experience || [], tailored: session.tailored.experience || [] }
}
