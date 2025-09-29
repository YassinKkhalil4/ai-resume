import { ResumeJSON } from '../types'

export function executiveTemplate(resume: ResumeJSON, options:{ includeSkills:boolean, includeSummary:boolean }) {
  const css = `
  body{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#0b0b0b; font-size:11.5pt; line-height:1.38;}
  .wrap{max-width:820px; margin:0 auto;}
  .hdr{display:grid; grid-template-columns: 2fr 1fr; gap:16px; align-items:flex-end; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px}
  .name{font-size:20pt; font-weight:700; letter-spacing:.2px}
  .contact{font-size:10pt; color:#444; text-align:right}
  h2{font-size:12.8pt; margin:14px 0 6px; letter-spacing:.2px}
  .sec{margin: 6px 0 10px}
  .role{font-weight:600}
  ul{margin:4px 0 0 16px; padding:0}
  li{margin:2px 0}
  .meta{color:#666; font-weight:400}
  `
  const name = (resume as any).contact?.name || ''
  const contactRight = contactLines((resume as any).contact)

  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body><div class="wrap">
  <div class="hdr">
    <div class="name">${esc(name)}</div>
    <div class="contact">${contactRight.join(' · ')}</div>
  </div>
  ${options.includeSummary && resume.summary ? `<div class="sec"><h2>Executive Summary</h2><div>${esc(resume.summary!)}</div></div>` : ''}
  <div class="sec"><h2>Experience</h2>
    ${resume.experience.map(e=>`
      <div class="entry">
        <div class="role">${esc(e.role)} — ${esc(e.company)} <span class="meta">(${esc(e.dates)})</span></div>
        <ul>${e.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>
  ${options.includeSkills && resume.skills?.length ? `<div class="sec"><h2>Core Skills</h2><div>${(resume.skills||[]).join(' • ')}</div></div>`:''}
  ${resume.education?.length ? `<div class="sec"><h2>Education</h2><ul>${(resume.education||[]).map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
  </div></body></html>`
}

function contactLines(contact: Record<string,string>|undefined): string[] {
  if (!contact) return []
  const parts = [contact.email, contact.phone, contact.location, contact.website].filter(Boolean)
  return parts as string[]
}

function esc(s:string){ return (s||'').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[c]) }


