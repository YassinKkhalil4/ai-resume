import { ResumeJSON } from '../types'

export function modernTemplate(resume: ResumeJSON, options:{ includeSkills:boolean, includeSummary:boolean }) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size: 12pt; line-height: 1.35; }
  h2 { font-size: 13pt; margin: 0 0 8px; }
  .sec { margin: 14px 0; }
  .row { display:flex; justify-content: space-between; }
  .role { font-weight: 600; }
  ul { margin: 6px 0 0 16px; padding: 0; }
  li { margin: 4px 0; }
  .chips span { display:inline-block; background:#f5f5f5; border-radius: 6px; padding: 2px 8px; margin: 0 6px 6px 0; font-size: 10pt; }
  .divider { height:1px; background:#eee; margin:8px 0; }
</style></head><body>
  ${options.includeSummary && resume.summary ? `<div class="sec"><h2>Summary</h2><div>${esc(resume.summary!)}</div></div>` : ''}
  <div class="sec"><h2>Experience</h2><div class="divider"></div>
    ${resume.experience.map(e=>`
      <div class="entry">
        <div class="row"><div class="role">${esc(e.role)} — ${esc(e.company)}</div><div style="color:#666">${esc(e.dates)}</div></div>
        <ul>${e.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>
  ${options.includeSkills && resume.skills?.length ? `<div class="sec"><h2>Skills</h2><div class="chips">${(resume.skills||[]).map(s=>`<span>${esc(s)}</span>`).join('')}</div></div>`:''}
  ${resume.education?.length ? `<div class="sec"><h2>Education</h2><ul>${(resume.education||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
</body></html>`
}

function esc(s:string){ return (s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]) }
