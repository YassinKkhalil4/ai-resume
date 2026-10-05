import { createFakeRedis } from './fake-redis'

/**
 * Emulates Upstash's REST protocol on top of the in-memory fake, so tests can drive the REAL
 * @upstash/redis client. Handles single commands (POST /) and pipelines (POST /pipeline).
 * Strings are base64-encoded when the client asks for it (Upstash-Encoding: base64).
 */
export function installFakeUpstash() {
  const store = createFakeRedis() as any
  const sent: unknown[][] = []
  const realFetch = globalThis.fetch

  const run = async (cmd: unknown[]): Promise<unknown> => {
    const [name, ...args] = cmd as [string, ...any[]]
    sent.push(cmd)
    switch (String(name).toLowerCase()) {
      case 'get': return store.get(args[0])
      case 'set': {
        // SET key value [EX seconds]
        const exIdx = args.findIndex((a) => String(a).toUpperCase() === 'EX')
        return store.set(args[0], String(args[1]), exIdx > -1 ? 'EX' : undefined, exIdx > -1 ? Number(args[exIdx + 1]) : undefined)
      }
      case 'setex': return store.setex(args[0], Number(args[1]), String(args[2]))
      case 'del': return store.del(args[0])
      case 'ttl': return store.ttl(args[0])
      case 'expire': return store.expire(args[0], Number(args[1]))
      case 'zadd': {
        if (typeof args[1] !== 'number' && typeof args[1] !== 'string') throw new Error('ERR syntax error')
        return store.zadd(args[0], Number(args[1]), String(args[2]))
      }
      case 'zcard': return store.zcard(args[0])
      case 'zremrangebyscore': return store.zremrangebyscore(args[0], Number(args[1]), Number(args[2]))
      default: throw new Error(`ERR unknown command '${name}'`)
    }
  }

  const encode = (value: unknown, base64: boolean): unknown =>
    base64 && typeof value === 'string' ? Buffer.from(value, 'utf8').toString('base64') : value

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url ?? input)
    const base64 = String(init?.headers?.['Upstash-Encoding'] ?? init?.headers?.get?.('Upstash-Encoding') ?? '').toLowerCase() === 'base64'
    const body = JSON.parse(init.body)
    const answer = async (cmd: unknown[]) => {
      try { return { result: encode(await run(cmd), base64) } } catch (e: any) { return { error: e.message } }
    }
    const payload = url.endsWith('/pipeline') || url.endsWith('/multi-exec')
      ? await Promise.all((body as unknown[][]).map(answer))
      : await answer(body)
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  return { sent, restore: () => { globalThis.fetch = realFetch } }
}
