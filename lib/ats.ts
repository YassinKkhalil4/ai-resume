import { extractKeywords2 } from './jd'
import { ResumeJSON, KeywordStats } from './types'

export function atsCheck(resume: ResumeJSON, jdText: string): KeywordStats {
  const { all, must, nice } = extractKeywords2(jdText, 20)
  const resumeText = stringifyResume(resume).toLowerCase()

  const matched = all.filter(k => resumeText.includes(k.toLowerCase()))
  const missing = all.filter(k => !resumeText.includes(k.toLowerCase()))

  const mustMatched = must.filter(k => resumeText.includes(k.toLowerCase()))
  const mustMissing = must.filter(k => !resumeText.includes(k.toLowerCase()))
  const niceMatched = nice.filter(k => resumeText.includes(k.toLowerCase()))
  const niceMissing = nice.filter(k => !resumeText.includes(k.toLowerCase()))

  const warnings:string[] = []
  if (!resume.experience?.length) warnings.push('No Experience section detected.')
  if (!resume.skills?.length) warnings.push('No Skills section detected.')

  return {
    coverage: all.length ? matched.length / all.length : 0,
    matched, missing, warnings,
    mustCoverage: must.length ? mustMatched.length / must.length : 0,
    niceCoverage: nice.length ? niceMatched.length / nice.length : 0,
    mustMatched, mustMissing, niceMatched, niceMissing,
    topMissing: missing.slice(0,5)
  }
}

function stringifyResume(r: ResumeJSON): string {
  let t = ''
  if (r.summary) t += r.summary + '\n'
  if (r.skills) t += (r.skills||[]).join(' ') + '\n'
  // Handle TailoredResult which has skills_section instead of skills
  if ('skills_section' in r && Array.isArray((r as any).skills_section)) {
    t += ((r as any).skills_section || []).join(' ') + '\n'
  }
  for (const e of r.experience || []) {
    t += [e.company, e.role, e.dates].join(' ') + ' ' + (e.bullets||[]).join(' ')
  }
  return t
}
