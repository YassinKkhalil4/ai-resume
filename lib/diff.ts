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
    
    // Compare bullets more intelligently - check for content changes
    const originalBullets = o.bullets || []
    const tailoredBullets = t.bullets || []
    
    // Check if there are any meaningful differences
    const hasChanges = checkForContentChanges(originalBullets, tailoredBullets)
    
    if (hasChanges) {
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

function checkForContentChanges(original: string[], tailored: string[]): boolean {
  // If different lengths, definitely changed
  if (original.length !== tailored.length) return true
  
  // Check for content differences even if same length
  for (let i = 0; i < original.length; i++) {
    const orig = original[i] || ''
    const tailoredItem = tailored[i] || ''
    
    // Normalize and compare
    const origNormalized = orig.toLowerCase().replace(/\s+/g, ' ').trim()
    const tailoredNormalized = tailoredItem.toLowerCase().replace(/\s+/g, ' ').trim()
    
    if (origNormalized !== tailoredNormalized) {
      return true
    }
  }
  
  return false
}
