import { Role } from './types'
import { normalizeKeyword, keywordsMatch, isSafeExpansion, extractKeyTerms, addsForbiddenContent } from './keyword-utils'

function bulletText(b: string | { id: string; text: string }): string {
  return typeof b === 'string' ? b : b.text
}

export function integrityCheck(original: Role[], tailored: Role[], jdKeywords: string[]): { ok: boolean, issues: string[] } {
  const issues:string[] = []
  const allowed = new Set<string>([...jdKeywords.map(x=>normalizeKeyword(x))])

  for (const r of original) {
    tokens(r.company ?? '').forEach(t=>allowed.add(normalizeKeyword(t)))
    tokens(r.role ?? '').forEach(t=>allowed.add(normalizeKeyword(t)))
    ;(r.bullets ?? []).forEach(b=>tokens(bulletText(b)).forEach(t=>allowed.add(normalizeKeyword(t))))
  }

  const originalTermsMap = new Map<string, Set<string>>()
  for (const r of original) {
    const key = `${r.company}|${r.role}`
    const terms = new Set<string>()
    ;(r.bullets ?? []).forEach(b => {
      extractKeyTerms(bulletText(b)).forEach(t => terms.add(t))
    })
    originalTermsMap.set(key, terms)
  }

  for (const r of tailored) {
    const key = `${r.company}|${r.role}`
    const originalTerms = originalTermsMap.get(key) || new Set<string>()

    for (const b of r.bullets ?? []) {
      const bStr = bulletText(b)
      const originalBullet = originalTerms.size > 0
        ? Array.from(originalTerms).join(' ')
        : ''

      if (originalBullet) {
        const forbidden = addsForbiddenContent(originalBullet, bStr)
        if (forbidden.forbidden) {
          issues.push(`Forbidden content in ${r.role}@${r.company}: ${forbidden.reason || 'Unknown violation'}`)
          continue
        }
      }
      
      for (const t of tokens(bStr)) {
        if (isToolish(t)) {
          const normalized = normalizeKeyword(t)
          let isAllowed = false
          
          // Check exact match
          if (allowed.has(normalized)) {
            isAllowed = true
          } else {
            // Check fuzzy match
            for (const allowedTerm of allowed) {
              if (keywordsMatch(normalized, allowedTerm, 0.80)) {
                isAllowed = true
                break
              }
            }
          }
          
          // Check if it's a safe expansion
          if (!isAllowed && originalTerms.size > 0) {
            isAllowed = isSafeExpansion(originalTerms, t)
          }
          
          if (!isAllowed) {
          issues.push(`Unexpected tool/term "${t}" in role ${r.role}@${r.company}`)
          }
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
