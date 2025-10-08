import { ResumeJSON } from '../types'

export function minimalTemplate(resume: ResumeJSON, options:{ includeSkills:boolean, includeSummary:boolean }) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  /* Force safe system fonts to avoid blank glyphs in serverless Chromium */
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size: 11.5pt; line-height: 1.35; }
  h2 { font-size: 12.5pt; margin: 0 0 6px; letter-spacing: 0.2px; }
  .sec { margin: 16px 0; }
  .role { font-weight: 600; }
  ul { margin: 4px 0 0 16px; padding: 0; }
  li { margin: 2px 0; }
  .sep { height:1px; background:#eaeaea; margin:10px 0; }
</style></head><body>
  ${options.includeSummary && resume.summary ? `<div class="sec"><h2>Summary</h2><div>${esc(resume.summary!)}</div></div>` : ''}
  <div class="sec"><h2>Experience</h2><div class="sep"></div>
    ${resume.experience.map(e=>`
      <div class="entry">
        <div class="role">${esc(e.role)} — ${esc(e.company)} <span style="color:#666; font-weight:400">(${esc(e.dates)})</span></div>
        <ul>${e.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>
  ${options.includeSkills && resume.skills?.length ? `<div class="sec"><h2>Skills</h2><div>${(resume.skills||[]).join(' • ')}</div></div>`:''}
  ${resume.education?.length ? `<div class="sec"><h2>Education</h2><ul>${(resume.education||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
</body></html>`
}

function esc(s:string){ return (s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]) }
