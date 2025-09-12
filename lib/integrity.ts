import { Role } from './types'

export function integrityCheck(original: Role[], tailored: Role[], jdKeywords: string[]): { ok: boolean, issues: string[] } {
  const issues:string[] = []
  const allowed = new Set<string>([...jdKeywords.map(x=>x.toLowerCase())])

  for (const r of original) {
    tokens(r.company).forEach(t=>allowed.add(t))
    tokens(r.role).forEach(t=>allowed.add(t))
    r.bullets.forEach(b=>tokens(b).forEach(t=>allowed.add(t)))
  }

  for (const r of tailored) {
    for (const b of r.bullets) {
      for (const t of tokens(b)) {
        if (isToolish(t) && !allowed.has(t.toLowerCase())) {
          issues.push(`Unexpected tool/term "${t}" in role ${r.role}@${r.company}`)
        }
      }
    }
  }
  return { ok: issues.length === 0, issues }
}

function tokens(s:string): string[] {
  return (s.match(/[A-Za-z][A-Za-z0-9\+\.#-]{2,}/g) || [])
}

function isToolish(t:string): boolean {
  return /[A-Z]/.test(t[0]) || /[\+.#-]/.test(t)
}
