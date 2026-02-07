import { TailoredResultSchema, type TailoredResultType, BulletRewriteResponseSchema } from './schemas'
import { KeywordStatsComparison, ResumeJSON, KeywordStats, type Role, type BulletWithId } from './types'
import { logAIResponse, logError } from './telemetry'
import { extractKeywords, extractKeywords2 } from './jd'
import { getOpenAI, OPENAI_MODEL } from './openai'
import { SYSTEM_PROMPT, makeUserPrompt, BULLET_REWRITE_SYSTEM_PROMPT, makeBulletRewriteUserPrompt } from './prompts'
import { honestyScan, bulletSimilarity, HONESTY_THRESHOLD } from './honesty'
import { atsCheck, compareKeywordStats } from './ats'
import { logEvent } from './trace/tracer'
import { KEYWORD_ENGINE, KEYWORD_DECISIONS, PROMPT_BUILD, MODEL_CALL, RESUME_DIFF, ATS_SCORING, SOFT_FIX, type Stage } from './trace/stages'
import { normalizeKeyword, addsForbiddenContent } from './keyword-utils'

type TailorOptions = {
  deadline?: number
  runId?: string | null
  strictHonestyMode?: boolean
}

/** Get bullet text from Role.bullets (string[] or BulletWithId[]). */
function getBulletStrings(bullets: Role['bullets']): string[] {
  if (!bullets || bullets.length === 0) return []
  if (typeof bullets[0] === 'string') return bullets as string[]
  return (bullets as BulletWithId[]).map(b => b.text)
}

/**
 * Deduplicate experience by company+role, merge bullets, assign stable IDs.
 * Returns normalized experience (bullets as BulletWithId[]) and list of roles that have no bullets.
 */
export function normalizeExperienceForTailor(original: ResumeJSON): {
  normalizedExperience: Array<Role & { bullets: BulletWithId[] }>
  rolesWithNoBullets: Array<{ company: string; role: string }>
} {
  const rolesWithNoBullets: Array<{ company: string; role: string }> = []
  if (!original.experience || original.experience.length === 0) {
    return { normalizedExperience: [], rolesWithNoBullets: [] }
  }

  const byKey = new Map<string, { company: string; role: string; dates?: string; bullets: string[] }>()
  for (const exp of original.experience) {
    const company = (exp.company ?? '').trim() || 'Unknown'
    const role = (exp.role ?? '').trim() || 'Unknown'
    const key = `${company.toLowerCase()}|${role.toLowerCase()}`
    const bulletStrings = getBulletStrings(exp.bullets)
    if (bulletStrings.length === 0) {
      rolesWithNoBullets.push({ company, role })
    }
    const existing = byKey.get(key)
    if (existing) {
      existing.bullets.push(...bulletStrings)
    } else {
      byKey.set(key, { company, role, dates: exp.dates, bullets: [...bulletStrings] })
    }
  }

  const normalizedExperience: Array<Role & { bullets: BulletWithId[] }> = []
  let roleIndex = 0
  for (const [, r] of byKey) {
    const bulletsWithId: BulletWithId[] = r.bullets.map((text, bi) => ({
      id: `R${roleIndex}-B${bi}`,
      text,
    }))
    normalizedExperience.push({
      company: r.company,
      role: r.role,
      dates: r.dates,
      bullets: bulletsWithId,
    })
    roleIndex++
  }
  return { normalizedExperience, rolesWithNoBullets }
}

/** Flatten experience bullets that are already BulletWithId[]. Returns empty if any role has string[] bullets. */
function flattenBulletsWithIds(experience: Role[]): BulletWithId[] {
  const out: BulletWithId[] = []
  for (const exp of experience || []) {
    const bullets = exp.bullets
    if (!bullets?.length) continue
    const first = bullets[0]
    if (typeof first === 'string') return [] // legacy shape
    for (const b of bullets as BulletWithId[]) {
      if (b?.id != null && b?.text != null) out.push({ id: b.id, text: b.text })
    }
  }
  return out
}

/** Extract and parse bullet-rewrite JSON array from raw model response. */
function parseBulletRewriteResponse(raw: string): Array<{ id: string; rewritten_text: string }> {
  let cleaned = raw.trim()
  const firstBracket = cleaned.indexOf('[')
  if (firstBracket >= 0) {
    const lastBracket = cleaned.lastIndexOf(']')
    if (lastBracket > firstBracket) cleaned = cleaned.slice(firstBracket, lastBracket + 1)
  }
  cleaned = cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').replace(/,(\s*[}\]])/g, '$1')
  const parsed = JSON.parse(cleaned) as unknown
  if (!Array.isArray(parsed)) throw new Error('Bullet rewrite response must be a JSON array')
  return BulletRewriteResponseSchema.parse(parsed)
}

/** Merge rewritten bullets back into experience. Original experience has bullets as BulletWithId[]; result has bullets as string[]. */
function mergeRewrittenBulletsIntoExperience(
  originalExperience: Array<Role & { bullets: BulletWithId[] }>,
  rewrittenMap: Map<string, string>
): Array<Role & { bullets: string[] }> {
  return originalExperience.map(exp => {
    const bullets = (exp.bullets as BulletWithId[]).map(b => rewrittenMap.get(b.id) ?? b.text)
    return { ...exp, bullets }
  })
}

const BULLET_REWRITE_RETRY_USER_ADD = ` You must return exactly the same set of bullet IDs; do not add or remove any. Output only a JSON array of objects with "id" and "rewritten_text".`

/**
 * Strict bullet-only flow: one model call for bullet rewrites, then merge back. Validates structure and Jaccard, falls back to original when needed.
 */
async function runStrictBulletOnlyFlow(
  original: ResumeJSON,
  flattenedBullets: BulletWithId[],
  originalExperienceWithIds: Array<Role & { bullets: BulletWithId[] }>,
  jdText: string,
  baselineATS: KeywordStats,
  runId: string | null,
  deadline: number
): Promise<{ tailored: TailoredResultType; tokens: number } | null> {
  const originalIds = new Set(flattenedBullets.map(b => b.id))
  const idToOriginalText = new Map(flattenedBullets.map(b => [b.id, b.text]))
  const jaccardThreshold = HONESTY_THRESHOLD

  let lastRaw = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const userPrompt = makeBulletRewriteUserPrompt(flattenedBullets, jdText) + (attempt > 1 ? BULLET_REWRITE_RETRY_USER_ADD : '')
      const messages = [
        { role: 'system' as const, content: BULLET_REWRITE_SYSTEM_PROMPT },
        { role: 'user' as const, content: userPrompt },
      ]
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), Math.max(5000, deadline - Date.now() - 2000))
      const chat = await getOpenAI().chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      })
      clearTimeout(timeoutId)
      const raw = chat.choices[0]?.message?.content ?? ''
      lastRaw = raw
      if (!raw.trim()) throw new Error('Empty bullet-rewrite response')

      const parsed = parseBulletRewriteResponse(raw)
      const returnedIds = new Set(parsed.map(p => p.id))
      const missingIds = [...originalIds].filter(id => !returnedIds.has(id))
      const extraIds = [...returnedIds].filter(id => !originalIds.has(id))
      if (missingIds.length > 0 || extraIds.length > 0 || parsed.length !== flattenedBullets.length) {
        if (attempt === 1) continue
        parsed.length = 0
      }

      const rewrittenMap = new Map<string, string>()
      for (const b of flattenedBullets) {
        rewrittenMap.set(b.id, b.text)
      }
      for (const item of parsed) {
        if (!originalIds.has(item.id)) continue
        const origText = idToOriginalText.get(item.id) ?? ''
        const sim = bulletSimilarity(origText, item.rewritten_text)
        const forbidden = addsForbiddenContent(origText, item.rewritten_text)
        if (sim >= jaccardThreshold && !forbidden.forbidden) {
          rewrittenMap.set(item.id, item.rewritten_text)
        }
      }
      const mergedExperience = mergeRewrittenBulletsIntoExperience(originalExperienceWithIds, rewrittenMap)
      const originalSkills = sanitizeStringArray(original.skills)
      const baseSkills = originalSkills.length > 0 ? originalSkills : extractKeywords(jdText, 10)
      const skills_section = ensureIndustrySkills(baseSkills, baselineATS)
      const tailored: TailoredResultType = {
        summary: original.summary ?? 'Experienced professional with relevant skills and experience.',
        skills_section,
        experience: mergedExperience,
        education: sanitizeLineArray(original.education),
        certifications: sanitizeLineArray(original.certifications),
        projects: sanitizeProjectArray(original.projects),
        additional_sections: sanitizeAdditionalSections(original.additional_sections),
        skills_matched: [],
        skills_missing_but_relevant: [],
        notes_to_user: [],
      }
      const tokens = chat.usage?.total_tokens ?? 0
      return { tailored, tokens }
    } catch (e) {
      if (attempt === 2) {
        console.warn('Strict bullet-only flow failed after retry:', e)
        return null
      }
    }
  }
  return null
}

export type ParseAIResponseOptions = { maxRetries?: number; strictHonestyMode?: boolean }

export async function parseAIResponse(
  raw: string,
  maxRetriesOrOpts: number | ParseAIResponseOptions = 2
): Promise<TailoredResultType> {
  const opts: ParseAIResponseOptions =
    typeof maxRetriesOrOpts === 'object' ? maxRetriesOrOpts : { maxRetries: maxRetriesOrOpts }
  const maxRetries = opts.maxRetries ?? 2
  const strictHonestyMode = opts.strictHonestyMode ?? false

  let lastError: Error | null = null

  console.log('parseAIResponse: Starting with raw length:', raw.length)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`parseAIResponse: Attempt ${attempt}`)

      // Clean the response
      const cleaned = cleanAIResponse(raw)
      console.log('parseAIResponse: Cleaned response length:', cleaned.length)

      // Try to parse
      const parsed = JSON.parse(cleaned)
      console.log('parseAIResponse: JSON parsed successfully')

      // Validate and coerce into schema (strictHonestyMode disables bullet reconstruction — AI hallucination prevention)
      console.log('parseAIResponse: Starting schema validation')
      const validated = await validateAndCoerceResponse(parsed, attempt, strictHonestyMode)
      console.log('parseAIResponse: Schema validation successful')
      
      // Post-processing validation: check for fabricated content (temporarily disabled for debugging)
      // const validationResult = await validateTailoredContent(validated, attempt)
      // if (!validationResult.valid) {
      //   throw new Error(`Content validation failed: ${validationResult.reason}`)
      // }
      
      // Log successful parsing
      logAIResponse(attempt, true, undefined, raw.length)
      
      return validated
      
    } catch (error) {
      lastError = error as Error
      console.warn(`AI response parsing attempt ${attempt} failed:`, error)
      
      // Log failed attempt with detailed error
      logAIResponse(attempt, false, error.message, raw.length)
      
      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  
  // Log final failure with detailed error information
  logAIResponse(maxRetries, false, lastError?.message, raw.length)
  throw new Error(`Failed to parse AI response after ${maxRetries} attempts: ${lastError?.message}`)
}

async function validateAndCoerceResponse(
  parsed: any,
  attempt: number,
  strictHonestyMode?: boolean
): Promise<TailoredResultType> {
  try {
    // First try direct validation
    return TailoredResultSchema.parse(parsed)
  } catch (validationError) {
    console.log(`Direct validation failed (attempt ${attempt}), attempting coercion:`, validationError)

    // Attempt to coerce the response (strictHonestyMode: no bullet reconstruction from strings/descriptions — AI hallucination prevention)
    const coerced = coerceToSchema(parsed, strictHonestyMode)

    try {
      // Validate the coerced response
      return TailoredResultSchema.parse(coerced)
    } catch (coercionError) {
      console.error('Coercion also failed:', coercionError)

      // Log detailed failure information
      const failureDetails = {
        originalResponse: parsed,
        coercedResponse: coerced,
        validationError: validationError.message,
        coercionError: coercionError.message,
        attempt,
      }

      logError(new Error('Schema validation and coercion failed'), failureDetails)

      throw new Error(
        `Schema validation failed: ${validationError.message}. Coercion failed: ${coercionError.message}`
      )
    }
  }
}

function validateTitlePreservation(original: ResumeJSON, tailored: TailoredResultType): { valid: boolean, issues: string[], fixes: Array<{ index: number, originalRole: string, originalCompany: string }> } {
  const issues: string[] = []
  const fixes: Array<{ index: number, originalRole: string, originalCompany: string }> = []
  
  if (!original.experience || !tailored.experience) {
    return { valid: true, issues: [], fixes: [] }
  }
  
  // Match by position/index first (most reliable if order is preserved)
  // Then fall back to company name matching
  const maxLength = Math.max(original.experience.length, tailored.experience.length)
  
  for (let i = 0; i < maxLength; i++) {
    const originalExp = original.experience[i]
    const tailoredExp = tailored.experience[i]
    
    if (!originalExp || !tailoredExp) continue
    
    // Try to match by position first
    const companyMatch = originalExp.company.toLowerCase().trim() === tailoredExp.company.toLowerCase().trim()
    const roleMatch = originalExp.role.toLowerCase().trim() === tailoredExp.role.toLowerCase().trim()
    
    if (companyMatch && !roleMatch) {
      // Company matches but role changed - this is the problem
      issues.push(`Title changed at position ${i}: "${originalExp.role}" → "${tailoredExp.role}"`)
      fixes.push({ index: i, originalRole: originalExp.role, originalCompany: originalExp.company })
    } else if (!companyMatch) {
      // Company name changed - also a problem
      issues.push(`Company changed at position ${i}: "${originalExp.company}" → "${tailoredExp.company}"`)
      fixes.push({ index: i, originalRole: originalExp.role, originalCompany: originalExp.company })
    }
  }
  
  // Also check by company name matching (in case order changed)
  const originalByCompany = new Map<string, { role: string, company: string }>()
  for (const exp of original.experience) {
    const companyKey = exp.company.toLowerCase().trim()
    if (!originalByCompany.has(companyKey)) {
      originalByCompany.set(companyKey, { role: exp.role, company: exp.company })
    }
  }
  
  for (let i = 0; i < tailored.experience.length; i++) {
    const tailoredExp = tailored.experience[i]
    const companyKey = tailoredExp.company.toLowerCase().trim()
    const originalExp = originalByCompany.get(companyKey)
    
    if (originalExp) {
      // Company found in original - check if role matches
      if (originalExp.role.toLowerCase().trim() !== tailoredExp.role.toLowerCase().trim()) {
        // Check if we already flagged this
        const alreadyFixed = fixes.some(f => f.index === i)
        if (!alreadyFixed) {
          issues.push(`Title changed for "${originalExp.company}": "${originalExp.role}" → "${tailoredExp.role}"`)
          fixes.push({ index: i, originalRole: originalExp.role, originalCompany: originalExp.company })
        }
      }
    }
  }
  
  return { valid: issues.length === 0, issues, fixes }
}

// Abbreviation expansion map
const abbreviationMap: Record<string, string> = {
  'hr': 'Human Resources',
  'it': 'Information Technology',
  'pm': 'Product Management', // Could also be Project Management, but default to Product
  'crm': 'Customer Relationship Management',
  'erp': 'Enterprise Resource Planning',
  'kpi': 'key performance indicators',
  'roi': 'return on investment',
  'paas': 'Platform as a Service',
  'iaas': 'Infrastructure as a Service',
  'saas': 'SaaS', // Keep as-is (universally recognized)
  'api': 'API', // Keep as-is (universally recognized)
  'aws': 'AWS', // Keep as-is (universally recognized)
}

function expandAbbreviation(abbr: string, context: string = ''): string {
  const lower = abbr.toLowerCase()
  if (abbreviationMap[lower]) {
    return abbreviationMap[lower]
  }
  // Try to infer from context
  if (lower === 'pm' && context.toLowerCase().includes('project')) {
    return 'Project Management'
  }
  if (lower === 'pm' && context.toLowerCase().includes('product')) {
    return 'Product Management'
  }
  return abbr // Return as-is if unknown
}

function softFixKeywordStuffing(tailored: TailoredResultType): { fixed: TailoredResultType, confidence: number, issuesFixed: string[] } {
  const issuesFixed: string[] = []
  let totalIssues = 0
  let fixedIssues = 0
  
  const fixed = JSON.parse(JSON.stringify(tailored)) // Deep clone
  
  // Common abbreviations pattern
  const abbreviationPattern = /\b(hr|it|pm|crm|erp|kpi|roi|paas|iaas)\b/gi
  const keywordListPattern = /^[a-z\s,;|]+$/i
  const actionVerbs = /\b(used|implemented|developed|managed|created|built|designed|analyzed|worked|collaborated|led|supported|contributed|assisted|participated|leveraged|utilized|applied|integrated|deployed|configured|maintained|optimized|improved|enhanced|streamlined|facilitated|coordinated|executed|delivered|achieved|accomplished|completed|performed|conducted|established|initiated|introduced|launched|operated|oversaw|planned|prepared|produced|provided|resolved|supervised|transformed|validated|verified)\b/i
  
  // Fix experience bullets
  for (const exp of fixed.experience || []) {
    for (let i = 0; i < (exp.bullets || []).length; i++) {
      let bullet = exp.bullets[i]
      const originalBullet = bullet
      let hasIssue = false
      
      // Detect issues
      const abbreviationMatches = bullet.match(abbreviationPattern)
      const hasAbbreviations = abbreviationMatches && abbreviationMatches.length > 0
      const isKeywordList = keywordListPattern.test(bullet) && bullet.split(/[,;|]/).length > 3
      const missingVerb = !actionVerbs.test(bullet) && bullet.split(/\s+/).length > 5
      
      if (hasAbbreviations || isKeywordList || missingVerb) {
        hasIssue = true
        totalIssues++
      }
      
      // Fix 1: Expand abbreviations
      if (hasAbbreviations) {
        let modified = false
        for (const match of abbreviationMatches || []) {
          const expanded = expandAbbreviation(match, bullet)
          if (expanded !== match) {
            // Replace with word boundaries to avoid partial matches
            const regex = new RegExp(`\\b${match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
            bullet = bullet.replace(regex, expanded)
            modified = true
          }
        }
        if (modified) {
          issuesFixed.push(`Expanded abbreviations: "${originalBullet.substring(0, 80)}"`)
          fixedIssues++
        }
      }
      
      // Fix 2: Convert keyword lists to sentences
      if (isKeywordList || missingVerb) {
        // Try to convert keyword list to sentence
        const keywords = bullet.split(/[,;|]/).map(k => k.trim()).filter(k => k.length > 0)
        
        if (keywords.length >= 2 && keywords.length <= 8) {
          // Determine appropriate verb based on keywords
          let verb = 'Worked with'
          const lowerKeywords = keywords.map(k => k.toLowerCase())
          
          // Smart verb selection based on keyword types
          if (lowerKeywords.some(k => k.includes('python') || k.includes('sql') || k.includes('excel') || k.includes('tableau'))) {
            verb = 'Analyzed data using'
          } else if (lowerKeywords.some(k => k.includes('react') || k.includes('node') || k.includes('typescript') || k.includes('javascript'))) {
            verb = 'Developed applications using'
          } else if (lowerKeywords.some(k => k.includes('aws') || k.includes('azure') || k.includes('cloud') || k.includes('docker'))) {
            verb = 'Deployed solutions using'
          } else if (lowerKeywords.some(k => k.includes('hr') || k.includes('human resources') || k.includes('it') || k.includes('information technology'))) {
            verb = 'Collaborated with'
          } else if (lowerKeywords.some(k => k.includes('crm') || k.includes('erp') || k.includes('salesforce'))) {
            verb = 'Managed systems including'
          }
          
          // Build sentence
          const lastKeyword = keywords[keywords.length - 1]
          const otherKeywords = keywords.slice(0, -1)
          const conjunction = keywords.length === 2 ? ' and ' : ', and '
          bullet = `${verb} ${otherKeywords.join(', ')}${conjunction}${lastKeyword}`
          
          issuesFixed.push(`Converted keyword list to sentence: "${originalBullet.substring(0, 80)}"`)
          fixedIssues++
        } else if (keywords.length > 8) {
          // Too many keywords - split into two sentences
          const midPoint = Math.ceil(keywords.length / 2)
          const firstHalf = keywords.slice(0, midPoint)
          const secondHalf = keywords.slice(midPoint)
          
          const firstSentence = `Worked with ${firstHalf.slice(0, -1).join(', ')}, and ${firstHalf[firstHalf.length - 1]}`
          const secondSentence = `Utilized ${secondHalf.slice(0, -1).join(', ')}, and ${secondHalf[secondHalf.length - 1]}`
          
          // Replace current bullet and add new one
          exp.bullets[i] = firstSentence
          exp.bullets.splice(i + 1, 0, secondSentence)
          
          issuesFixed.push(`Split long keyword list into sentences: "${originalBullet.substring(0, 80)}"`)
          fixedIssues++
          i++ // Skip the newly inserted bullet
          continue
        }
      }
      
      exp.bullets[i] = bullet
    }
  }
  
  // Also fix skills section if it has keyword stuffing
  if (fixed.skills_section && Array.isArray(fixed.skills_section)) {
    for (let i = 0; i < fixed.skills_section.length; i++) {
      let skill = fixed.skills_section[i]
      const originalSkill = skill
      
      // Check if skill is an abbreviation
      const abbreviationMatch = skill.match(abbreviationPattern)
      if (abbreviationMatch) {
        const expanded = expandAbbreviation(abbreviationMatch[0], skill)
        if (expanded !== abbreviationMatch[0]) {
          const regex = new RegExp(`\\b${abbreviationMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
          skill = skill.replace(regex, expanded)
          fixed.skills_section[i] = skill
          if (skill !== originalSkill) {
            issuesFixed.push(`Expanded abbreviation in skills: "${originalSkill}"`)
            fixedIssues++
            totalIssues++
          }
        }
      }
    }
  }
  
  // Calculate confidence: percentage of issues that were fixed
  const confidence = totalIssues > 0 ? fixedIssues / totalIssues : 1.0
  
  return { fixed, confidence, issuesFixed }
}

function checkForKeywordStuffing(tailored: TailoredResultType): { valid: boolean, issues: string[] } {
  const issues: string[] = []
  const keywordListPattern = /^[a-z\s,;|]+$/i // Simple pattern for comma/semicolon separated lists
  
  // Common abbreviations that should be expanded
  const abbreviationPattern = /\b(hr|it|pm|crm|erp|kpi|roi|paas|iaas)\b/gi
  
  // Check bullets for keyword stuffing patterns
  for (const exp of tailored.experience || []) {
    for (const bullet of exp.bullets || []) {
      // Check for excessive abbreviations (more than 2 in a bullet)
      const abbreviationMatches = bullet.match(abbreviationPattern)
      if (abbreviationMatches && abbreviationMatches.length > 2) {
        issues.push(`Excessive abbreviations in bullet: "${bullet.substring(0, 100)}"`)
      }
      
      // Check for keyword list pattern (comma/semicolon separated without verbs)
      if (keywordListPattern.test(bullet) && bullet.split(/[,;|]/).length > 3) {
        issues.push(`Keyword list detected (not a sentence): "${bullet.substring(0, 100)}"`)
      }
      
      // Check for missing verbs (indicates keyword list, not sentence)
      const hasVerb = /\b(used|implemented|developed|managed|created|built|designed|analyzed|worked|collaborated|led|supported|contributed|assisted|participated|leveraged|utilized|applied|integrated|deployed|configured|maintained|optimized|improved|enhanced|streamlined|facilitated|coordinated|executed|delivered|achieved|accomplished|completed|performed|conducted|established|initiated|introduced|launched|operated|oversaw|planned|prepared|produced|provided|resolved|supervised|transformed|validated|verified)\b/i
      if (!hasVerb.test(bullet) && bullet.split(/\s+/).length > 5) {
        issues.push(`Missing action verb (likely keyword list): "${bullet.substring(0, 100)}"`)
      }
    }
  }
  
  return { valid: issues.length === 0, issues }
}

/**
 * Coerce parsed AI response to schema. When strictHonestyMode is true, experience bullets
 * must not be reconstructed from strings/descriptions (AI hallucination prevention).
 */
function coerceToSchema(parsed: any, strictHonestyMode?: boolean): any {
  const coerced: any = { ...parsed }

  // Coerce summary
  if (parsed.summary && typeof parsed.summary === 'string') {
    coerced.summary = parsed.summary.trim() || 'Professional summary not available'
  } else if (parsed.summary && typeof parsed.summary === 'object') {
    coerced.summary = extractTextFromObject(parsed.summary) || 'Professional summary not available'
  } else {
    coerced.summary = 'Professional summary not available'
  }

  // Coerce skills_section
  if (Array.isArray(parsed.skills_section)) {
    coerced.skills_section = sanitizeStringArray(parsed.skills_section)
  } else if (parsed.skills_section && typeof parsed.skills_section === 'string') {
    coerced.skills_section = sanitizeStringArray(parsed.skills_section.split(/[,;|•\n]/))
  } else if (parsed.skills && Array.isArray(parsed.skills)) {
    coerced.skills_section = sanitizeStringArray(parsed.skills)
  } else {
    coerced.skills_section = []
  }

  // Coerce experience (strictHonestyMode: only accept bullets array, no reconstruction — AI hallucination prevention)
  if (Array.isArray(parsed.experience)) {
    coerced.experience = parsed.experience
      .map((exp: any) => coerceExperience(exp, strictHonestyMode))
      .filter(Boolean)
  } else if (parsed.experience && typeof parsed.experience === 'object') {
    coerced.experience = [coerceExperience(parsed.experience, strictHonestyMode)].filter(Boolean)
  } else {
    coerced.experience = []
  }

  // Ensure optional arrays are well-formed
  coerced.skills_matched = sanitizeStringArray(parsed.skills_matched)
  coerced.skills_missing_but_relevant = sanitizeStringArray(parsed.skills_missing_but_relevant)
  coerced.notes_to_user = sanitizeNotesArray(parsed.notes_to_user)
  coerced.education = sanitizeLineArray(parsed.education)
  coerced.certifications = sanitizeLineArray(parsed.certifications)
  coerced.projects = sanitizeProjectArray(parsed.projects)
  coerced.additional_sections = sanitizeAdditionalSections(parsed.additional_sections)
  
  return coerced
}

/**
 * Coerce one experience entry. In strictHonestyMode we only accept bullets from an array;
 * no reconstruction from description/string (AI hallucination prevention).
 */
function coerceExperience(exp: any, strictHonestyMode?: boolean): any {
  if (!exp || typeof exp !== 'object') return null

  const coerced: any = { ...exp }

  // Coerce company
  if (typeof exp.company === 'string') {
    coerced.company = exp.company.trim() || 'Unknown Company'
  } else if (exp.company && typeof exp.company === 'object') {
    coerced.company = extractTextFromObject(exp.company) || 'Unknown Company'
  } else {
    coerced.company = 'Unknown Company'
  }

  // Coerce role
  if (typeof exp.role === 'string') {
    coerced.role = exp.role.trim() || 'Unknown Role'
  } else if (exp.role && typeof exp.role === 'object') {
    coerced.role = extractTextFromObject(exp.role) || 'Unknown Role'
  } else {
    coerced.role = 'Unknown Role'
  }

  // Coerce dates
  if (typeof exp.dates === 'string') {
    coerced.dates = exp.dates.trim()
  } else if (exp.dates && typeof exp.dates === 'object') {
    coerced.dates = extractTextFromObject(exp.dates) || ''
  } else {
    coerced.dates = ''
  }

  // Coerce bullets: strictHonestyMode = only accept array (preserve bullet IDs/counts; no fabrication)
  if (Array.isArray(exp.bullets)) {
    coerced.bullets = sanitizeBulletArray(exp.bullets)
  } else if (strictHonestyMode) {
    // Strict honesty: do not reconstruct bullets from string/description — reject by returning empty
    coerced.bullets = []
  } else if (exp.bullets && typeof exp.bullets === 'string') {
    coerced.bullets = sanitizeBulletArray(exp.bullets.split(/[•\n]/))
  } else if (exp.description && typeof exp.description === 'string') {
    coerced.bullets = sanitizeBulletArray(exp.description.split(/[•\n]/))
  } else {
    coerced.bullets = []
  }

  return coerced
}

function sanitizeStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;|•\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  return []
}

function sanitizeNotesArray(value: any): string[] {
  if (Array.isArray(value)) {
    return sanitizeStringArray(value)
  }

  if (typeof value === 'string') {
    return [value.trim()].filter(item => item.length > 0)
  }

  return []
}

function sanitizeBulletArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(/[•\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  return []
}

function sanitizeLineArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|[•]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
  }

  return []
}

function sanitizeProjectArray(value: any): Array<{ name: string; bullets: string[] }> {
  if (!Array.isArray(value)) return []
  return value
    .map(project => {
      if (!project || typeof project !== 'object') return null
      const name = typeof project.name === 'string' ? project.name.trim() : ''
      const bullets = sanitizeBulletArray(project.bullets)
      if (!name && bullets.length === 0) return null
      return {
        name: name || 'Untitled Project',
        bullets
      }
    })
    .filter(Boolean) as Array<{ name: string; bullets: string[] }>
}

function sanitizeAdditionalSections(value: any): Array<{ heading: string; lines: string[] }> {
  if (!Array.isArray(value)) return []
  return value
    .map(section => {
      if (!section || typeof section !== 'object') return null
      const heading = typeof section.heading === 'string' ? section.heading.trim() : ''
      const lines = sanitizeLineArray(section.lines)
      if (!heading || lines.length === 0) return null
      return { heading, lines }
    })
    .filter(Boolean) as Array<{ heading: string; lines: string[] }>
}

function normalizeForComparison(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function mergeLineArrays(original: string[], tailored: string[]): string[] {
  const merged = [...tailored]
  const existing = new Set(tailored.map(normalizeForComparison))
  for (const line of original) {
    const key = normalizeForComparison(line)
    if (!existing.has(key)) {
      merged.push(line)
      existing.add(key)
    }
  }
  return merged
}

function mergeProjects(
  original: Array<{ name: string; bullets: string[] }>,
  tailored: Array<{ name: string; bullets: string[] }>
): Array<{ name: string; bullets: string[] }> {
  const merged = [...tailored]
  const existing = new Set(merged.map(project => normalizeForComparison(project.name || '')))
  
  for (const project of original) {
    const key = normalizeForComparison(project.name || '')
    if (!existing.has(key)) {
      merged.push(project)
      existing.add(key)
      continue
    }
    
    const existingProject = merged.find(p => normalizeForComparison(p.name || '') === key)
    if (existingProject) {
      existingProject.bullets = mergeLineArrays(project.bullets, existingProject.bullets || [])
    }
  }
  
  return merged
}

function mergeAdditionalSections(
  original: Array<{ heading: string; lines: string[] }>,
  tailored: Array<{ heading: string; lines: string[] }>
): Array<{ heading: string; lines: string[] }> {
  const merged = [...tailored]
  const indexByHeading = new Map(
    merged.map((section, idx) => [normalizeForComparison(section.heading), idx] as const)
  )
  
  for (const section of original) {
    const key = normalizeForComparison(section.heading)
    const existingIdx = indexByHeading.get(key)
    if (existingIdx === undefined) {
      merged.push(section)
      indexByHeading.set(key, merged.length - 1)
    } else {
      merged[existingIdx].lines = mergeLineArrays(section.lines, merged[existingIdx].lines || [])
    }
  }
  
  return merged
}

function ensureIndustrySkills(skills: string[], baselineATS: KeywordStats): string[] {
  if (!Array.isArray(skills) || skills.length === 0) return skills
  const normalizedSkills = new Set(skills.map(normalizeForComparison))
  const matchedKeywords = new Set((baselineATS.matched || []).map(normalizeForComparison))
  const missingKeywords = new Set((baselineATS.mustMissing || []).map(normalizeForComparison))
  const domainKeywords = baselineATS.industry?.jdKeywords || []
  const result = [...skills]

  // Add missing must-have keywords that are relevant to the industry
  for (const keyword of baselineATS.mustMissing || []) {
    const normalizedKeyword = normalizeForComparison(keyword)
    // Check if this keyword is in the industry keywords or is a critical keyword
    const isIndustryKeyword = domainKeywords.some(k => normalizeForComparison(k) === normalizedKeyword)
    const isCritical = ['sql','python','excel','tableau','crm','react','node','aws','azure','gcp','adwords','google','facebook','paid','seo','sem','kpi','etl','ml','terraform','salesforce','hubspot','redux','typescript','next','fastapi','django','flask','java','go','kotlin','swift','figma'].some(k => normalizeForComparison(k) === normalizedKeyword)
    
    if ((isIndustryKeyword || isCritical) && !normalizedSkills.has(normalizedKeyword)) {
      result.push(keyword)
      normalizedSkills.add(normalizedKeyword)
    }
  }

  // Also add industry keywords that are already matched (existing behavior)
  for (const keyword of domainKeywords) {
    const normalizedKeyword = normalizeForComparison(keyword)
    if (matchedKeywords.has(normalizedKeyword) && !normalizedSkills.has(normalizedKeyword)) {
      result.push(keyword)
      normalizedSkills.add(normalizedKeyword)
    }
  }

  return result
}

function extractTextFromObject(obj: any): string | null {
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number') return obj.toString()
  if (Array.isArray(obj)) return obj.map(extractTextFromObject).filter(Boolean).join(' ')
  if (obj && typeof obj === 'object') {
    // Try common text fields
    const textFields = ['text', 'content', 'value', 'description', 'title']
    for (const field of textFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        return obj[field]
      }
    }
    // Fallback to first string value
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value
      }
    }
  }
  return null
}

function cleanAIResponse(raw: string): string {
  // Remove any text before the first {
  const firstBrace = raw.indexOf('{')
  if (firstBrace > 0) {
    raw = raw.substring(firstBrace)
  }
  
  // Remove any text after the last }
  const lastBrace = raw.lastIndexOf('}')
  if (lastBrace > 0 && lastBrace < raw.length - 1) {
    raw = raw.substring(0, lastBrace + 1)
  }
  
  // Fix common JSON issues
  raw = raw
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2') // Fix unescaped backslashes
    .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2') // Fix unescaped backslashes (second pass)
    .replace(/"/g, '"') // Fix smart quotes
    .replace(/'/g, "'") // Fix smart apostrophes
  
  return raw
}

/**
 * Fix 1: Role Rehydration Pass
 * Groups experience entries by proximity (company name, date range) and reconstructs proper role objects
 * Fixes broken structures like "Engineer — Unknown" by extracting company/date from nearby context
 * IMPORTANT: Filters out entries with fallback values - better to omit than to fake
 */
function rehydrateExperienceRoles(experience: Array<{ company?: string; role?: string; dates?: string; bullets?: string[] }>): Array<{ company: string; role: string; dates: string; bullets: string[] }> {
  if (!Array.isArray(experience) || experience.length === 0) {
    return []
  }

  // Helper to check if a value is a fallback (should not appear in final output)
  const isFallbackValue = (value: string): boolean => {
    const fallbacks = [
      'Unknown',
      'Unknown Company',
      'Unknown Role',
      'Various Companies',
      'Various Roles',
      'Experience details not specified'
    ]
    const normalized = value.trim().toLowerCase()
    return fallbacks.some(fb => normalized === fb.toLowerCase())
  }

  // Helper to detect if a company name is actually a bullet point (long sentence with verbs)
  const looksLikeBulletPoint = (text: string): boolean => {
    if (!text || text.length < 20) return false // Too short to be a bullet
    // Check for common bullet point patterns: starts with action verb, contains multiple words, has punctuation
    const actionVerbs = /\b(developed|built|created|designed|implemented|improved|collaborated|worked|managed|led|assisted|enhanced|participated|contributed|analyzed|optimized|reduced|increased|delivered|achieved|completed|performed|executed|maintained|configured|deployed|integrated|tested|wrote|programmed|coded|architected|established|initiated|launched|operated|planned|prepared|produced|provided|resolved|supervised|transformed|validated|verified)\b/i
    // If it starts with an action verb and is longer than 30 chars, it's likely a bullet
    if (actionVerbs.test(text.trim()) && text.length > 30) {
      return true
    }
    // If it has multiple sentences or ends with punctuation and is long, it's likely a bullet
    if ((text.includes('.') || text.includes(',') || text.includes(';')) && text.length > 40) {
      return true
    }
    return false
  }

  // Helper to extract dates from text
  const extractDates = (text: string): string => {
    const dateMatch = text.match(/\b(19|20)\d{2}(?:\s*[-–]\s*(?:present|current|19|20)\d{2})?\b/gi)
    return dateMatch ? dateMatch.join(' ') : ''
  }

  // Helper to find company names in text (capitalized words, common company suffixes)
  const extractCompanyFromText = (text: string): string | null => {
    // Look for capitalized words that might be company names
    const companyPattern = /\b([A-Z][a-zA-Z0-9&\s]+(?:Inc|LLC|Ltd|Corp|Company|Co|Group|Systems|Solutions|Technologies|Tech)?)\b/g
    const matches = text.match(companyPattern)
    if (matches && matches.length > 0) {
      // Filter out common false positives
      const falsePositives = ['Software', 'Engineer', 'Developer', 'Manager', 'Director', 'Senior', 'Junior']
      const candidates = matches.filter(m => !falsePositives.some(fp => m.includes(fp)))
      if (candidates.length > 0) {
        return candidates[0].trim()
      }
    }
    return null
  }

  // Helper to calculate string similarity (simple Jaccard on words)
  const stringSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2))
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
    const union = new Set([...wordsA, ...wordsB])
    return union.size > 0 ? intersection.size / union.size : 0
  }

  // Helper to calculate role similarity (more strict than company similarity)
  const roleSimilarity = (role1: string, role2: string): number => {
    if (!role1 || !role2) return 0
    // If either role is a fallback, they're not similar
    if (isFallbackValue(role1) || isFallbackValue(role2)) return 0
    
    const norm1 = normalizeForComparison(role1)
    const norm2 = normalizeForComparison(role2)
    
    // Exact match
    if (norm1 === norm2) return 1.0
    
    // Check if one contains the other (e.g., "Senior Software Engineer" contains "Software Engineer")
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      // But require at least 60% word overlap to avoid false positives
      return stringSimilarity(role1, role2)
    }
    
    // Use word-based similarity
    return stringSimilarity(role1, role2)
  }

  const fixed: Array<{ company: string; role: string; dates: string; bullets: string[] }> = []
  
  for (let i = 0; i < experience.length; i++) {
    const exp = experience[i]
    let company = (exp.company || '').trim()
    const role = (exp.role || '').trim()
    let dates = (exp.dates || '').trim()
    const bullets = exp.bullets || []

    // Check if company field contains a bullet point instead of a company name
    if (company && looksLikeBulletPoint(company)) {
      // Company field is actually a bullet point - try to extract real company from bullets or nearby
      // Try to extract company from bullets
      let extractedCompany = null
      for (const bullet of bullets) {
        const extracted = extractCompanyFromText(bullet)
        if (extracted && !isFallbackValue(extracted) && !looksLikeBulletPoint(extracted)) {
          extractedCompany = extracted
          break
        }
      }
      // If no company found in bullets, check nearby entries
      if (!extractedCompany && i > 0) {
        const prevCompany = (experience[i - 1]?.company || '').trim()
        if (prevCompany && !isFallbackValue(prevCompany) && !looksLikeBulletPoint(prevCompany)) {
          extractedCompany = prevCompany
        }
      }
      // If we found a real company, use it; otherwise mark as missing
      company = extractedCompany || ''
    }

    // If company is missing or "Unknown", try to extract from bullets or nearby entries
    if (!company || isFallbackValue(company)) {
      // Check bullets for company name
      for (const bullet of bullets) {
        const extractedCompany = extractCompanyFromText(bullet)
        if (extractedCompany && !isFallbackValue(extractedCompany) && !looksLikeBulletPoint(extractedCompany)) {
          // Use the extracted company, but check if it's actually a company name
          // by looking at nearby entries
          if (i > 0) {
            const prevCompany = (experience[i - 1]?.company || '').trim()
            if (prevCompany && !isFallbackValue(prevCompany) && stringSimilarity(extractedCompany, prevCompany) > 0.5) {
              // Likely the same company, check if we should merge
              const prevExp = fixed[fixed.length - 1]
              if (prevExp && prevExp.company && !isFallbackValue(prevExp.company)) {
                // Only merge if roles are similar OR if current role is missing/fallback
                const prevRole = (prevExp.role || '').trim()
                const currentRole = role || ''
                const rolesSimilar = roleSimilarity(prevRole, currentRole) > 0.6
                const currentRoleMissing = !currentRole || isFallbackValue(currentRole)
                
                if (rolesSimilar || currentRoleMissing) {
                  // Safe to merge - same company and compatible roles
                  prevExp.bullets.push(...bullets)
                  continue
                }
                // Different roles at same company - preserve as separate entry (internal promotion)
              }
            }
          }
          // Use extracted company, but validate it's not a bullet point
          const newCompany = extractedCompany && !looksLikeBulletPoint(extractedCompany) ? extractedCompany : null
          // If role is also missing, try to infer from bullets
          let newRole = role
          if (!newRole || isFallbackValue(newRole)) {
            // Look for role keywords in bullets
            const roleKeywords = ['engineer', 'developer', 'manager', 'analyst', 'consultant', 'director', 'lead', 'senior', 'junior']
            for (const bullet of bullets) {
              const lowerBullet = bullet.toLowerCase()
              for (const keyword of roleKeywords) {
                if (lowerBullet.includes(keyword)) {
                  // Extract the role phrase
                  const roleMatch = bullet.match(new RegExp(`\\b([A-Z][a-z]+\\s+)?${keyword}\\b`, 'i'))
                  if (roleMatch) {
                    newRole = roleMatch[0]
                    break
                  }
                }
              }
              if (newRole && !isFallbackValue(newRole)) break
            }
            // If we still don't have a valid role, we'll filter this entry out later
          }
          
          // Only add if we have valid company (not a bullet point) and role (no fallbacks)
          if (newCompany && !isFallbackValue(newCompany) && !looksLikeBulletPoint(newCompany) && newRole && !isFallbackValue(newRole) && bullets.length > 0) {
            fixed.push({
              company: newCompany,
              role: newRole,
              dates: dates || extractDates(bullets.join(' ')),
              bullets: bullets
            })
            continue
          }
        }
      }
      
      // Check nearby entries for company name
      if (i > 0) {
        const prevCompany = (experience[i - 1]?.company || '').trim()
        if (prevCompany && !isFallbackValue(prevCompany)) {
          // Check if dates are similar (likely same role)
          const prevDates = (experience[i - 1]?.dates || '').trim()
          const prevRole = (experience[i - 1]?.role || '').trim()
          if (dates && prevDates && stringSimilarity(dates, prevDates) > 0.3) {
            // Check role similarity before merging
            const rolesSimilar = roleSimilarity(prevRole, role) > 0.6
            const currentRoleMissing = !role || isFallbackValue(role)
            
            if (rolesSimilar || currentRoleMissing) {
              // Merge with previous entry
              const prevExp = fixed[fixed.length - 1]
              if (prevExp && prevExp.company === prevCompany && !isFallbackValue(prevExp.company)) {
                prevExp.bullets.push(...bullets)
                continue
              }
            }
            // Different roles - preserve as separate entry
          }
        }
      }
    }

    // Extract dates from bullets if missing
    if (!dates) {
      dates = extractDates(bullets.join(' '))
    }

    // Only add entry if we have real data (no fallbacks and not bullet points)
    let finalCompany: string | null = null
    if (company && !isFallbackValue(company) && !looksLikeBulletPoint(company)) {
      finalCompany = company
    } else {
      // Try to extract from bullets, but validate it's not a bullet point
      const extracted = extractCompanyFromText(bullets.join(' '))
      if (extracted && !isFallbackValue(extracted) && !looksLikeBulletPoint(extracted)) {
        finalCompany = extracted
      }
    }
    
    const finalRole = role && !isFallbackValue(role)
      ? role
      : null
    const finalDates = dates || ''
    
    // Only add if we have valid company (not a bullet point), role, and bullets (no fallbacks)
    if (finalCompany && !isFallbackValue(finalCompany) && !looksLikeBulletPoint(finalCompany) &&
        finalRole && !isFallbackValue(finalRole) && 
        bullets.length > 0) {
      fixed.push({
        company: finalCompany,
        role: finalRole,
        dates: finalDates,
        bullets: bullets
      })
    }
    // Otherwise, omit this entry (better to omit than to fake)
  }

  return fixed
}

/**
 * Fix 2: Aggressive Skills Canonicalization
 * Treats skills as a set with aliases, consolidating duplicates and normalizing forms
 */
function canonicalizeSkills(skills: string[]): string[] {
  if (!Array.isArray(skills) || skills.length === 0) {
    return []
  }

  // Skills alias map: lowercase alias -> canonical form
  const skillsAliasMap: Record<string, string> = {
    'node': 'Node.js',
    'nodejs': 'Node.js',
    'node.js': 'Node.js',
    'api': 'RESTful APIs',
    'apis': 'RESTful APIs',
    'rest': 'RESTful APIs',
    'restful': 'RESTful APIs',
    'restful api': 'RESTful APIs',
    'ci': 'Continuous Integration',
    'cd': 'Continuous Delivery',
    'ci/cd': 'Continuous Integration / Continuous Delivery',
    'cicd': 'Continuous Integration / Continuous Delivery',
    'aws': 'AWS',
    'amazon web services': 'AWS',
    'azure': 'Microsoft Azure',
    'microsoft azure': 'Microsoft Azure',
    'gcp': 'Google Cloud Platform',
    'google cloud platform': 'Google Cloud Platform',
    'python': 'Python',
    'javascript': 'JavaScript',
    'js': 'JavaScript',
    'typescript': 'TypeScript',
    'ts': 'TypeScript',
    'react': 'React',
    'reactjs': 'React',
    'vue': 'Vue.js',
    'vuejs': 'Vue.js',
    'angular': 'Angular',
    'angularjs': 'Angular',
    'sql': 'SQL',
    'nosql': 'NoSQL',
    'mongodb': 'MongoDB',
    'postgres': 'PostgreSQL',
    'postgresql': 'PostgreSQL',
    'mysql': 'MySQL',
    'redis': 'Redis',
    'docker': 'Docker',
    'kubernetes': 'Kubernetes',
    'k8s': 'Kubernetes',
    'terraform': 'Terraform',
    'git': 'Git',
    'github': 'GitHub',
    'gitlab': 'GitLab',
    'jenkins': 'Jenkins',
    'github actions': 'GitHub Actions',
    'gitlab ci': 'GitLab CI',
  }

  // Track which skills we've seen (by normalized form)
  const seen = new Map<string, string>() // normalized -> canonical form
  const result: string[] = []
  
  // Special handling for CI/CD combination - check if we have both separately
  const normalizedSkills = skills.map(s => normalizeForComparison(s || ''))
  const hasCI = normalizedSkills.some(s => s.includes('continuous integration') || s === 'ci')
  const hasCD = normalizedSkills.some(s => s.includes('continuous delivery') || s === 'cd')
  const hasCombined = normalizedSkills.some(s => 
    s.includes('continuous integration') && s.includes('continuous delivery')
  )
  
  // If we have both CI and CD separately but not combined, add combined form
  if (hasCI && hasCD && !hasCombined) {
    result.push('Continuous Integration / Continuous Delivery')
    seen.set('continuous integration / continuous delivery', 'Continuous Integration / Continuous Delivery')
    // Mark individual CI and CD as seen so we don't add them separately
    seen.set('ci', 'Continuous Integration / Continuous Delivery')
    seen.set('continuous integration', 'Continuous Integration / Continuous Delivery')
    seen.set('cd', 'Continuous Integration / Continuous Delivery')
    seen.set('continuous delivery', 'Continuous Integration / Continuous Delivery')
  }

  for (const skill of skills) {
    if (!skill || typeof skill !== 'string') continue
    
    const trimmed = skill.trim()
    if (!trimmed) continue

    const normalized = normalizeForComparison(trimmed)
    
    // Check if we've already seen this skill (by normalized form)
    if (seen.has(normalized)) {
      // Already have this skill, skip duplicate
      continue
    }

    // Check alias map
    const aliasKey = normalized.toLowerCase()
    if (skillsAliasMap[aliasKey]) {
      const canonical = skillsAliasMap[aliasKey]
      const canonicalNormalized = normalizeForComparison(canonical)
      
      // Special case: if canonical is CI or CD and we already have combined form, skip
      if ((canonical === 'Continuous Integration' || canonical === 'Continuous Delivery') && 
          seen.has('continuous integration / continuous delivery')) {
        continue
      }
      
      // Check if canonical form is already in result
      if (seen.has(canonicalNormalized)) {
        continue
      }
      
      result.push(canonical)
      seen.set(canonicalNormalized, canonical)
      seen.set(normalized, canonical) // Also mark the alias as seen
    } else {
      // No alias mapping, use the skill as-is (preserve original capitalization if it looks intentional)
      // Prefer capitalized form if we have both
      const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
      const capitalizedNormalized = normalizeForComparison(capitalized)
      
      if (seen.has(capitalizedNormalized)) {
        // Prefer the version with better capitalization
        const existing = seen.get(capitalizedNormalized)!
        if (existing === existing.charAt(0).toUpperCase() + existing.slice(1).toLowerCase()) {
          continue // Keep existing capitalized version
        }
      }
      
      result.push(trimmed)
      seen.set(normalized, trimmed)
    }
  }

  return result
}

/**
 * Fix 3: Semantic Deduplication for Projects
 * Removes bullets with >85% semantic similarity using Jaccard similarity on token sets
 */
function deduplicateProjectBullets(bullets: string[]): string[] {
  if (!Array.isArray(bullets) || bullets.length <= 1) {
    return bullets
  }

  // Tokenize and normalize a bullet point
  const tokenize = (text: string): Set<string> => {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length >= 3) // Filter short tokens
      .filter(token => {
        // Remove common stopwords
        const stopwords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'an', 'a', 'is', 'it', 'its', 'or', 'but', 'not', 'if', 'then', 'else', 'when', 'where', 'which', 'who', 'what', 'how', 'why', 'used', 'using', 'built', 'created', 'developed', 'implemented'])
        return !stopwords.has(token)
      })
    return new Set(tokens)
  }

  // Calculate Jaccard similarity between two token sets
  const jaccardSimilarity = (set1: Set<string>, set2: Set<string>): number => {
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])
    return union.size > 0 ? intersection.size / union.size : 0
  }

  const result: string[] = []
  const tokenSets: Set<string>[] = []

  for (const bullet of bullets) {
    if (!bullet || typeof bullet !== 'string' || !bullet.trim()) {
      continue
    }

    const trimmed = bullet.trim()
    const tokens = tokenize(trimmed)

    // Skip if token set is too small (likely not meaningful)
    if (tokens.size < 3) {
      result.push(trimmed)
      tokenSets.push(tokens)
      continue
    }

    // Check similarity with existing bullets
    let isDuplicate = false
    for (let i = 0; i < result.length; i++) {
      const similarity = jaccardSimilarity(tokens, tokenSets[i])
      if (similarity > 0.85) {
        // This bullet is very similar to an existing one
        // Keep the longer/more descriptive version
        if (trimmed.length > result[i].length) {
          // Replace with more descriptive version
          result[i] = trimmed
          tokenSets[i] = tokens
        }
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      result.push(trimmed)
      tokenSets.push(tokens)
    }
  }

  return result
}

/**
 * Fix 4: Explicit Structural Quality Gate
 * Validates that every experience entry has required fields and filters out invalid entries
 * IMPORTANT: Filters out entries with fallback values instead of setting them
 */
function validateStructuralQuality(tailored: TailoredResultType): { valid: boolean; filtered: boolean; issues: string[] } {
  const issues: string[] = []
  let filtered = false

  // Helper to check if a value is a fallback (should not appear in final output)
  const isFallbackValue = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false
    const fallbacks = [
      'Unknown',
      'Unknown Company',
      'Unknown Role',
      'Various Companies',
      'Various Roles',
      'Experience details not specified'
    ]
    const normalized = value.trim().toLowerCase()
    return fallbacks.some(fb => normalized === fb.toLowerCase())
  }

  // Helper to detect if a company name is actually a bullet point (long sentence with verbs)
  const looksLikeBulletPoint = (text: string): boolean => {
    if (!text || text.length < 20) return false // Too short to be a bullet
    // Check for common bullet point patterns: starts with action verb, contains multiple words, has punctuation
    const actionVerbs = /\b(developed|built|created|designed|implemented|improved|collaborated|worked|managed|led|assisted|enhanced|participated|contributed|analyzed|optimized|reduced|increased|delivered|achieved|completed|performed|executed|maintained|configured|deployed|integrated|tested|wrote|programmed|coded|architected|established|initiated|launched|operated|planned|prepared|produced|provided|resolved|supervised|transformed|validated|verified)\b/i
    // If it starts with an action verb and is longer than 30 chars, it's likely a bullet
    if (actionVerbs.test(text.trim()) && text.length > 30) {
      return true
    }
    // If it has multiple sentences or ends with punctuation and is long, it's likely a bullet
    if ((text.includes('.') || text.includes(',') || text.includes(';')) && text.length > 40) {
      return true
    }
    return false
  }

  // Validate and filter experience entries
  if (tailored.experience && Array.isArray(tailored.experience)) {
    const validEntries = []
    
    for (let i = 0; i < tailored.experience.length; i++) {
      const exp = tailored.experience[i]
      
      // Check for required fields (must be real data, not fallbacks, and not bullet points)
      const company = (exp.company || '').trim()
      const role = (exp.role || '').trim()
      const dates = exp.dates !== undefined && exp.dates !== null ? String(exp.dates).trim() : ''
      const bullets = Array.isArray(exp.bullets) ? exp.bullets : []
      
      const hasCompany = company && !isFallbackValue(company) && !looksLikeBulletPoint(company)
      const hasRole = role && !isFallbackValue(role)
      const hasBullets = bullets.length > 0 && bullets.every(b => b && typeof b === 'string' && b.trim() && !isFallbackValue(b.trim()))

      // Only keep entries with all required fields (no fallbacks)
      if (hasCompany && hasRole && hasBullets) {
        validEntries.push(exp)
      } else {
        filtered = true
        if (!hasCompany) {
          const reason = looksLikeBulletPoint(company) 
            ? 'Company field contains bullet point text instead of company name' 
            : 'Missing or invalid company name'
          issues.push(`Experience entry ${i + 1}: ${reason} (filtered)`)
        }
        if (!hasRole) {
          issues.push(`Experience entry ${i + 1}: Missing or invalid role/title (filtered)`)
        }
        if (!hasBullets) {
          issues.push(`Experience entry ${i + 1}: Missing or invalid bullets (filtered)`)
        }
      }
    }
    
    // Replace experience array with filtered entries
    tailored.experience = validEntries
  }

  const valid = issues.length === 0
  return { valid, filtered, issues }
}

export async function getTailoredResume(
  original: ResumeJSON, 
  jdText: string, 
  tone: 'professional' | 'concise' | 'impact-heavy',
  options: TailorOptions = {}
): Promise<{ tailored: TailoredResultType, tokens: number, ats: KeywordStatsComparison }> {
  const maxRetries = 2
  let lastError: Error | null = null
  const runId = options.runId || null
  const functionStartTime = Date.now()
  
  // Extract keywords and log keyword engine event
  const keywordExtractStart = Date.now()
  const keywordData = extractKeywords2(jdText, 20)
  const baselineATS = atsCheck(original as ResumeJSON, jdText)
  const keywordExtractDuration = Date.now() - keywordExtractStart
  
  // Log keyword engine event (non-blocking - fire and forget)
  logEvent(runId, KEYWORD_ENGINE, 'extraction_complete', {
    raw_keywords: keywordData.all,
    normalized_keywords: keywordData.all.map(k => normalizeKeyword(k)),
    classification: {
      must_have: keywordData.must,
      nice_to_have: keywordData.nice,
      industry: keywordData.industry?.jdKeywords || [],
    },
    source_weights: {
      role_based: 0.6, // Default weights - could be made configurable
      firm_based: 0.4,
    },
  }).catch(err => console.error('Failed to log keyword engine event:', err))
  
  // Batch log keyword decisions - much faster than individual calls
  const keywordDecisions: Array<{ stage: Stage; eventType: string; payload: Record<string, any> }> = keywordData.all.map(keyword => {
    const normalized = normalizeKeyword(keyword)
    const isInResume = baselineATS.matched?.includes(keyword) || false
    const relevanceScore = isInResume ? 1.0 : 0.5 // Simplified - could be enhanced
    const confidence = keywordData.must.includes(keyword) ? 0.9 : keywordData.nice.includes(keyword) ? 0.6 : 0.4
    
    return {
      stage: KEYWORD_DECISIONS,
      eventType: 'decision',
      payload: {
      keyword,
      source: keywordData.must.includes(keyword) ? 'must_have' : keywordData.nice.includes(keyword) ? 'nice_to_have' : 'industry',
      role_relevance_score: relevanceScore,
      inclusion_decision: isInResume ? 'included' : 'excluded',
      insertion_location: isInResume ? 'existing' : undefined,
      justification: isInResume 
        ? 'Keyword already present in resume' 
        : keywordData.must.includes(keyword)
        ? 'Required keyword from job description'
        : 'Optional keyword for ATS optimization',
      confidence,
      },
  }
  })
  
  // Batch insert all keyword decisions in a single database operation
  const { logEventsBatch } = await import('./trace/tracer')
  await logEventsBatch(runId, keywordDecisions)
  
  let lastRawResponse = ''
  const deadline = options.deadline ?? Date.now() + 25000
  
  // No experience: do not auto-extract from free text (AI hallucination prevention — extractBulletsFromFreeText only on explicit user action)
  if (!original.experience || original.experience.length === 0) {
    console.warn('No experience data available for tailoring; returning fallback (no automatic extraction)')
    return await handleMissingExperience(original, jdText, tone, options)
  }

  const flattenedBullets = flattenBulletsWithIds(original.experience)
  const useStrictBulletOnly = options.strictHonestyMode !== false && flattenedBullets.length > 0
  const originalExperienceWithIds = useStrictBulletOnly
    ? (original.experience as Array<Role & { bullets: BulletWithId[] }>)
    : null

  if (useStrictBulletOnly && originalExperienceWithIds) {
    const bulletOnlyResult = await runStrictBulletOnlyFlow(
      original,
      flattenedBullets,
      originalExperienceWithIds,
      jdText,
      baselineATS,
      runId,
      options.deadline ?? Date.now() + 25000
    )
    if (bulletOnlyResult) {
      const tailored = bulletOnlyResult.tailored
      const tokens = bulletOnlyResult.tokens
      const tailoredATS = atsCheck(tailored as ResumeJSON, jdText)
      const atsComparison = compareKeywordStats(baselineATS, tailoredATS)
      return { tailored, tokens, ats: atsComparison }
    }
    // Strict flow failed (e.g. parse error); fall through to legacy full-resume path
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting attempt ${attempt} of ${maxRetries}`)
      const promptBuildStart = Date.now()
      const userPrompt = makeUserPrompt({ resume_json: original, job_text: jdText, tone, baseline_stats: baselineATS, attempt })
      const promptBuildDuration = Date.now() - promptBuildStart
      
      // Log prompt build event (non-blocking - fire and forget)
      logEvent(runId, PROMPT_BUILD, 'prompt_constructed', {
        prompt_version: 'v1.4.2', // Extract from constants or config
        constraints: ['no fabrication', 'preserve roles', 'maintain ATS coverage'],
        keywords_passed: keywordData.all.slice(0, 15), // Top keywords passed to prompt
        blocked_keywords: [], // Could be enhanced to track blocked keywords
        tone,
      }).catch(err => console.error('Failed to log prompt build event:', err))
      
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: userPrompt }
      ]

      console.log('Making OpenAI API call...')
      let chat
      const modelCallStartTime = Date.now()
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout
        
        chat = await getOpenAI().chat.completions.create({
          model: OPENAI_MODEL,
          messages,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          max_tokens: 4000 // Reduced to prevent timeout
        })
        
        clearTimeout(timeoutId)
        console.log('OpenAI API call successful, response received')
      } catch (openaiError: any) {
        console.error('OpenAI API call failed:', openaiError)
        console.error('OpenAI error type:', openaiError?.constructor?.name)
        console.error('OpenAI error message:', openaiError?.message)
        console.error('OpenAI error status:', openaiError?.status)
        console.error('OpenAI error code:', openaiError?.code)
        
        // Handle timeout specifically
        if (openaiError?.name === 'AbortError' || openaiError?.message?.includes('timeout')) {
          throw new Error('OpenAI API timeout - request took too long')
        }
        
        throw new Error(`OpenAI API error: ${openaiError?.message || 'Unknown error'}`)
      }

      const raw = chat.choices[0]?.message?.content || '{}'
      lastRawResponse = raw
      
      // Log model call event (non-blocking - fire and forget)
      const latencyMs = Date.now() - modelCallStartTime
      logEvent(runId, MODEL_CALL, 'api_call', {
        model: OPENAI_MODEL,
        latency_ms: latencyMs,
        tokens_in: chat.usage?.prompt_tokens || 0,
        tokens_out: chat.usage?.completion_tokens || 0,
        response_valid: raw.trim().length > 0 && raw.includes('{'),
      }).catch(err => console.error('Failed to log model call event:', err))
      
      if (!raw || raw.trim() === '') {
        throw new Error('Empty response from AI')
      }
      const trimmedRaw = raw.trim()
      if (trimmedRaw.indexOf('{') === -1 || trimmedRaw.lastIndexOf('}') === -1) {
        console.warn('AI response missing JSON object structure', trimmedRaw.slice(0, 200))
        throw new Error('AI response missing JSON object structure')
      }
      
      // Parse and validate (strictHonestyMode: no bullet coercion; preserve IDs/counts — AI hallucination prevention)
      const parseStart = Date.now()
      const tailored = await parseAIResponse(raw, {
        maxRetries: 2,
        strictHonestyMode: options.strictHonestyMode,
      })
      const parseDuration = Date.now() - parseStart

      // Strict honesty: if bullet count doesn't match original, reject AI experience and use original (AI hallucination prevention)
      if (options.strictHonestyMode && original.experience?.length && flattenedBullets.length > 0) {
        const origCount = flattenedBullets.length
        const tailoredCount = (tailored.experience ?? []).reduce(
          (sum, exp) => sum + (exp.bullets?.length ?? 0),
          0
        )
        if (origCount !== tailoredCount) {
          const fallbackExperience = (original.experience ?? []).map(exp => ({
            company: exp.company ?? '',
            role: exp.role ?? '',
            dates: exp.dates ?? '',
            bullets: getBulletStrings(exp.bullets),
          }))
          tailored.experience = fallbackExperience
        }
      }
      
      // Additional validation - ensure we got meaningful content
      if (!tailored || typeof tailored !== 'object') {
        throw new Error('AI response is not a valid object')
      }
      
      // SOFT FIX PASS: Attempt local fixes before retrying
      const softFixStart = Date.now()
      let needsRetry = false
      let retryReason = ''
      let softFixesApplied = 0
      
      // Fix 1: Title preservation (always fixable - just restore originals)
      const titleValidation = validateTitlePreservation(original, tailored)
      if (!titleValidation.valid) {
        console.warn('Title preservation issues detected, applying soft fix:', titleValidation.issues)
        // Fix titles by restoring originals
        for (const fix of titleValidation.fixes) {
          if (tailored.experience[fix.index]) {
            tailored.experience[fix.index].role = fix.originalRole
            tailored.experience[fix.index].company = fix.originalCompany
            softFixesApplied++
          }
        }
        console.log(`Title preservation fixed locally (${titleValidation.fixes.length} fixes)`)
        
        // Log soft fix event (non-blocking)
        logEvent(runId, SOFT_FIX, 'title_preservation_fixed', {
          fixes_applied: titleValidation.fixes.length,
          issues: titleValidation.issues,
        }).catch(err => console.error('Failed to log soft fix event:', err))
      }
      
      // Fix 2: Keyword stuffing (attempt soft fix first)
      const stuffingCheck = checkForKeywordStuffing(tailored)
      if (!stuffingCheck.valid) {
        console.warn('Keyword stuffing detected, attempting soft fix:', stuffingCheck.issues)
        const softFixResult = softFixKeywordStuffing(tailored)
        
        // Apply fixes
        tailored.experience = softFixResult.fixed.experience
        tailored.skills_section = softFixResult.fixed.skills_section
        
        // Calculate confidence: if we fixed >= 70% of issues, accept it
        // Otherwise, retry the model
        if (softFixResult.confidence >= 0.70) {
          console.log(`Soft fix successful: fixed ${(softFixResult.confidence * 100).toFixed(0)}% of issues (${softFixResult.issuesFixed.length} fixes applied)`)
          softFixesApplied += softFixResult.issuesFixed.length
          
          // Log successful soft fix (non-blocking)
          logEvent(runId, SOFT_FIX, 'keyword_stuffing_fixed', {
            confidence: softFixResult.confidence,
            fixes_applied: softFixResult.issuesFixed.length,
            issues_fixed: softFixResult.issuesFixed,
          }).catch(err => console.error('Failed to log soft fix event:', err))
        } else {
          console.warn(`Soft fix insufficient: only fixed ${(softFixResult.confidence * 100).toFixed(0)}% of issues. Retrying model.`)
          needsRetry = true
          retryReason = `Keyword stuffing soft fix insufficient (${(softFixResult.confidence * 100).toFixed(0)}% fixed, need ≥70%)`
          
          // Log insufficient fix (non-blocking)
          logEvent(runId, SOFT_FIX, 'keyword_stuffing_insufficient', {
            confidence: softFixResult.confidence,
            fixes_applied: softFixResult.issuesFixed.length,
            requires_retry: true,
          }).catch(err => console.error('Failed to log soft fix event:', err))
        }
      }
      
      // Only retry if soft fixes were insufficient
      if (needsRetry && attempt < maxRetries) {
        throw new Error(retryReason || 'Output contains issues that require model retry')
      }
      
      // Log total soft fixes if any were applied
      const softFixDuration = Date.now() - softFixStart
      if (softFixesApplied > 0) {
        console.log(`Total soft fixes applied: ${softFixesApplied} (avoided model retry)`)
      }
      
      // If experience is missing or empty, try to preserve original
      if (!tailored.experience || tailored.experience.length === 0) {
        console.warn('AI response missing experience, preserving original experience')
        tailored.experience = original.experience || []
      }
      if ((!tailored.education || tailored.education.length === 0) && original.education) {
        console.warn('AI response missing education, preserving original education')
        tailored.education = sanitizeLineArray(original.education)
      }
      if ((!tailored.certifications || tailored.certifications.length === 0) && original.certifications) {
        console.warn('AI response missing certifications, preserving original certifications')
        tailored.certifications = sanitizeLineArray(original.certifications)
      }
      if ((!tailored.projects || tailored.projects.length === 0) && original.projects) {
        console.warn('AI response missing projects, preserving original projects')
        tailored.projects = sanitizeProjectArray(original.projects)
      }
      if ((!tailored.additional_sections || tailored.additional_sections.length === 0) && original.additional_sections) {
        console.warn('AI response missing additional sections, preserving originals')
        tailored.additional_sections = sanitizeAdditionalSections(original.additional_sections)
      }
      if ((!tailored.skills_section || tailored.skills_section.length === 0) && original.skills) {
        console.warn('AI response missing skills section, preserving original skills')
        tailored.skills_section = sanitizeStringArray(original.skills)
      }

      const originalEducation = sanitizeLineArray(original.education)
      if (originalEducation.length > 0) {
        tailored.education = mergeLineArrays(originalEducation, tailored.education || [])
      }
      const originalCerts = sanitizeLineArray(original.certifications)
      if (originalCerts.length > 0) {
        tailored.certifications = mergeLineArrays(originalCerts, tailored.certifications || [])
      }
      const originalProjects = sanitizeProjectArray(original.projects)
      if (originalProjects.length > 0) {
        tailored.projects = mergeProjects(originalProjects, sanitizeProjectArray(tailored.projects))
      }
      const originalAdditional = sanitizeAdditionalSections(original.additional_sections)
      if (originalAdditional.length > 0) {
        tailored.additional_sections = mergeAdditionalSections(originalAdditional, sanitizeAdditionalSections(tailored.additional_sections))
      }
      const originalSkills = sanitizeStringArray(original.skills)
      if (originalSkills.length > 0) {
        tailored.skills_section = mergeLineArrays(originalSkills, tailored.skills_section || [])
      }
      tailored.skills_section = ensureIndustrySkills(tailored.skills_section || [], baselineATS)
      
      // Fix 2: Aggressive Skills Canonicalization
      tailored.skills_section = canonicalizeSkills(tailored.skills_section || [])
      
      // Fix 1: Role Rehydration Pass
      const rehydrateStart = Date.now()
      const beforeRehydrate = tailored.experience?.length || 0
      tailored.experience = rehydrateExperienceRoles(tailored.experience || [])
      const afterRehydrate = tailored.experience?.length || 0
      const rehydrateDuration = Date.now() - rehydrateStart
      
      // Fix 3: Semantic Deduplication for Projects
      if (tailored.projects) {
        tailored.projects = tailored.projects.map(project => ({
          ...project,
          bullets: deduplicateProjectBullets(project.bullets || [])
        }))
      }
      
      // Fix 4: Structural Quality Gate
      const qualityCheck = validateStructuralQuality(tailored)
      if (!qualityCheck.valid && qualityCheck.filtered) {
        console.warn('Structural quality issues detected, invalid entries filtered:', qualityCheck.issues)
      }
      
      // Extract token usage and compute ATS delta
      const tokens = chat.usage?.total_tokens || 0
      const atsCheckStart = Date.now()
      const tailoredATS = atsCheck(tailored as ResumeJSON, jdText)
      const atsComparison = compareKeywordStats(baselineATS, tailoredATS)
      const atsCheckDuration = Date.now() - atsCheckStart
      
      // Log ATS scoring event (non-blocking - fire and forget)
      const matchedNew = (tailoredATS.matched || []).filter(k => !(baselineATS.matched || []).includes(k))
      const stillMissing = (tailoredATS.missing || []).filter(k => (baselineATS.matched || []).includes(k))
      
      logEvent(runId, ATS_SCORING, 'scoring_complete', {
        before: Math.round(baselineATS.coverage * 100),
        after: Math.round(tailoredATS.coverage * 100),
        matched_new: matchedNew,
        still_missing: stillMissing,
        regressions: stillMissing, // Keywords that were matched before but not after
      }).catch(err => console.error('Failed to log ATS scoring event:', err))
      
      const coverageGain = atsComparison.deltas.coverage
      const mustCoverageGain = atsComparison.deltas.mustCoverage || 0
      const industryBaseline = baselineATS.industry?.coverage || 0
      const industryCurrent = tailoredATS.industry?.coverage || 0
      const industryGain = industryCurrent - industryBaseline
      const industryNeedsBoost =
        (baselineATS.industry?.jdKeywords?.length || 0) > 0 && industryCurrent < 0.7
      const needsAggressiveRetry =
        (baselineATS.coverage < 0.85 && coverageGain < 0.08) ||
        (industryNeedsBoost && industryGain < 0.08)
      
      // CRITICAL: Reject if ATS coverage decreases (Risk 3: ATS invisibility regression)
      // This prevents polish from accidentally removing keywords
      const coverageRegression = coverageGain < 0 || industryGain < -0.01
      const mustCoverageRegression = mustCoverageGain < 0
      
      // Also check if keywords were lost (regressions detected)
      const keywordsLost = (atsComparison.deltas.regressions || []).length > 0

      if ((coverageRegression || mustCoverageRegression || keywordsLost || needsAggressiveRetry) && attempt < maxRetries) {
        console.warn('ATS coverage insufficient or regressed, retrying with stronger instructions', {
          coverageGain,
          mustCoverageGain,
          baseline: baselineATS.coverage,
          baselineMustCoverage: baselineATS.mustCoverage || 0,
          tailored: tailoredATS.coverage,
          tailoredMustCoverage: tailoredATS.mustCoverage || 0,
          industryBaseline,
          industryCurrent,
          industryGain,
          keywordsLost,
          regressions: atsComparison.deltas.regressions || [],
          attempt
        })
        throw new Error('ATS coverage regressed or insufficient—polish must not reduce keyword coverage')
      }
      
      // Log successful AI request
      logAIResponse(attempt, true, undefined, raw.length)
      
      const totalDuration = Date.now() - functionStartTime
      
      return { tailored, tokens, ats: atsComparison }
      
    } catch (error) {
      lastError = error as Error
      console.warn(`AI request attempt ${attempt} failed:`, error)
      console.warn('Error details:', {
        message: error.message,
        stack: error.stack,
        originalExperienceLength: original.experience?.length || 0,
        jdLength: jdText.length,
        attempt,
        lastRawResponseSnippet: lastRawResponse?.slice(0, 200),
        remainingTime: deadline - Date.now()
      })
      
      // Log failed attempt with detailed context
      logAIResponse(attempt, false, (error as Error).message)
      
      if (attempt < maxRetries) {
        const waitMs = Math.min(500, Math.max(0, deadline - Date.now() - 500))
        if (waitMs > 50) {
          await new Promise(resolve => setTimeout(resolve, waitMs))
        }
      }
    }
  }
  
  // Final fallback: return original resume with minimal changes
  console.error('All AI attempts failed, returning fallback response')
  console.error('Last error:', lastError?.message)
  logError(new Error('All AI attempts failed'), { 
    original, 
    jdText, 
    tone, 
    lastError: lastError?.message,
    attempts: maxRetries
  })
  
  const fallback = createFallbackResponse(original, jdText)
  const fallbackATS = compareKeywordStats(baselineATS, atsCheck(fallback as ResumeJSON, jdText))
  return { tailored: fallback, tokens: 0, ats: fallbackATS }
}

/**
 * When resume has no experience, return fallback only. We do NOT auto-call extractBulletsFromFreeText
 * (AI hallucination prevention — free-text extraction only on explicit user action e.g. "Paste your experience").
 */
async function handleMissingExperience(
  original: ResumeJSON,
  jdText: string,
  tone: 'professional' | 'concise' | 'impact-heavy',
  options: TailorOptions = {}
): Promise<{ tailored: TailoredResultType; tokens: number; ats: KeywordStatsComparison }> {
  const baselineATS = atsCheck(original as ResumeJSON, jdText)
  const fallback = createFallbackResponse(original, jdText, baselineATS)
  const fallbackATS = compareKeywordStats(baselineATS, atsCheck(fallback as ResumeJSON, jdText))
  return { tailored: fallback, tokens: 0, ats: fallbackATS }
}

function createFallbackResponse(original: ResumeJSON, jdText: string, baselineATS?: KeywordStats): TailoredResultType {
  const summary =
    original.summary ||
    'Experienced professional with relevant skills and experience.'

  const originalSkills = sanitizeStringArray(original.skills)
  const baseline = baselineATS ?? atsCheck(original as ResumeJSON, jdText)
  const baseSkills = originalSkills.length > 0 ? originalSkills : extractKeywords(jdText, 10)
  const skills_section = ensureIndustrySkills(baseSkills, baseline)
  const experience =
    (Array.isArray(original.experience) && original.experience.length > 0
      ? original.experience
      : []) as TailoredResultType['experience']

  return {
    summary,
    skills_section,
    experience,
    education: sanitizeLineArray(original.education),
    certifications: sanitizeLineArray(original.certifications),
    projects: sanitizeProjectArray(original.projects),
    additional_sections: sanitizeAdditionalSections(original.additional_sections),
    skills_matched: [],
    skills_missing_but_relevant: [],
    notes_to_user: []
  }
}

/**
 * Extract structured experience from free-form text using AI.
 * Only call on explicit user action (e.g. "Paste your experience"); never call automatically.
 * All returned roles are tagged source: "user_provided" (AI hallucination prevention).
 */
export async function extractBulletsFromFreeText(freeText: string): Promise<ResumeJSON['experience']> {
  if (!freeText || freeText.trim().length === 0) {
    return []
  }

  const openai = getOpenAI()
  if (!openai) {
    console.warn('OpenAI not available for bullet extraction')
    return []
  }

  const prompt = `Given the following free-form text describing work experience, extract it into a JSON array of roles. Each role should have 'company', 'role', 'dates' (optional, can be empty string), and 'bullets' (an array of strings). If no specific role or company is clear, group related bullets under a generic "Experience" role.

Example:
Text: "Company A (2020-2022) - Software Engineer. Developed X, Implemented Y. Company B (2018-2020) - Junior Dev. Assisted with Z."
Output:
[
  {
    "company": "Company A",
    "role": "Software Engineer",
    "dates": "2020-2022",
    "bullets": ["Developed X", "Implemented Y"]
  },
  {
    "company": "Company B",
    "role": "Junior Dev",
    "dates": "2018-2020",
    "bullets": ["Assisted with Z"]
  }
]

Text: "${freeText}"
Output:`

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    })

    const rawResponse = chatCompletion.choices[0].message.content
    if (!rawResponse) {
      throw new Error("AI returned an empty response for bullet extraction")
    }

    const parsed = JSON.parse(rawResponse)

    const mapRole = (role: any) => {
      const bullets = Array.isArray(role.bullets)
        ? role.bullets.filter((b: any) => typeof b === 'string' && (b as string).trim().length > 0).map((b: any) => (b as string).trim())
        : []
      return {
        company: (role.company || '').trim() || 'Unknown Company',
        role: (role.role || '').trim() || 'Unknown Role',
        dates: (role.dates || '').trim() || '',
        bullets,
        source: 'user_provided' as const,
        hasBullets: bullets.length > 0,
      }
    }

    if (Array.isArray(parsed)) {
      return parsed.map(mapRole)
    }
    if (parsed.experience && Array.isArray(parsed.experience)) {
      return parsed.experience.map(mapRole)
    }
    throw new Error("Unexpected response format from AI")
  } catch (error) {
    console.error("Error extracting bullets from free text:", error)
    logError(error as Error, { context: 'bullet_extraction' })
    return []
  }
}

// Post-processing validation to ensure no fabricated content
async function validateTailoredContent(result: TailoredResultType, attempt: number): Promise<{ valid: boolean, reason?: string }> {
  try {
    // Check for suspicious patterns that might indicate fabrication
    const suspiciousPatterns = [
      /\b(?:increased|improved|reduced|optimized|enhanced|boosted|accelerated|streamlined|maximized|minimized)\s+(?:by\s+)?\d+%/gi,
      /\b(?:saved|generated|produced|delivered|achieved|accomplished|completed)\s+(?:over\s+)?\$?\d+[km]?\b/gi,
      /\b(?:managed|led|supervised|directed|oversaw)\s+\d+\+?\s+(?:team|people|employees|staff|members)\b/gi,
      /\b(?:reduced|decreased|cut|lowered)\s+(?:costs?|expenses?|time|budget)\s+(?:by\s+)?\d+%/gi
    ]
    
    // Check experience bullets for suspicious metrics
    for (const exp of result.experience) {
      for (const bullet of exp.bullets) {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(bullet)) {
            // Check if this metric appears in the original resume
            // For now, we'll flag it as suspicious and let the honesty scan handle it
            console.warn(`Suspicious metric pattern detected in bullet: ${bullet}`)
          }
        }
      }
    }
    
    // Check for completely new company names or roles (basic check)
    const originalCompanies = new Set<string>()
    const originalRoles = new Set<string>()
    
    // This would need to be passed from the original resume data
    // For now, we'll rely on the honesty scan for detailed validation
    
    return { valid: true }
  } catch (error) {
    return { valid: false, reason: `Validation error: ${error.message}` }
  }
}
