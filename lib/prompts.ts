export const SYSTEM_PROMPT = `You are a resume tailoring assistant. You must never invent employment, responsibilities, or metrics not present in the user's resume.
You may rephrase and reorder text, emphasize relevant achievements, insert synonyms and role-specific keywords ONLY IF they are consistent with the original experience.
Target: ATS-friendly, concise impact bullets: Action verb + what + tools/skills + measurable outcome or scope.
Bullets must be 1–2 lines each, no first-person, no fluff.
Policy: absolutely no fabricated credentials, roles, companies, tools, or metrics.`

export function makeUserPrompt({ resume_json, job_text, tone }:{ resume_json: any, job_text: string, tone: string }) {
  return `RESUME (STRUCTURED JSON):
${JSON.stringify(resume_json)}

JOB DESCRIPTION:
${job_text}

TASKS:
1) Identify top 10 skills/keywords in the JD.
2) For each experience bullet in the resume, rewrite it to align with the JD when truthful.
3) If a bullet is irrelevant to the JD, compress or remove it.
4) Do NOT introduce new employers, roles, or fabricated metrics. If metric unknown, keep qualitative impact.
5) Return:
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
