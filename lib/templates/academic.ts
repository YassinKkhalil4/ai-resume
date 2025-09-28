import { ResumeJSON } from '../types'

export function academicTemplate(resume: ResumeJSON, options:{ includeSkills:boolean, includeSummary:boolean }) {
  const css = `
  body{font-family: Arial, Helvetica, sans-serif; color:#111; font-size:11.5pt; line-height:1.4}
  .wrap{max-width:820px; margin:0 auto}
  h1{font-size:18pt; margin:0 0 6px; font-weight:700}
  h2{font-size:12.5pt; margin:12px 0 6px}
  .sec{margin: 6px 0 10px}
  ul{margin:4px 0 0 16px; padding:0}
  li{margin:2px 0}
  .meta{color:#666}
  `
  const contact = (resume as any).contact || {}
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body><div class="wrap">
    <h1>${esc(contact.name||'')}</h1>
    ${options.includeSummary && resume.summary ? `<div class="sec"><h2>Research Summary</h2><div>${esc(resume.summary!)}</div></div>` : ''}
    ${renderSection('Projects', resume.projects?.map(p=>`${esc(p.name)} — ${p.bullets.map(b=>esc(b)).join('; ')}`)||[])}
    ${renderSection('Publications', (resume as any).publications||[])}
    ${renderSection('Teaching', (resume as any).teaching||[])}
    ${renderSection('Experience', (resume.experience||[]).map(e=>`${esc(e.role)} — ${esc(e.company)} <span class=meta>(${esc(e.dates)})</span>`))}
    ${options.includeSkills && resume.skills?.length ? `<div class="sec"><h2>Skills</h2><div>${(resume.skills||[]).join(' • ')}</div></div>`:''}
    ${resume.education?.length ? `<div class="sec"><h2>Education</h2><ul>${(resume.education||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
  </div></body></html>`
}

function renderSection(title:string, items:string[]) {
  if (!items || !items.length) return ''
  return `<div class="sec"><h2>${title}</h2><ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`
}

function esc(s:string){ return (s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]) }


