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
    
    // Check if there are any meaningful differences using token-based comparison
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
  
  // Check for content differences using token-based comparison
  for (let i = 0; i < original.length; i++) {
    const orig = original[i] || ''
    const tailoredItem = tailored[i] || ''
    
    // Tokenize and compare
    const origTokens = tokenize(orig)
    const tailoredTokens = tokenize(tailoredItem)
    
    // Calculate similarity
    const similarity = calculateSimilarity(origTokens, tailoredTokens)
    
    // If similarity is below 0.8, consider it changed
    if (similarity < 0.8) {
      return true
    }
  }
  
  return false
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(token => token.length > 2) // Filter out short words
    .filter(token => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(token))
}

function calculateSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1)
  const set2 = new Set(tokens2)
  
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  
  return union.size > 0 ? intersection.size / union.size : 0
}
