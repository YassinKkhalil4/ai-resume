import type { RedisClient } from '../../lib/redis'

type Entry = { value: string; expiresAt: number | null }

/** In-memory Redis stand-in implementing the subset of commands lib/ uses. */
export function createFakeRedis(): RedisClient {
  const kv = new Map<string, Entry>()
  const zsets = new Map<string, Map<string, number>>()
  const lists = new Map<string, string[]>()

  const live = (key: string): Entry | undefined => {
    const e = kv.get(key)
    if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) {
      kv.delete(key)
      return undefined
    }
    return e
  }

  return {
    async get(key) { return live(key)?.value ?? null },
    async set(key, value, mode, ttl) {
      const expiresAt = mode === 'EX' && ttl ? Date.now() + ttl * 1000 : null
      kv.set(key, { value, expiresAt })
      return 'OK'
    },
    async setex(key, seconds, value) {
      kv.set(key, { value, expiresAt: Date.now() + seconds * 1000 })
      return 'OK'
    },
    async del(key) {
      const had = kv.delete(key) || zsets.delete(key) || lists.delete(key)
      return had ? 1 : 0
    },
    async exists(key) { return live(key) || zsets.has(key) ? 1 : 0 },
    async expire(key, seconds) {
      const e = live(key)
      if (e) e.expiresAt = Date.now() + seconds * 1000
      return e || zsets.has(key) ? 1 : 0
    },
    async incr(key) {
      const next = Number(live(key)?.value ?? 0) + 1
      kv.set(key, { value: String(next), expiresAt: live(key)?.expiresAt ?? null })
      return next
    },
    async decr(key) {
      const next = Number(live(key)?.value ?? 0) - 1
      kv.set(key, { value: String(next), expiresAt: live(key)?.expiresAt ?? null })
      return next
    },
    async keys(pattern) {
      const prefix = pattern.replace(/\*$/, '')
      return [...kv.keys()].filter((k) => k.startsWith(prefix))
    },
    async ttl(key) {
      const e = live(key)
      if (!e) return -2
      if (e.expiresAt === null) return -1
      return Math.ceil((e.expiresAt - Date.now()) / 1000)
    },
    async lpush(key, ...values) {
      const list = lists.get(key) ?? []
      list.unshift(...values)
      lists.set(key, list)
      return list.length
    },
    async rpop(key) { return lists.get(key)?.pop() ?? null },
    async zadd(key, score, member) {
      const z = zsets.get(key) ?? new Map<string, number>()
      const isNew = !z.has(member)
      z.set(member, score)
      zsets.set(key, z)
      return isNew ? 1 : 0
    },
    async zcard(key) { return zsets.get(key)?.size ?? 0 },
    async zremrangebyscore(key, min, max) {
      const z = zsets.get(key)
      if (!z) return 0
      let removed = 0
      for (const [m, s] of z) if (s >= min && s <= max) { z.delete(m); removed++ }
      return removed
    },
  }
}
