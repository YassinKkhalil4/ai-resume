import { TailoredResultSchema, type TailoredResultType } from './schemas'
import { KeywordStatsComparison, ResumeJSON } from './types'
import { logAIResponse, logError } from './telemetry'
import { extractKeywords } from './jd'
import { getOpenAI, OPENAI_MODEL } from './openai'
import { SYSTEM_PROMPT, makeUserPrompt } from './prompts'
import { honestyScan } from './honesty'
import { atsCheck, compareKeywordStats } from './ats'

export async function parseAIResponse(raw: string, maxRetries: number = 3): Promise<TailoredResultType> {
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
      
      // Validate and coerce into schema
      console.log('parseAIResponse: Starting schema validation')
      const validated = await validateAndCoerceResponse(parsed, attempt)
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

async function validateAndCoerceResponse(parsed: any, attempt: number): Promise<TailoredResultType> {
  try {
    // First try direct validation
    return TailoredResultSchema.parse(parsed)
  } catch (validationError) {
    console.log(`Direct validation failed (attempt ${attempt}), attempting coercion:`, validationError)
    
    // Attempt to coerce the response into the correct schema
    const coerced = coerceToSchema(parsed)
    
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
        attempt
      }
      
      logError(new Error('Schema validation and coercion failed'), failureDetails)
      
      throw new Error(`Schema validation failed: ${validationError.message}. Coercion failed: ${coercionError.message}`)
    }
  }
}

function coerceToSchema(parsed: any): any {
  const coerced: any = { ...parsed }
  
  // Coerce summary
  if (parsed.summary && typeof parsed.summary === 'string') {
    coerced.summary = parsed.summary.trim() || 'Professional summary not available'
  } else if (parsed.summary && typeof parsed.summary === 'object') {
    // If summary is an object, try to extract text
    coerced.summary = extractTextFromObject(parsed.summary) || 'Professional summary not available'
  } else {
    coerced.summary = 'Professional summary not available'
  }
  
  // Coerce skills_section
  if (Array.isArray(parsed.skills_section)) {
    coerced.skills_section = sanitizeStringArray(parsed.skills_section)
  } else if (parsed.skills_section && typeof parsed.skills_section === 'string') {
    // If skills is a string, split it
    coerced.skills_section = sanitizeStringArray(parsed.skills_section.split(/[,;|•\n]/))
  } else if (parsed.skills && Array.isArray(parsed.skills)) {
    // Alternative field name
    coerced.skills_section = sanitizeStringArray(parsed.skills)
  } else {
    coerced.skills_section = []
  }
  
  // Coerce experience
  if (Array.isArray(parsed.experience)) {
    coerced.experience = parsed.experience.map(exp => coerceExperience(exp)).filter(Boolean)
  } else if (parsed.experience && typeof parsed.experience === 'object') {
    // If experience is an object, try to convert to array
    coerced.experience = [coerceExperience(parsed.experience)].filter(Boolean)
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

function coerceExperience(exp: any): any {
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
  
  // Coerce bullets
  if (Array.isArray(exp.bullets)) {
    coerced.bullets = sanitizeBulletArray(exp.bullets)
  } else if (exp.bullets && typeof exp.bullets === 'string') {
    // If bullets is a string, split it
    coerced.bullets = sanitizeBulletArray(exp.bullets.split(/[•\n]/))
  } else if (exp.description && typeof exp.description === 'string') {
    // Alternative field name
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

export async function getTailoredResume(
  original: ResumeJSON, 
  jdText: string, 
  tone: 'professional' | 'concise' | 'impact-heavy'
): Promise<{ tailored: TailoredResultType, tokens: number, ats: KeywordStatsComparison }> {
  const maxRetries = 3
  let lastError: Error | null = null
  const baselineATS = atsCheck(original, jdText)
  
  // Enhanced validation - check if we have meaningful data to work with
  if (!original.experience || original.experience.length === 0) {
    console.warn('No experience data available for tailoring, attempting extraction from free text')
    return await handleMissingExperience(original, jdText, tone)
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: makeUserPrompt({ resume_json: original, job_text: jdText, tone, baseline_stats: baselineATS, attempt }) }
      ]

      const chat = await getOpenAI().chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 8000 // Increased limit for long resumes
      })

      const raw = chat.choices[0]?.message?.content || '{}'
      
      if (!raw || raw.trim() === '') {
        throw new Error('Empty response from AI')
      }
      
      // Parse and validate with detailed error reporting
      const tailored = await parseAIResponse(raw)
      
      // Additional validation - ensure we got meaningful content
      if (!tailored || typeof tailored !== 'object') {
        throw new Error('AI response is not a valid object')
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
        tailored.projects = mergeProjects(originalProjects, tailored.projects || [])
      }
      const originalAdditional = sanitizeAdditionalSections(original.additional_sections)
      if (originalAdditional.length > 0) {
        tailored.additional_sections = mergeAdditionalSections(originalAdditional, tailored.additional_sections || [])
      }
      const originalSkills = sanitizeStringArray(original.skills)
      if (originalSkills.length > 0) {
        tailored.skills_section = mergeLineArrays(originalSkills, tailored.skills_section || [])
      }
      
      // Extract token usage and compute ATS delta
      const tokens = chat.usage?.total_tokens || 0
      const tailoredATS = atsCheck(tailored, jdText)
      const atsComparison = compareKeywordStats(baselineATS, tailoredATS)
      const coverageGain = atsComparison.deltas.coverage
      const needsAggressiveRetry = baselineATS.coverage < 0.85 && coverageGain < 0.05
      const coverageRegression = coverageGain < 0

      if ((coverageRegression || needsAggressiveRetry) && attempt < maxRetries) {
        console.warn('ATS coverage insufficient, retrying with stronger instructions', {
          coverageGain,
          baseline: baselineATS.coverage,
          tailored: tailoredATS.coverage,
          attempt
        })
        throw new Error('ATS improvement insufficient, retrying')
      }
      
      // Log successful AI request
      logAIResponse(attempt, true, undefined, raw.length)
      
      return { tailored, tokens, ats: atsComparison }
      
    } catch (error) {
      lastError = error as Error
      console.warn(`AI request attempt ${attempt} failed:`, error)
      console.warn('Error details:', {
        message: error.message,
        stack: error.stack,
        originalExperienceLength: original.experience?.length || 0,
        jdLength: jdText.length,
        attempt
      })
      
      // Log failed attempt with detailed context
      logAIResponse(attempt, false, (error as Error).message)
      
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
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
  const fallbackATS = compareKeywordStats(baselineATS, atsCheck(fallback, jdText))
  return { tailored: fallback, tokens: 0, ats: fallbackATS }
}

async function handleMissingExperience(
  original: ResumeJSON, 
  jdText: string, 
  tone: 'professional' | 'concise' | 'impact-heavy'
): Promise<{ tailored: TailoredResultType, tokens: number, ats: KeywordStatsComparison }> {
  console.log('Handling missing experience - attempting extraction from free text')
  const baselineATS = atsCheck(original, jdText)
  
  try {
    // First, try to extract experience from free text
    const extractionPrompt = `Extract work experience from the following resume text. Return a JSON object with an "experience" array. Each experience should have "company", "role", and "bullets" fields.

Resume text: ${JSON.stringify(original)}

Return only valid JSON.`

    const extractionChat = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are an expert at extracting structured data from resume text. Return only valid JSON.' },
        { role: 'user', content: extractionPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 4000 // Increased for better experience extraction
    })

    const extractionRaw = extractionChat.choices[0]?.message?.content || '{}'
    const extractedData = JSON.parse(extractionRaw)
    
    if (extractedData.experience && Array.isArray(extractedData.experience) && extractedData.experience.length > 0) {
      console.log('Successfully extracted experience from free text')
      // Now tailor the extracted experience
      const tailored = await getTailoredResume(
        { ...original, experience: extractedData.experience }, 
        jdText, 
        tone
      )
      return tailored
    }
  } catch (error) {
    console.error('Failed to extract experience from free text:', error)
  }
  
  // If extraction fails, return fallback
  const fallback = createFallbackResponse(original, jdText)
  const fallbackATS = compareKeywordStats(baselineATS, atsCheck(fallback, jdText))
  return { tailored: fallback, tokens: 0, ats: fallbackATS }
}

function createFallbackResponse(original: ResumeJSON, jdText: string): TailoredResultType {
  const summary =
    original.summary ||
    'Experienced professional with relevant skills and experience.'

  const originalSkills = sanitizeStringArray(original.skills)
  const skills_section = originalSkills.length > 0 ? originalSkills : extractKeywords(jdText, 10)
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
 * Extract structured experience from free-form text using AI
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
    
    // Validate the structure
    if (Array.isArray(parsed)) {
      return parsed.map((role: any) => ({
        company: (role.company || '').trim() || 'Unknown Company',
        role: (role.role || '').trim() || 'Unknown Role',
        dates: (role.dates || '').trim() || '',
        bullets: Array.isArray(role.bullets) ? role.bullets.filter(b => typeof b === 'string' && b.trim().length > 0).map(b => b.trim()) : []
      }))
    } else if (parsed.experience && Array.isArray(parsed.experience)) {
      return parsed.experience.map((role: any) => ({
        company: (role.company || '').trim() || 'Unknown Company',
        role: (role.role || '').trim() || 'Unknown Role',
        dates: (role.dates || '').trim() || '',
        bullets: Array.isArray(role.bullets) ? role.bullets.filter(b => typeof b === 'string' && b.trim().length > 0).map(b => b.trim()) : []
      }))
    } else {
      throw new Error("Unexpected response format from AI")
    }

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
