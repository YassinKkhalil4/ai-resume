import fs from 'fs'
import { v4 as uuid } from 'uuid'

const PATH = '/tmp/telemetry.jsonl'

export function startTrace(meta:any = {}) {
  const id = uuid()
  const t0 = Date.now()
  function end(ok:boolean, extra:any = {}) {
    const rec = { id, ok, ms: Date.now()-t0, ...meta, ...extra }
    try { fs.appendFileSync(PATH, JSON.stringify(rec)+'\n') } catch {}
    return rec
  }
  return { id, end }
}
