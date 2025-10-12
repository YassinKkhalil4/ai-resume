import { z } from 'zod'

export const RoleSchema = z.object({
  company: z.string().min(1, 'Company name is required').max(100, 'Company name too long'),
  role: z.string().min(1, 'Role title is required').max(100, 'Role title too long'),
  dates: z.string().max(50, 'Date string too long').optional().default(''),
  bullets: z.array(z.string().min(10, 'Bullet point too short').max(200, 'Bullet point too long')).min(1, 'At least one bullet required').max(8, 'Too many bullet points')
}).strict()

export const TailoredResultSchema = z.object({
  skills_matched: z.array(z.string().min(1, 'Skill cannot be empty').max(50, 'Skill name too long')).max(20, 'Too many matched skills').optional().default([]),
  skills_missing_but_relevant: z.array(z.string().min(1, 'Skill cannot be empty').max(50, 'Skill name too long')).max(15, 'Too many missing skills').optional().default([]),
  summary: z.string().min(20, 'Summary too short').max(500, 'Summary too long').optional().default(''),
  experience: z.array(RoleSchema).min(1, 'At least one experience required').max(10, 'Too many experiences'),
  skills_section: z.array(z.string().min(1, 'Skill cannot be empty').max(50, 'Skill name too long')).min(3, 'At least 3 skills required').max(30, 'Too many skills'),
  notes_to_user: z.array(z.string().min(10, 'Note too short').max(200, 'Note too long')).max(5, 'Too many notes').optional().default([])
}).strict()

export type TailoredResultType = z.infer<typeof TailoredResultSchema>

// Enhanced validation with detailed error reporting
export function validateTailoredResult(data: any): { 
  valid: boolean, 
  data?: TailoredResultType, 
  errors: string[] 
} {
  try {
    const result = TailoredResultSchema.parse(data)
    return { valid: true, data: result, errors: [] }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => {
        const path = err.path.join('.')
        return `${path}: ${err.message}`
      })
      return { valid: false, errors }
    }
    return { valid: false, errors: [String(error)] }
  }
}

// Coercion helpers for common data issues
export function coerceTailoredResult(data: any): TailoredResultType {
  const coerced: any = {}
  
  // Coerce summary
  coerced.summary = typeof data.summary === 'string' ? data.summary.trim() : ''
  
  // Coerce skills_section
  if (Array.isArray(data.skills_section)) {
    coerced.skills_section = data.skills_section
      .filter(skill => typeof skill === 'string' && skill.trim().length > 0)
      .map(skill => skill.trim())
  } else if (typeof data.skills_section === 'string') {
    coerced.skills_section = data.skills_section
      .split(/[,;|•\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
  } else {
    coerced.skills_section = []
  }
  
  // Coerce experience
  if (Array.isArray(data.experience)) {
    coerced.experience = data.experience.map(exp => coerceRole(exp)).filter(Boolean)
  } else {
    coerced.experience = []
  }
  
  // Coerce optional fields
  coerced.skills_matched = Array.isArray(data.skills_matched) ? data.skills_matched : []
  coerced.skills_missing_but_relevant = Array.isArray(data.skills_missing_but_relevant) ? data.skills_missing_but_relevant : []
  coerced.notes_to_user = Array.isArray(data.notes_to_user) ? data.notes_to_user : []
  
  return coerced as TailoredResultType
}

function coerceRole(exp: any): any {
  if (!exp || typeof exp !== 'object') return null
  
  return {
    company: typeof exp.company === 'string' ? exp.company.trim() : 'Unknown Company',
    role: typeof exp.role === 'string' ? exp.role.trim() : 'Unknown Role',
    dates: typeof exp.dates === 'string' ? exp.dates.trim() : '',
    bullets: Array.isArray(exp.bullets) 
      ? exp.bullets.filter(b => typeof b === 'string' && b.trim().length > 0).map(b => b.trim())
      : []
  }
}
