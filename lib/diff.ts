import { Role } from './types'
import { explainChanges } from './diff_explain'

export function buildDiffs(original: Role[], tailored: Role[]) {
  const diffs: Array<{role:string, original:string[], tailored:string[], reasons?: string[]}> = []
  const map = new Map<string, Role>()
  for (const r of original) map.set(r.company + '|' + r.role, r)
  for (const t of tailored) {
    const key = t.company + '|' + t.role
    const o = map.get(key)
    if (!o) continue
    if (JSON.stringify(o.bullets) !== JSON.stringify(t.bullets)) {
      const reasons = explainChanges(o.bullets, t.bullets)
      diffs.push({ role: `${t.role} @ ${t.company}`, original: o.bullets, tailored: t.bullets, reasons })
    }
  }
  return diffs
}
