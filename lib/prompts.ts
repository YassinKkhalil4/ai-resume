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

export function makeUserPrompt({ resume_json, job_text, tone }:{ resume_json: any, job_text: string, tone: string }) {
  return `RESUME (STRUCTURED JSON):
${JSON.stringify(resume_json)}

JOB DESCRIPTION:
${job_text}

STRICT TASKS:
1) Identify top 10 skills/keywords in the JD that also appear in the original resume.
2) For each experience bullet in the resume, rewrite it to align with the JD using ONLY existing content.
3) If a bullet is irrelevant to the JD, compress or remove it.
4) ABSOLUTELY FORBIDDEN: new employers, roles, tools, technologies, companies, or fabricated metrics.
5) If original content lacks metrics, keep qualitative impact only.
6) Every word in tailored bullets must trace back to original resume or JD keywords.

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
  "notes_to_user": ["Flagged ambiguity...", "Consider adding ... if true"]
}

TONE: ${tone}
If the JOB DESCRIPTION content is very short (< 400 chars), only optimize wording and ordering; do not add any new keywords beyond what appears in the resume or JD.
Return JSON exactly in the specified schema; no extra keys.`
}
