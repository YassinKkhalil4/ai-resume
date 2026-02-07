import { Role } from './types'
import { explainChanges } from './diff_explain'
import { logEvent } from './trace/tracer'
import { RESUME_DIFF } from './trace/stages'
import { extractKeyTerms } from './keyword-utils'

export async function buildDiffs(
  original: Role[], 
  tailored: Role[],
  runId?: string | null
): Promise<Array<{role:string, original:string[], tailored:string[], reasons?: string[]}>> {
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
      
      // Log significant changes (similarity < 0.8) for each bullet
      for (let i = 0; i < Math.max(originalBullets.length, tailoredBullets.length); i++) {
        const orig = originalBullets[i] || ''
        const tailoredItem = tailoredBullets[i] || ''
        
        if (!orig && tailoredItem) {
          // New bullet added
          const origTokens = tokenize('')
          const tailoredTokens = tokenize(tailoredItem)
          const similarity = calculateSimilarity(origTokens, tailoredTokens)
          
          if (similarity < 0.8) {
            const origTerms = extractKeyTerms(orig)
            const tailoredTerms = extractKeyTerms(tailoredItem)
            const keywordsAdded = Array.from(tailoredTerms).filter(t => !origTerms.has(t))
            
            await logEvent(runId || null, RESUME_DIFF, 'bullet_change', {
              original: orig,
              tailored: tailoredItem,
              change_type: 'add',
              keywords_added: Array.from(keywordsAdded),
              keywords_removed: [],
              semantic_similarity: similarity,
            })
          }
        } else if (orig && !tailoredItem) {
          // Bullet removed
          await logEvent(runId || null, RESUME_DIFF, 'bullet_change', {
            original: orig,
            tailored: '',
            change_type: 'remove',
            keywords_added: [],
            keywords_removed: Array.from(extractKeyTerms(orig)),
            semantic_similarity: 0,
          })
        } else if (orig && tailoredItem) {
          // Bullet rewritten
          const origTokens = tokenize(orig)
          const tailoredTokens = tokenize(tailoredItem)
          const similarity = calculateSimilarity(origTokens, tailoredTokens)
          
          if (similarity < 0.8) {
            const origTerms = extractKeyTerms(orig)
            const tailoredTerms = extractKeyTerms(tailoredItem)
            const keywordsAdded = Array.from(tailoredTerms).filter(t => !origTerms.has(t))
            const keywordsRemoved = Array.from(origTerms).filter(t => !tailoredTerms.has(t))
            
            await logEvent(runId || null, RESUME_DIFF, 'bullet_change', {
              original: orig,
              tailored: tailoredItem,
              change_type: 'rewrite',
              keywords_added: Array.from(keywordsAdded),
              keywords_removed: Array.from(keywordsRemoved),
              semantic_similarity: similarity,
            })
          }
        }
      }
    }
  }
  
  return diffs
}

function checkForContentChanges(original: string[], tailored: string[]): boolean {
  // If different lengths, definitely changed
  if (original.length !== tailored.length) {
    return true
  }
  
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
