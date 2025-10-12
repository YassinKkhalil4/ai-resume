import { ResumeJSON } from '../types'

export function classicTemplate(resume: ResumeJSON, options:{ includeSkills:boolean, includeSummary:boolean }) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  /* Use system fonts; avoid webfonts */
  body {
    font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Helvetica Neue",Helvetica,sans-serif;
    font-size: 12pt;
    line-height: 1.35;
    color: #111;
  }

  .section { break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; margin: 0 0 6pt; }
  @page { margin: 18mm 16mm; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 0 0 6px; }

  /* Classic-specific styling */
  h2 { font-size: 13pt; border-bottom: 1px solid #2c5aa0; padding-bottom: 4px; }
  .section { margin: 14px 0; }
  .role { font-weight: bold; }
  .chips span { display:inline-block; border:1px solid #2c5aa0; padding: 2px 8px; margin: 0 6px 6px 0; font-size: 10pt; }
</style></head><body>
  ${options.includeSummary && resume?.summary ? `<div class="section"><h2>Summary</h2><div>${esc(resume.summary)}</div></div>` : ''}
  <div class="section"><h2>Experience</h2>
    ${(Array.isArray(resume?.experience) ? resume.experience : []).map(e=>`
      <div class="entry">
        <div class="role">${esc(e?.role || '')} — ${esc(e?.company || '')}</div>
        <div class="dates" style="color:#666">${esc(e?.dates || '')}</div>
        <ul>${(Array.isArray(e?.bullets) ? e.bullets : []).map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>
  ${options.includeSkills && Array.isArray(resume?.skills) && resume.skills.length ? `<div class="section"><h2>Skills</h2><div class="chips">${resume.skills.map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>`:''}
  ${Array.isArray(resume?.education) && resume.education.length ? `<div class="section"><h2>Education</h2><ul>${resume.education.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
  ${Array.isArray(resume?.certifications) && resume.certifications.length ? `<div class="section"><h2>Certifications</h2><ul>${resume.certifications.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
</body></html>`
}

function esc(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
