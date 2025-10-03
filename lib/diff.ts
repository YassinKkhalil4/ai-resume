import { Role } from './types'
import { explainChanges } from './diff_explain'

export function buildDiffs(original: Role[], tailored: Role[]) {
  const diffs: Array<{role:string, original:string[], tailored:string[], reasons?: string[]}> = []
  const map = new Map<string, Role>()
  
  // Create a more flexible mapping
  for (const r of original) {
    const key = `${r.company}|${r.role}`.toLowerCase().trim()
    map.set(key, r)
  }
  
  for (const t of tailored) {
    const key = `${t.company}|${t.role}`.toLowerCase().trim()
    const o = map.get(key)
    
    if (!o) {
      // This is a new role, show it as added
      diffs.push({ 
        role: `${t.role} @ ${t.company}`, 
        original: [], 
        tailored: t.bullets || [], 
        reasons: ['New role added'] 
      })
      continue
    }
    
    // Compare bullets more intelligently
    const originalBullets = o.bullets || []
    const tailoredBullets = t.bullets || []
    
    if (JSON.stringify(originalBullets) !== JSON.stringify(tailoredBullets)) {
      const reasons = explainChanges(originalBullets, tailoredBullets)
      diffs.push({ 
        role: `${t.role} @ ${t.company}`, 
        original: originalBullets, 
        tailored: tailoredBullets, 
        reasons 
      })
    }
  }
  
  return diffs
}
