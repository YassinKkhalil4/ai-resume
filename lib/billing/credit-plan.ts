export type LotBalance = { id: string; creditsRemaining: number }

/**
 * Decides how many credits to take from each lot, in the order given
 * (callers pass lots soonest-expiring first). Never takes more than a lot holds;
 * if `amount` exceeds the total, every lot is drained and the caller compares totals.
 */
export function planDeduction(lots: LotBalance[], amount: number): { id: string; take: number }[] {
  const plan: { id: string; take: number }[] = []
  let left = amount
  for (const lot of lots) {
    if (left <= 0) break
    const take = Math.min(lot.creditsRemaining, left)
    if (take <= 0) continue
    plan.push({ id: lot.id, take })
    left -= take
  }
  return plan
}
