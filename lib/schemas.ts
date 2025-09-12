import { z } from 'zod'

export const RoleSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  dates: z.string().optional().default(''),
  bullets: z.array(z.string()).max(12)
}).strict()

export const TailoredResultSchema = z.object({
  skills_matched: z.array(z.string()),
  skills_missing_but_relevant: z.array(z.string()),
  summary: z.string().optional().default(''),
  experience: z.array(RoleSchema),
  skills_section: z.array(z.string()),
  notes_to_user: z.array(z.string())
}).strict()

export type TailoredResultType = z.infer<typeof TailoredResultSchema>
