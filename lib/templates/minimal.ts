import { ResumeJSON } from '../types'

export function minimalTemplate(resume: ResumeJSON, options:{ includeSkills:boolean, includeSummary:boolean }) {
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

  /* Minimal-specific styling */
  h2 { font-size: 12.5pt; margin: 0 0 6px; letter-spacing: 0.2px; }
  .section { margin: 16px 0; }
  .role { font-weight: 600; }
  .sep { height:1px; background:#2c5aa0; margin:10px 0; }
</style></head><body>
  ${options.includeSummary && resume.summary ? `<div class="section"><h2>Summary</h2><div>${esc(resume.summary!)}</div></div>` : ''}
  <div class="section"><h2>Experience</h2><div class="sep"></div>
    ${resume.experience.map(e=>`
      <div class="entry">
        <div class="role">${esc(e.role)} — ${esc(e.company)} <span style="color:#666; font-weight:400">(${esc(e.dates)})</span></div>
        <ul>${e.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>
  ${options.includeSkills && resume.skills?.length ? `<div class="section"><h2>Skills</h2><div>${(resume.skills||[]).join(' • ')}</div></div>`:''}
  ${resume.education?.length ? `<div class="section"><h2>Education</h2><ul>${(resume.education||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
</body></html>`
}

function esc(s:string){ return (s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]) }
