import { KeywordStats } from './types'

export const SYSTEM_PROMPT = `You are a resume tailoring assistant with STRICT INTEGRITY RULES.

CRITICAL CONSTRAINTS:
- NEVER invent new employers, job titles, tools, technologies, or companies
- NEVER add metrics, numbers, or achievements not present in the original resume
- NEVER create new responsibilities or duties not mentioned in the source material
- ONLY rephrase, reorder, and emphasize existing content using synonyms
- ONLY use keywords that appear in either the original resume OR the job description

TARGET: ATS-friendly, concise impact bullets: Action verb + what + tools/skills + measurable outcome or scope.
Bullets must be 1–2 lines each, no first-person, no fluff.

VIOLATION = IMMEDIATE REJECTION. You are monitored for fabrication.`

export function makeUserPrompt({
  resume_json,
  job_text,
  tone,
  baseline_stats,
  attempt = 1
}:{ resume_json: any, job_text: string, tone: string, baseline_stats?: KeywordStats, attempt?: number }) {
  const baselineCoverage = baseline_stats ? Math.round((baseline_stats.coverage || 0) * 100) : null
  const mustMissing = baseline_stats?.mustMissing || []
  const topMissing = baseline_stats?.topMissing || baseline_stats?.missing?.slice(0, 10) || []

  const atsImprovementDirective = baseline_stats ? `
BASELINE ATS SUMMARY:
- Current coverage: ${baselineCoverage}%
- Must-have keywords still missing: ${mustMissing.length ? mustMissing.join(', ') : 'None'}
- High-priority keywords to weave in (only if factual): ${topMissing.length ? topMissing.join(', ') : 'None'}

OPTIMIZATION GOAL:
- Increase overall ATS coverage by incorporating the missing keywords above wherever the original resume provides support.
- Prioritise adding the exact missing keywords into relevant bullets, skills, or sections without fabricating experience.
- Do not remove keywords that are already matched unless they are irrelevant to the job description.
${attempt > 1 ? '- Coverage improvement was insufficient previously; aggressively integrate the missing keywords while staying truthful.\n' : ''}` : ''

  return `RESUME (STRUCTURED JSON):
${JSON.stringify(resume_json)}

JOB DESCRIPTION:
${job_text}

STRICT TASKS:
1) Identify top 10 skills/keywords in the JD that also appear in the original resume.
2) Rewrite EVERY section the resume already has (experience, skills, education, certifications, projects, volunteer, extracurricular, etc.). Preserve section headings and entry order while aligning wording to the JD.
3) For each experience or project bullet, rewrite it using ONLY existing content. Compress or remove bullets that do not support the JD.
4) ABSOLUTELY FORBIDDEN: new employers, roles, tools, technologies, companies, or fabricated metrics.
5) If original content lacks metrics, keep qualitative impact only.
6) Every word in tailored bullets must trace back to original resume or JD keywords.
7) Keep volunteer/extracurricular/community sections under "additional_sections" with the same headings from the original resume.

Return:
{
  "skills_matched": [...],
  "skills_missing_but_relevant": [...],
  "summary": "2-3 lines tailored to JD, no I/Me",
  "experience": [
    {"company": "...","role":"...","dates":"...","bullets":[ "...", "...", "..." ]},
    ...
  ],
  "skills_section": ["..."],
  "education": ["..."],
  "certifications": ["..."],
  "projects": [
    {"name":"...","bullets":["...","..."]}
  ],
  "additional_sections": [
    {"heading":"Volunteer Experience","lines":["...","..."]}
  ],
  "notes_to_user": ["Flagged ambiguity...", "Consider adding ... if true"]
}

${atsImprovementDirective}

TONE: ${tone}
If the JOB DESCRIPTION content is very short (< 400 chars), only optimize wording and ordering; do not add any new keywords beyond what appears in the resume or JD.
Return JSON exactly in the specified schema; no extra keys.`
}
