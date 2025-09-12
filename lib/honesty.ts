import { Role } from './types'

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return union.size ? inter.size / union.size : 0
}

function tokenize(s:string) {
  return new Set((s.toLowerCase().match(/[a-z0-9\-\+\.]{3,}/g) || []).filter(x=>!['and','the','for','with','from','this','that'].includes(x)))
}

export function honestyScan(original: Role[], tailored: Role[]) {
  const flags: Array<{ role:string, bullet:string, score:number, backing:string[] }> = []
  const map = new Map<string, Role>()
  for (const r of original) map.set(r.company + '|' + r.role, r)
  for (const t of tailored) {
    const key = t.company + '|' + t.role
    const o = map.get(key)
    if (!o) continue
    for (const tb of t.bullets) {
      const tTok = tokenize(tb)
      let best = 0, backs:string[] = []
      for (const ob of o.bullets) {
        const score = jaccard(tTok, tokenize(ob))
        if (score > best) { best = score; backs = [ob] }
      }
      if (best < 0.28) {
        flags.push({ role: `${t.role} @ ${t.company}`, bullet: tb, score: Number(best.toFixed(2)), backing: backs })
      }
    }
  }
  return { flags }
}
