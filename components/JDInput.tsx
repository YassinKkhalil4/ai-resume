'use client'

import { useState } from 'react'

export default function JDInput({ value, onChange }:{ value:string, onChange:(v:string)=>void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  async function fetchUrl() {
    if (!url) return
    setLoading(true)
    try {
      const res = await fetch('/api/tailor', {
        method: 'POST',
        body: (() => {
          const fd = new FormData()
          fd.append('jd_url', url)
          fd.append('mode', 'fetchOnly')
          return fd
        })()
      })
      const data = await res.json()
      if (res.ok && data?.jd_text) onChange(data.jd_text)
      else alert((data?.error) || 'Could not fetch that URL. Paste text instead.')
    } catch (e:any) {
      alert(e?.message || 'Failed to fetch URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <textarea
        className="input h-40"
        placeholder="Paste the job description here…"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <input className="input" placeholder="…or paste a job URL" value={url} onChange={e=>setUrl(e.target.value)} />
        <button className="button-outline" onClick={fetchUrl} disabled={loading}>{loading?'Fetching…':'Fetch URL'}</button>
      </div>
    </div>
  )
}
