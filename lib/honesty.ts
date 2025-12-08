import { Role } from './types'
import { extractKeyTerms, normalizeKeyword, keywordsMatch, addsForbiddenContent } from './keyword-utils'

// Honesty threshold: 0.20 is the sweet spot
// Below 0.18 = too risky (hallucinations rise)
// Above 0.28 = too restrictive (weak tailoring)
// 0.20 allows meaningful rewrites while blocking hallucinated achievements
export const HONESTY_THRESHOLD = 0.20

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return union.size ? inter.size / union.size : 0
}

function tokenize(s: string) {
  return new Set((s.toLowerCase().match(/[a-z0-9\-\+\.]{3,}/g) || []).filter(x => !['and','the','for','with','from','this','that'].includes(x)))
}

/**
 * Tokenize with normalization for better matching
 */
function tokenizeNormalized(s: string): Set<string> {
  const tokens = s.toLowerCase().match(/[a-z0-9\-\+\.]{3,}/g) || []
  const normalized = new Set<string>()
  
  for (const token of tokens) {
    if (!['and','the','for','with','from','this','that'].includes(token)) {
      normalized.add(normalizeKeyword(token))
    }
  }
  
  return normalized
}

/**
 * Enhanced Jaccard with normalized keywords and fuzzy matching
 */
function jaccardNormalized(a: Set<string>, b: Set<string>): number {
  // First try exact matches
  const exactInter = new Set([...a].filter(x => b.has(x)))
  if (exactInter.size > 0) {
    const union = new Set([...a, ...b])
    return union.size ? exactInter.size / union.size : 0
  }
  
  // Try fuzzy matching
  let fuzzyMatches = 0
  for (const tokenA of a) {
    for (const tokenB of b) {
      if (keywordsMatch(tokenA, tokenB, 0.80)) {
        fuzzyMatches++
        break
      }
    }
  }
  
  const union = new Set([...a, ...b])
  return union.size ? fuzzyMatches / union.size : 0
}

export function honestyScan(original: Role[], tailored: Role[]) {
  const threshold = HONESTY_THRESHOLD
  const flags: Array<{ role: string, bullet: string, score: number, backing: string[], reason?: string }> = []
  const results: Array<{
    role: string
    bullet: string
    score: number
    status: 'supported' | 'flagged'
    backing: string[]
    overlap: string[]
  }> = []
  const map = new Map<string, Role>()
  
  for (const r of original) map.set(r.company + '|' + r.role, r)
  
  for (const t of tailored) {
    const key = t.company + '|' + t.role
    const o = map.get(key)
    if (!o) continue
    
    for (const tb of t.bullets) {
      // Step A: Compare original vs tailored with normalized tokens
      const tTok = tokenizeNormalized(tb)
      let best = 0, bestBack: string | null = null
      
      for (const ob of o.bullets) {
        const obTok = tokenizeNormalized(ob)
        // Use normalized Jaccard for better matching
        const score = jaccardNormalized(tTok, obTok)
        if (score > best) {
          best = score
          bestBack = ob
        }
      }

      // Step B: Validate against forbidden expansions
      const forbiddenCheck = bestBack ? addsForbiddenContent(bestBack, tb) : { forbidden: true, reason: 'No matching original bullet' }

      const backingArray = bestBack ? [bestBack] : []
      const overlap = bestBack
        ? [...tTok].filter(token => {
            const obTok = tokenizeNormalized(bestBack!)
            for (const obToken of obTok) {
              if (keywordsMatch(token, obToken, 0.80)) {
                return true
              }
            }
            return false
          })
        : []

      // Step C: Final validation - must pass both similarity and forbidden content checks
      const isSupported = best >= threshold && !forbiddenCheck.forbidden

      if (!isSupported) {
        flags.push({ 
          role: `${t.role} @ ${t.company}`, 
          bullet: tb, 
          score: Number(best.toFixed(2)), 
          backing: backingArray,
          reason: forbiddenCheck.reason || `Similarity score ${best.toFixed(2)} below threshold ${threshold}`
        })
      }

      results.push({
        role: `${t.role} @ ${t.company}`,
        bullet: tb,
        score: Number(best.toFixed(2)),
        status: isSupported ? 'supported' : 'flagged',
        backing: backingArray,
        overlap
      })
    }
  }
  
  return { flags, results }
}

// Enhanced honesty scan with semantic analysis
export async function enhancedHonestyScan(original: Role[], tailored: Role[]): Promise<{ flags: any[], enhanced: boolean }> {
  try {
    // First run the basic scan
    const basicResult = honestyScan(original, tailored)
    
    // If no flags from basic scan, try enhanced analysis
    if (basicResult.flags.length === 0) {
      return await semanticHonestyScan(original, tailored)
    }
    
    return { ...basicResult, enhanced: false }
  } catch (error) {
    console.error('Enhanced honesty scan failed:', error)
    // Fallback to basic scan
    return { ...honestyScan(original, tailored), enhanced: false }
  }
}

async function semanticHonestyScan(original: Role[], tailored: Role[]): Promise<{ flags: any[], enhanced: boolean }> {
  // This would use OpenAI embeddings for semantic similarity
  // For now, return basic scan as fallback
  return { ...honestyScan(original, tailored), enhanced: false }
}
