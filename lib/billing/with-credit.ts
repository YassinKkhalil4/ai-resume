import {
  commitCreditReservation,
  releaseCreditReservation,
  reserveCredit,
  type CreditReservation,
} from './deduct-credit'

export type CreditDeps = {
  reserve: (userId: string, resumeHash?: string) => Promise<CreditReservation>
  commit: (reservation: CreditReservation, tokens?: number) => Promise<void>
  release: (reservation: CreditReservation) => Promise<void>
}

const defaultDeps: CreditDeps = {
  reserve: reserveCredit,
  commit: commitCreditReservation,
  release: releaseCreditReservation,
}

export type CreditedWork<T> = {
  result: T
  tokens?: number
  /** Set to false when the request produced nothing worth charging for; the credit is released. */
  charge?: boolean
}

/**
 * Reserve a credit, run `work`, then commit (log usage) or release.
 * - NoCreditsError from reserving propagates before any work runs.
 * - If `work` throws, the credit is released and the error rethrown.
 * - A failed usage-log commit is logged only: the work succeeded, so the credit stays spent.
 */
export async function withCreditReservation<T>(
  userId: string,
  resumeHash: string | undefined,
  work: (reservation: CreditReservation) => Promise<CreditedWork<T>>,
  deps: CreditDeps = defaultDeps
): Promise<T> {
  const reservation = await deps.reserve(userId, resumeHash)

  let outcome: CreditedWork<T>
  try {
    outcome = await work(reservation)
  } catch (error) {
    await deps.release(reservation).catch((e) => console.error('Failed to release reserved credit:', e))
    throw error
  }

  if (outcome.charge === false) {
    await deps.release(reservation).catch((e) => console.error('Failed to release reserved credit:', e))
  } else {
    await deps.commit(reservation, outcome.tokens).catch((e) => console.error('Failed to record credit usage:', e))
  }
  return outcome.result
}
