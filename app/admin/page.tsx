'use client'
import { useEffect, useState } from 'react'

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [key, setKey] = useState('')
  const [cfg, setCfg] = useState<any>(null)

  async function login() {
    const res = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key }) })
    if (res.ok) { setAuthed(true); load() } else alert('Invalid key')
  }
  async function load() {
    const res = await fetch('/api/admin/config')
    if (res.ok) setCfg(await res.json())
  }
  async function save() {
    const res = await fetch('/api/admin/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(cfg) })
    if (res.ok) alert('Saved')
  }

  if (!authed) return (
    <div className="card p-6">
      <div className="font-semibold mb-2">Admin</div>
      <div className="flex items-center gap-2">
        <input className="input" placeholder="Admin key" value={key} onChange={e=>setKey(e.target.value)} />
        <button className="button" onClick={login}>Login</button>
      </div>
    </div>
  )

  return (
    <div className="card p-6 grid gap-4">
      <div className="font-semibold">Config</div>
      {cfg && (<>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">IP rate/min</div>
            <input className="input" type="number" value={cfg.rate.ipPerMin} onChange={e=>setCfg({...cfg, rate:{...cfg.rate, ipPerMin: Number(e.target.value)}})} />
          </div>
          <div>
            <div className="label">Session rate/min</div>
            <input className="input" type="number" value={cfg.rate.sessionPerMin} onChange={e=>setCfg({...cfg, rate:{...cfg.rate, sessionPerMin: Number(e.target.value)}})} />
          </div>
        </div>
        <div>
          <div className="label">Invite codes (comma-separated)</div>
          <input className="input" value={(cfg.invites||[]).join(',')} onChange={e=>setCfg({...cfg, invites: e.target.value.split(',').map((s:string)=>s.trim()).filter(Boolean)})} />
        </div>
        <div>
          <div className="label">Override OpenAI API key (stores in /tmp)</div>
          <input className="input" placeholder="sk-..." value={cfg.openaiKey||''} onChange={e=>setCfg({...cfg, openaiKey: e.target.value})} />
        </div>
        <div className="flex gap-2">
          <button className="button" onClick={save}>Save</button>
          <button className="button-outline" onClick={load}>Reload</button>
        </div>
      </>)}
    </div>
  )
}
