import { Role } from './types'

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return union.size ? inter.size / union.size : 0
}

function tokenize(s: string) {
  return new Set((s.toLowerCase().match(/[a-z0-9\-\+\.]{3,}/g) || []).filter(x => !['and','the','for','with','from','this','that'].includes(x)))
}

export function honestyScan(original: Role[], tailored: Role[]) {
  const threshold = 0.28
  const flags: Array<{ role: string, bullet: string, score: number, backing: string[] }> = []
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
      const tTok = tokenize(tb)
      let best = 0, bestBack: string | null = null
      
      for (const ob of o.bullets) {
        const score = jaccard(tTok, tokenize(ob))
        if (score > best) {
          best = score
          bestBack = ob
        }
      }

      const backingArray = bestBack ? [bestBack] : []
      const overlap = bestBack
        ? [...tTok].filter(token => tokenize(bestBack!).has(token))
        : []

      if (best < threshold) {
        flags.push({ 
          role: `${t.role} @ ${t.company}`, 
          bullet: tb, 
          score: Number(best.toFixed(2)), 
          backing: backingArray 
        })
      }

      results.push({
        role: `${t.role} @ ${t.company}`,
        bullet: tb,
        score: Number(best.toFixed(2)),
        status: best >= threshold ? 'supported' : 'flagged',
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
