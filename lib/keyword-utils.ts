/**
 * Keyword normalization and expansion utilities for ATS scoring and honesty validation
 */

// Normalization mapping for common synonyms and variations
const normalizationMap: Record<string, string> = {
  // API variations
  'rest': 'rest',
  'restful': 'rest',
  'api': 'api',
  'apis': 'api',
  'http': 'http',
  'endpoint': 'endpoint',
  'endpoints': 'endpoint',
  
  // Cloud/AWS variations
  'aws': 'amazon web services',
  'amazon web services': 'amazon web services',
  'azure': 'microsoft azure',
  'microsoft azure': 'microsoft azure',
  'gcp': 'google cloud platform',
  'google cloud platform': 'google cloud platform',
  'cloud': 'cloud',
  'cloud infrastructure': 'cloud',
  
  // ML/AI variations
  'ml': 'machine learning',
  'machine learning': 'machine learning',
  'ai': 'artificial intelligence',
  'artificial intelligence': 'artificial intelligence',
  'deep learning': 'machine learning',
  'neural network': 'machine learning',
  
  // Database variations
  'sql': 'sql',
  'database': 'database',
  'db': 'database',
  'databases': 'database',
  'nosql': 'nosql',
  
  // Framework variations
  'react': 'react',
  'reactjs': 'react',
  'vue': 'vue',
  'vuejs': 'vue',
  'angular': 'angular',
  'angularjs': 'angular',
  'node': 'nodejs',
  'nodejs': 'nodejs',
  'node.js': 'nodejs',
  
  // General plurals and common variations
  'service': 'service',
  'services': 'service',
  'tool': 'tool',
  'tools': 'tool',
  'framework': 'framework',
  'frameworks': 'framework',
  'library': 'library',
  'libraries': 'library',
}

// Stopwords to ignore in normalization
const stopwords = new Set([
  'and', 'the', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'cannot', 'to', 'of', 'in',
  'on', 'at', 'by', 'as', 'an', 'a', 'is', 'it', 'its', 'or', 'but', 'not',
  'if', 'then', 'else', 'when', 'where', 'which', 'who', 'what', 'how', 'why'
])

/**
 * Normalize a keyword to its canonical form
 */
export function normalizeKeyword(keyword: string): string {
  const lower = keyword.toLowerCase().trim()
  
  // Remove punctuation
  const cleaned = lower.replace(/[^\w\s-]/g, '')
  
  // Check normalization map
  if (normalizationMap[cleaned]) {
    return normalizationMap[cleaned]
  }
  
  // Handle plurals (simple singularization)
  if (cleaned.endsWith('ies') && cleaned.length > 4) {
    const singular = cleaned.slice(0, -3) + 'y'
    if (normalizationMap[singular]) {
      return normalizationMap[singular]
    }
  } else if (cleaned.endsWith('es') && cleaned.length > 3) {
    const singular = cleaned.slice(0, -2)
    if (normalizationMap[singular]) {
      return normalizationMap[singular]
    }
  } else if (cleaned.endsWith('s') && cleaned.length > 2) {
    const singular = cleaned.slice(0, -1)
    if (normalizationMap[singular]) {
      return normalizationMap[singular]
    }
  }
  
  return cleaned
}

/**
 * Extract key terms (nouns, verbs, skills) from text
 */
export function extractKeyTerms(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9\-\+\.]{3,}/g) || []
  const terms = new Set<string>()
  
  for (const token of tokens) {
    if (!stopwords.has(token)) {
      const normalized = normalizeKeyword(token)
      if (normalized.length >= 3) {
        terms.add(normalized)
      }
    }
  }
  
  return terms
}

/**
 * Calculate similarity between two keywords using Levenshtein distance
 * Returns a value between 0 and 1 (1 = identical, 0 = completely different)
 */
function levenshteinSimilarity(a: string, b: string): number {
  const lenA = a.length
  const lenB = b.length
  
  if (lenA === 0) return lenB === 0 ? 1 : 0
  if (lenB === 0) return 0
  
  const matrix: number[][] = []
  
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const distance = matrix[lenA][lenB]
  const maxLen = Math.max(lenA, lenB)
  return 1 - distance / maxLen
}

/**
 * Check if two keywords match (with fuzzy matching)
 */
export function keywordsMatch(keyword1: string, keyword2: string, threshold: number = 0.80): boolean {
  const norm1 = normalizeKeyword(keyword1)
  const norm2 = normalizeKeyword(keyword2)
  
  if (norm1 === norm2) return true
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true
  }
  
  // Fuzzy match using Levenshtein
  const similarity = levenshteinSimilarity(norm1, norm2)
  return similarity >= threshold
}

/**
 * Safe expansion rules - maps original terms to allowed expansions
 */
const expansionRules: Record<string, string[]> = {
  // API expansions
  'api': ['restful', 'rest api', 'http endpoints', 'web services'],
  'apis': ['restful', 'rest api', 'http endpoints', 'web services'],
  'backend': ['backend services', 'server-side', 'backend systems'],
  'frontend': ['front-end', 'client-side', 'user interface'],
  
  // Cloud expansions
  'cloud': ['cloud infrastructure', 'aws environment', 'cloud services', 'cloud platform'],
  'aws': ['amazon web services', 'aws cloud', 'aws infrastructure'],
  'azure': ['microsoft azure', 'azure cloud'],
  'gcp': ['google cloud platform', 'gcp cloud'],
  
  // Data expansions
  'data': ['data processing', 'data analysis', 'data management'],
  'database': ['database systems', 'data storage', 'db management'],
  'sql': ['sql databases', 'relational databases'],
  
  // ML/AI expansions
  'machine learning': ['ml models', 'ai models', 'predictive models'],
  'ai': ['artificial intelligence', 'ai systems'],
  
  // Development expansions
  'development': ['software development', 'app development'],
  'testing': ['quality assurance', 'qa', 'test automation'],
  'deployment': ['ci/cd', 'continuous deployment', 'devops'],
  
  // General expansions
  'project': ['project management', 'project delivery'],
  'team': ['team collaboration', 'cross-functional team'],
  'integration': ['system integration', 'api integration'],
}

/**
 * Get allowed expansions for a given keyword
 */
export function getAllowedExpansions(keyword: string): string[] {
  const normalized = normalizeKeyword(keyword)
  return expansionRules[normalized] || []
}

/**
 * Check if an expansion is safe (tied to original context)
 */
export function isSafeExpansion(originalTerms: Set<string>, expansion: string): boolean {
  const expansionTerms = extractKeyTerms(expansion)
  
  // Check if any expansion term matches an original term
  for (const expTerm of expansionTerms) {
    for (const origTerm of originalTerms) {
      if (keywordsMatch(expTerm, origTerm, 0.80)) {
        return true
      }
    }
  }
  
  // Check if expansion is in the allowed list for any original term
  for (const origTerm of originalTerms) {
    const allowed = getAllowedExpansions(origTerm)
    for (const allowedExp of allowed) {
      if (keywordsMatch(expansion, allowedExp, 0.80)) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Check if a tailored bullet adds forbidden content
 */
export function addsForbiddenContent(originalBullet: string, tailoredBullet: string): {
  forbidden: boolean
  reason?: string
} {
  const originalTerms = extractKeyTerms(originalBullet)
  const tailoredTerms = extractKeyTerms(tailoredBullet)
  
  // Patterns that indicate new achievements/metrics
  const metricPatterns = [
    /\b(?:increased|improved|reduced|optimized|enhanced|boosted|accelerated|streamlined|maximized|minimized)\s+(?:by\s+)?\d+%/gi,
    /\b(?:saved|generated|produced|delivered|achieved|accomplished|completed)\s+(?:over\s+)?\$?\d+[km]?\b/gi,
    /\b(?:managed|led|supervised|directed|oversaw)\s+\d+\+?\s+(?:team|people|employees|staff|members)\b/gi,
  ]
  
  // Check for new metrics in tailored that aren't in original
  for (const pattern of metricPatterns) {
    const originalMatches = originalBullet.match(pattern) || []
    const tailoredMatches = tailoredBullet.match(pattern) || []
    
    if (tailoredMatches.length > originalMatches.length) {
      return { forbidden: true, reason: 'New metrics or achievements detected' }
    }
  }
  
  // Check for completely new tools/technologies (capitalized terms)
  const toolPattern = /\b[A-Z][a-zA-Z0-9\+\.#-]{2,}\b/g
  const originalTools = new Set((originalBullet.match(toolPattern) || []).map(t => t.toLowerCase()))
  const tailoredTools = new Set((tailoredBullet.match(toolPattern) || []).map(t => t.toLowerCase()))
  
  for (const tool of tailoredTools) {
    if (!originalTools.has(tool)) {
      // Check if it's a safe expansion
      if (!isSafeExpansion(originalTerms, tool)) {
        return { forbidden: true, reason: `New tool/technology detected: ${tool}` }
      }
    }
  }
  
  return { forbidden: false }
}

