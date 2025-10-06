import { logError } from './telemetry'

export interface AIErrorDetails {
  error: Error
  context: {
    attempt: number
    maxRetries: number
    originalResponse?: any
    cleanedResponse?: string
    validationErrors?: string[]
    coercionAttempts?: string[]
    originalResume?: any
    jobDescription?: string
    tone?: string
  }
}

export function logAIError(details: AIErrorDetails) {
  const errorMessage = `AI Error (Attempt ${details.context.attempt}/${details.context.maxRetries}): ${details.error.message}`
  
  console.error(errorMessage, {
    error: details.error,
    context: details.context,
    stack: details.error.stack
  })
  
  // Log to telemetry system
  logError(details.error, details.context)
  
  return errorMessage
}

export function createDetailedErrorMessage(error: Error, context: any): string {
  const baseMessage = error.message
  
  if (error.message.includes('JSON')) {
    return `${baseMessage}. This usually means the AI returned malformed JSON. Please try again.`
  }
  
  if (error.message.includes('schema')) {
    return `${baseMessage}. The AI response didn't match the expected format. Please try again.`
  }
  
  if (error.message.includes('Empty response')) {
    return `${baseMessage}. The AI service may be temporarily unavailable. Please try again in a moment.`
  }
  
  if (error.message.includes('timeout')) {
    return `${baseMessage}. The request took too long to process. Please try again.`
  }
  
  return `${baseMessage}. Please try again or contact support if the issue persists.`
}

export function validateAIResponse(response: any): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  
  if (!response || typeof response !== 'object') {
    errors.push('Response is not an object')
    return { valid: false, errors }
  }
  
  // Check required fields
  if (!response.summary || typeof response.summary !== 'string') {
    errors.push('Missing or invalid summary field')
  }
  
  if (!response.skills_section || !Array.isArray(response.skills_section)) {
    errors.push('Missing or invalid skills_section field')
  }
  
  if (!response.experience || !Array.isArray(response.experience)) {
    errors.push('Missing or invalid experience field')
  }
  
  // Validate experience structure
  if (response.experience && Array.isArray(response.experience)) {
    response.experience.forEach((exp: any, index: number) => {
      if (!exp.company || typeof exp.company !== 'string') {
        errors.push(`Experience ${index}: Missing or invalid company field`)
      }
      if (!exp.role || typeof exp.role !== 'string') {
        errors.push(`Experience ${index}: Missing or invalid role field`)
      }
      if (!exp.bullets || !Array.isArray(exp.bullets)) {
        errors.push(`Experience ${index}: Missing or invalid bullets field`)
      }
    })
  }
  
  return { valid: errors.length === 0, errors }
}

export function createUserFriendlyError(error: Error, context: any): string {
  const errorType = classifyError(error)
  
  switch (errorType) {
    case 'JSON_PARSE_ERROR':
      return 'The AI response was malformed. Please try again.'
    
    case 'SCHEMA_VALIDATION_ERROR':
      return 'The AI response format was unexpected. Please try again.'
    
    case 'EMPTY_RESPONSE_ERROR':
      return 'The AI service returned an empty response. Please try again.'
    
    case 'TIMEOUT_ERROR':
      return 'The request timed out. Please try again.'
    
    case 'NETWORK_ERROR':
      return 'Network error occurred. Please check your connection and try again.'
    
    case 'RATE_LIMIT_ERROR':
      return 'Too many requests. Please wait a moment and try again.'
    
    default:
      return 'An unexpected error occurred. Please try again.'
  }
}

function classifyError(error: Error): string {
  const message = error.message.toLowerCase()
  
  if (message.includes('json') || message.includes('parse')) {
    return 'JSON_PARSE_ERROR'
  }
  
  if (message.includes('schema') || message.includes('validation')) {
    return 'SCHEMA_VALIDATION_ERROR'
  }
  
  if (message.includes('empty') || message.includes('no content')) {
    return 'EMPTY_RESPONSE_ERROR'
  }
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT_ERROR'
  }
  
  if (message.includes('network') || message.includes('connection')) {
    return 'NETWORK_ERROR'
  }
  
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'RATE_LIMIT_ERROR'
  }
  
  return 'UNKNOWN_ERROR'
}
