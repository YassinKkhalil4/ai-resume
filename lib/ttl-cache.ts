/** Small in-process cache with per-entry expiry and a hard size cap (oldest entries evicted first). */
export class TtlCache<V> {
  private entries = new Map<string, { value: V; expiresAt: number }>()

  constructor(
    private ttlMs: number,
    private maxEntries: number,
    private now: () => number = Date.now
  ) {}

  get size(): number {
    return this.entries.size
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: V): void {
    this.entries.delete(key) // re-insert so Map order tracks recency
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string
      this.entries.delete(oldest)
    }
  }
}
