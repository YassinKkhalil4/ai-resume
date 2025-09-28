'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import JDInput from '../components/JDInput'
import Preview from '../components/Preview'
import useInviteGate from '../components/useInviteGate'

const FileDrop = dynamic(() => import('../components/FileDrop'), { ssr: false })
const OCRBanner = dynamic(() => import('../components/OCRBanner'), { ssr: false })

export default function Home() {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState<string>('')
  const [tone, setTone] = useState<'professional'|'concise'|'impact-heavy'>('professional')
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const gate = useInviteGate()
  const [ocrText, setOcrText] = useState<string>('')

  async function handleTailor() {
    if (!resumeFile && !ocrText) return alert('Upload a resume or run OCR, and paste a job description.')
    if (!jdText) return alert('Paste a job description.')
    setLoading(true)
    try {
      const fd = new FormData()
      if (resumeFile) fd.append('resume_file', resumeFile)
      if (!resumeFile && ocrText) fd.append('resume_text', ocrText)
      fd.append('jd_text', jdText)
      fd.append('tone', tone)
      const res = await fetch('/api/tailor', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Tailoring failed.')
      setSession(data)
    } catch (e:any) {
      alert(e?.message || 'Failed to tailor.')
    } finally {
      setLoading(false)
    }
  }

  if (!gate.ok) return (
    <main className="grid gap-6">
      <section className="card p-6">
        <h1 className="mb-1">Enter Invite Code</h1>
        <p className="text-gray-600 mb-4">Access is limited during beta. Enter your invite code to continue.</p>
        <div className="flex items-center gap-2">
          <input className="input" placeholder="Invite code" value={gate.code} onChange={e=>gate.setCode(e.target.value)} />
          <button className="button" onClick={gate.submit}>Continue</button>
        </div>
      </section>
    </main>
  )

  return (
    <main className="grid gap-6">
      <section className="card p-6">
        <h1 className="mb-1">Tailor your resume to any job</h1>
        <p className="text-gray-600 mb-4">Upload resume → paste job → click Tailor. Bullets rewritten with integrity guardrails. Export ATS-safe PDF/DOCX.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="label">1) Upload Resume (PDF, DOCX, or TXT)</label>
            <FileDrop onFile={setResumeFile} />
            <OCRBanner onText={setOcrText} />
          </div>
          <div>
            <label className="label">2) Paste Job Listing (URL or plain text)</label>
            <JDInput value={jdText} onChange={setJdText} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="label">Tone</label>
          <select className="input w-auto" value={tone} onChange={e => setTone(e.target.value as any)}>
            <option value="professional">Professional</option>
            <option value="concise">Concise</option>
            <option value="impact-heavy">Impact-heavy</option>
          </select>
          <button className="button ml-auto" onClick={handleTailor} disabled={loading}>
            {loading ? 'Tailoring…' : 'Tailor'}
          </button>
        </div>
      </section>

      {session && (
        <Preview session={session} />
      )}
    </main>
  )
}
