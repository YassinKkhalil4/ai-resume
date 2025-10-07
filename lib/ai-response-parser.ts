import { TailoredResultSchema, type TailoredResultType } from './schemas'
import { ResumeJSON } from './types'
import { logAIResponse, logError } from './telemetry'
import { extractKeywords } from './jd'
import { getOpenAI, OPENAI_MODEL } from './openai'
import { SYSTEM_PROMPT, makeUserPrompt } from './prompts'

export async function parseAIResponse(raw: string, maxRetries: number = 3): Promise<TailoredResultType> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Clean the response
      const cleaned = cleanAIResponse(raw)
      
      // Try to parse
      const parsed = JSON.parse(cleaned)
      
      // Validate and coerce into schema
      const validated = await validateAndCoerceResponse(parsed, attempt)
      
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
  const coerced: any = {}
  
  // Coerce summary
  if (parsed.summary && typeof parsed.summary === 'string') {
    coerced.summary = parsed.summary.trim()
  } else if (parsed.summary && typeof parsed.summary === 'object') {
    // If summary is an object, try to extract text
    coerced.summary = extractTextFromObject(parsed.summary) || 'Professional summary not available'
  } else {
    coerced.summary = 'Professional summary not available'
  }
  
  // Coerce skills_section
  if (Array.isArray(parsed.skills_section)) {
    coerced.skills_section = parsed.skills_section.filter(skill => 
      typeof skill === 'string' && skill.trim().length > 0
    ).map(skill => skill.trim())
  } else if (parsed.skills_section && typeof parsed.skills_section === 'string') {
    // If skills is a string, split it
    coerced.skills_section = parsed.skills_section
      .split(/[,;|•\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
  } else if (parsed.skills && Array.isArray(parsed.skills)) {
    // Alternative field name
    coerced.skills_section = parsed.skills.filter(skill => 
      typeof skill === 'string' && skill.trim().length > 0
    ).map(skill => skill.trim())
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
  
  return coerced
}

function coerceExperience(exp: any): any {
  if (!exp || typeof exp !== 'object') return null
  
  const coerced: any = {}
  
  // Coerce company
  if (typeof exp.company === 'string') {
    coerced.company = exp.company.trim()
  } else if (exp.company && typeof exp.company === 'object') {
    coerced.company = extractTextFromObject(exp.company) || 'Unknown Company'
  } else {
    coerced.company = 'Unknown Company'
  }
  
  // Coerce role
  if (typeof exp.role === 'string') {
    coerced.role = exp.role.trim()
  } else if (exp.role && typeof exp.role === 'object') {
    coerced.role = extractTextFromObject(exp.role) || 'Unknown Role'
  } else {
    coerced.role = 'Unknown Role'
  }
  
  // Coerce bullets
  if (Array.isArray(exp.bullets)) {
    coerced.bullets = exp.bullets.filter(bullet => 
      typeof bullet === 'string' && bullet.trim().length > 0
    ).map(bullet => bullet.trim())
  } else if (exp.bullets && typeof exp.bullets === 'string') {
    // If bullets is a string, split it
    coerced.bullets = exp.bullets
      .split(/[•\n]/)
      .map(b => b.trim())
      .filter(b => b.length > 0)
  } else if (exp.description && typeof exp.description === 'string') {
    // Alternative field name
    coerced.bullets = exp.description
      .split(/[•\n]/)
      .map(b => b.trim())
      .filter(b => b.length > 0)
  } else {
    coerced.bullets = []
  }
  
  return coerced
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
): Promise<{ tailored: TailoredResultType, tokens: number }> {
  const maxRetries = 3
  let lastError: Error | null = null
  
  // Enhanced validation - check if we have meaningful data to work with
  if (!original.experience || original.experience.length === 0) {
    console.warn('No experience data available for tailoring, attempting extraction from free text')
    return await handleMissingExperience(original, jdText, tone)
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        { role: 'user' as const, content: makeUserPrompt({ resume_json: original, job_text: jdText, tone }) }
      ]

      const chat = await getOpenAI().chat.completions.create({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 4000 // Ensure we don't get truncated responses
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
      
      // Extract token usage
      const tokens = chat.usage?.total_tokens || 0
      
      // Log successful AI request
      logAIResponse(attempt, true, undefined, raw.length)
      
      return { tailored, tokens }
      
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
      logAIResponse(attempt, false, error.message)
      
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
  
  return { tailored: createFallbackResponse(original, jdText), tokens: 0 }
}

async function handleMissingExperience(
  original: ResumeJSON, 
  jdText: string, 
  tone: 'professional' | 'concise' | 'impact-heavy'
): Promise<{ tailored: TailoredResultType, tokens: number }> {
  console.log('Handling missing experience - attempting extraction from free text')
  
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
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 2000
    })

    const extractionRaw = extractionChat.choices[0]?.message?.content || '{}'
    const extracted = await parseAIResponse(extractionRaw)
    
    if (extracted.experience && extracted.experience.length > 0) {
      console.log('Successfully extracted experience from free text')
      // Now tailor the extracted experience
      const tailored = await getTailoredResume(
        { ...original, experience: extracted.experience }, 
        jdText, 
        tone
      )
      return tailored
    }
  } catch (error) {
    console.error('Failed to extract experience from free text:', error)
  }
  
  // If extraction fails, return fallback
  return { tailored: createFallbackResponse(original, jdText), tokens: 0 }
}

function createFallbackResponse(original: ResumeJSON, jdText: string): TailoredResultType {
  // Extract keywords from job description
  const keywords = extractKeywords(jdText, 10)
  
  // Create a minimal tailored response that preserves original data
  return {
    summary: original.summary || 'Experienced professional with relevant skills and experience.',
    skills_section: original.skills || [],
    experience: original.experience || []
  }
}

