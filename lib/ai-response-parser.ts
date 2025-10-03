import { TailoredResultSchema, type TailoredResultType } from './schemas'
import { ResumeJSON } from './types'
import { logAIResponse, logError } from './telemetry'
import { extractKeywords } from './jd'

export async function parseAIResponse(raw: string, maxRetries: number = 3): Promise<TailoredResultType> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Clean the response
      const cleaned = cleanAIResponse(raw)
      
      // Try to parse
      const parsed = JSON.parse(cleaned)
      
      // Validate schema
      const validated = TailoredResultSchema.parse(parsed)
      
      // Log successful parsing
      logAIResponse(attempt, true, undefined, raw.length)
      
      return validated
      
    } catch (error) {
      lastError = error as Error
      console.warn(`AI response parsing attempt ${attempt} failed:`, error)
      
      // Log failed attempt
      logAIResponse(attempt, false, error.message, raw.length)
      
      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  
  // Log final failure
  logAIResponse(maxRetries, false, lastError?.message, raw.length)
  throw new Error(`Failed to parse AI response after ${maxRetries} attempts: ${lastError?.message}`)
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
    console.warn('No experience data available for tailoring')
    return { tailored: createFallbackResponse(original, jdText), tokens: 0 }
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
      
      // Parse and validate
      const tailored = await parseAIResponse(raw)
      
      // Relaxed validation - only require that we got some response
      if (!tailored || typeof tailored !== 'object') {
        throw new Error('AI response is not a valid object')
      }
      
      // If experience is missing or empty, try to preserve other fields
      if (!tailored.experience || tailored.experience.length === 0) {
        console.warn('AI response missing experience, using original experience')
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
        jdLength: jdText.length
      })
      
      // Log failed attempt
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
  logError(new Error('All AI attempts failed'), { original, jdText, tone, lastError: lastError?.message })
  
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

// Import the required functions and constants
import { getOpenAI, OPENAI_MODEL } from './openai'
import { SYSTEM_PROMPT, makeUserPrompt } from './prompts'
