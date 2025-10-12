"use client"

import { useState } from 'react'
import dynamic from 'next/dynamic'
import JDInput from '../components/JDInput'
import Preview from '../components/Preview'
import ParsingErrorBanner from '../components/ParsingErrorBanner'
import ExperienceInputModal from '../components/ExperienceInputModal'
import LineMarkingModal, { LineSelection } from '../components/LineMarkingModal'
import useInviteGate from '../components/useInviteGate'
import { ParsingValidationResult } from '../lib/parsing-validation'

const FileDrop = dynamic(() => import('../components/FileDrop'), { ssr: false })

export default function Home() {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState<string>('')
  const [tone, setTone] = useState<'professional'|'concise'|'impact-heavy'>('professional')
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<ParsingValidationResult | null>(null)
  const [showExperienceModal, setShowExperienceModal] = useState(false)
  const [showLineMarkingModal, setShowLineMarkingModal] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [resumeText, setResumeText] = useState<string>('')
  const gate = useInviteGate()
  const toneOptions = [
    {
      id: 'professional' as const,
      label: 'Professional',
      tagline: 'Balanced and ATS-friendly phrasing'
    },
    {
      id: 'concise' as const,
      label: 'Concise',
      tagline: 'Sharp bullets for fast reads'
    },
    {
      id: 'impact-heavy' as const,
      label: 'Impact Heavy',
      tagline: 'Quantified wins front-and-center'
    }
  ]

  // Helper function to get invite code from cookie
  function getInviteCode(): string {
    const inviteCode = document.cookie
      .split('; ')
      .find(row => row.startsWith('invite='))
      ?.split('=')[1]
    const decoded = inviteCode ? decodeURIComponent(inviteCode) : ''
    console.log('Cookie debug:', {
      allCookies: document.cookie,
      inviteCode,
      decoded
    })
    return decoded
  }

  // Helper function to extract text from resume file
  async function extractResumeText(file: File): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        const data = await response.json()
        return data.resumeText || ''
      }
    } catch (error) {
      console.error('Failed to extract resume text:', error)
    }
    
    // Fallback: try to read as text
    try {
      return await file.text()
    } catch (error) {
      console.error('Failed to read file as text:', error)
      return ''
    }
  }

  async function handleTailor() {
    if (!resumeFile) return alert('Upload a resume and paste a job description.')
    if (!jdText) return alert('Paste a job description.')
    setLoading(true)
    try {
      // Extract resume text for line marking feature
      const text = await extractResumeText(resumeFile)
      setResumeText(text)
      
      const fd = new FormData()
      fd.append('resume_file', resumeFile)
      fd.append('jd_text', jdText)
      fd.append('tone', tone)
      
      const inviteCode = getInviteCode()
      console.log('API call debug:', {
        inviteCode,
        formDataEntries: [...fd.entries()],
        headers: {
          'x-invite-code': inviteCode
        }
      })
      
      const res = await fetch('/api/tailor', { 
        method: 'POST', 
        body: fd,
        headers: {
          'x-invite-code': inviteCode
        }
      })
      const data = await res.json()
      
      if (!res.ok) {
        if (data.code === 'missing_experience') {
          // Handle missing experience case
          setValidation(data.validation)
          setShowBanner(true)
          setLoading(false)
          return
        }
        throw new Error(data?.message || 'Tailoring failed.')
      }
      
      setSession(data)
      setValidation(data.validation)
      setShowBanner(false) // Hide banner on success
    } catch (e:any) {
      alert(e?.message || 'Failed to tailor.')
    } finally {
      setLoading(false)
    }
  }

  function handleBannerAction(action: string) {
    switch (action) {
      case 'paste_experience':
        setShowExperienceModal(true)
        break
      case 'mark_experience':
        if (!resumeText) {
          alert('Resume text not available. Please try uploading the resume again.')
          return
        }
        setShowLineMarkingModal(true)
        break
      case 'upload_new':
        setResumeFile(null)
        setSession(null)
        setValidation(null)
        setShowBanner(false)
        break
      case 'continue':
        setShowBanner(false)
        break
      default:
        console.log('Unknown action:', action)
    }
  }

  async function handleExperienceSubmit(experience: string) {
    if (!jdText) {
      alert('Job description is required. Please paste a job description first.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/process-experience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-invite-code': getInviteCode()
        },
        body: JSON.stringify({
          experienceText: experience,
          jdText,
          tone,
          sessionId: session?.session_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to process experience')
      }

      // Update session with the processed results
      setSession(data)
      setValidation(null) // Clear validation since we've processed the experience
      setShowBanner(false) // Hide banner
      setShowExperienceModal(false)

      console.log('Experience processed successfully:', {
        extractedExperienceCount: data.extracted_experience_count
      })
    } catch (error: any) {
      console.error('Failed to process experience:', error)
      alert(error?.message || 'Failed to process experience')
    } finally {
      setLoading(false)
    }
  }

  async function handleLineMarkingSubmit(selectedLines: LineSelection[]) {
    if (!resumeText || !jdText) {
      alert('Missing resume text or job description. Please try again.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/process-line-selections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-invite-code': getInviteCode()
        },
        body: JSON.stringify({
          resumeText,
          selectedLines,
          jdText,
          tone,
          sessionId: session?.session_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to process line selections')
      }

      // Update session with the processed results
      setSession(data)
      setValidation(null) // Clear validation since we've processed the experience
      setShowBanner(false) // Hide banner
      setShowLineMarkingModal(false)

      console.log('Line selections processed successfully:', data.processing_summary)
    } catch (error: any) {
      console.error('Failed to process line selections:', error)
      alert(error?.message || 'Failed to process line selections')
    } finally {
      setLoading(false)
    }
  }

  if (!gate.ok) {
    return (
      <main className="space-y-8 pb-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
          <div className="pointer-events-none absolute -top-24 right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.35),_transparent_70%)] blur-3xl" />
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h1 className="mb-3 text-4xl font-semibold text-slate-900 dark:text-slate-100">Invite-only beta</h1>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
              Access is limited while we’re scaling our reviewers. Enter your invite code to unlock the tailoring workspace.
            </p>
            <div className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <input
                className="input text-center sm:text-left"
                placeholder="Enter invite code"
                value={gate.code}
                onChange={e => gate.setCode(e.target.value)}
              />
              <button className="button w-full sm:w-auto" onClick={gate.submit}>
                Continue
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">No invite? Join the waitlist at resume-tailor.ai</p>
          </div>
        </section>
      </main>
    )
  }

  const workflow = [
    { label: 'Upload resume', complete: Boolean(resumeFile) },
    { label: 'Paste job description', complete: Boolean(jdText) },
    { label: 'Tailor & review', complete: Boolean(session) }
  ]

  return (
    <main className="space-y-10 pb-16">
      {validation && showBanner && (
        <ParsingErrorBanner
          validation={validation}
          onAction={handleBannerAction}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
        <div className="pointer-events-none absolute -left-28 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.35),_transparent_65%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-120px] right-[-40px] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.25),_transparent_70%)] blur-3xl" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-700 dark:border-blue-400/40 dark:text-blue-200">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              ATS-safe rewriting • human-vetted prompts • no fabrication
            </div>
            <h1 className="text-4xl font-semibold text-slate-900 dark:text-slate-100">
              Tailor your resume to any role in under 60 seconds.
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Upload your existing resume, drop in the job description, and get a deeply aligned version—complete with keyword coverage, honesty checks, and exports that stay ATS-friendly.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12L10 17L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Honesty scan prevents inflated claims
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 8V12" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 16H12.01" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 20H3L12 4L21 20Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                ATS signal coverage & missing keyword map
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <svg className="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5H19V19H5V5Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 5V19" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 11H19" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Exports in DOCX or PDF, ready to send
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 shadow-lg">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Live stats</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Last 7 days</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="text-xs text-slate-500">Resumes tailored</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">4,218</div>
                  <div className="mt-1 text-xs text-emerald-500">+132 this week</div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="text-xs text-slate-500">Interview-ready</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">88%</div>
                  <div className="mt-1 text-xs text-emerald-500">Passes ATS filters</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/60 bg-indigo-50/70 p-4 text-xs text-slate-700 shadow-sm dark:border-indigo-400/20 dark:bg-indigo-950/50 dark:text-indigo-100">
                <strong className="mb-1 block text-sm text-indigo-600 dark:text-indigo-300">Trusted resumes only.</strong>
                We never invent roles or dates. If something’s missing, we ask you to add real experience—our honesty scan keeps every bullet defensible.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card p-8 shadow-xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tailoring workspace</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Upload, align, export.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {workflow.map((step, index) => (
                <div
                  key={step.label}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    step.complete
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-300'
                      : 'border-slate-200/60 bg-white/80 text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                    {step.complete ? '✓' : index + 1}
                  </span>
                  {step.label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <div className="label mb-3">Resume</div>
                <FileDrop onFile={setResumeFile} />
                {resumeFile && (
                  <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-100">Selected:</span> {resumeFile.name}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="label mb-3">Job description</div>
                <JDInput value={jdText} onChange={setJdText} />
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)]">
            <div>
              <div className="label mb-3">Tone</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {toneOptions.map(option => {
                  const isActive = tone === option.id
                  return (
                    <button
                      key={option.id}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isActive
                          ? 'border-blue-500/70 bg-blue-500/10 text-blue-600 shadow-md dark:border-blue-400/50 dark:bg-blue-500/20 dark:text-blue-200'
                          : 'border-slate-200/70 bg-white/80 hover:border-blue-400/50 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-blue-500/40'
                      }`}
                      onClick={() => setTone(option.id)}
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{option.label}</span>
                        {isActive && (
                          <span className="text-xs text-blue-500 dark:text-blue-200">Selected</span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                        {option.tagline}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-blue-400/30 bg-gradient-to-br from-blue-50/60 via-white/50 to-white/20 p-6 text-sm text-slate-700 shadow-inner dark:border-blue-500/30 dark:from-blue-900/40 dark:via-slate-900/40 dark:to-slate-950/40 dark:text-slate-200">
              <div className="mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-200">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 8V12" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 16H12.01" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 20H3L12 4L21 20Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Need more context?
              </div>
              Add missing experience manually or highlight it in your resume. The honesty scan will double-check every tailored bullet before you export.
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              DOCX, PDF, and TXT resumes supported. Photos or scans won’t parse—upload text-based files.
            </div>
            <button
              className="button w-full sm:w-auto"
              onClick={handleTailor}
              disabled={loading || !resumeFile || !jdText}
            >
              {loading ? 'Tailoring...' : 'Tailor my resume'}
            </button>
          </div>
        </div>

        <aside className="glass-panel rounded-3xl p-8 text-sm shadow-xl">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Why teams trust us</div>
            <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-slate-100">Human-aligned AI rewrites</h3>
          </div>
          <div className="space-y-6 text-slate-600 dark:text-slate-300">
            <div className="rounded-2xl border border-slate-200/60 bg-white/75 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Honesty guardrails</div>
              Every bullet links back to your original resume. If we cannot find support, we flag it for you first.
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/75 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-2 font-semibold text-slate-800 dark:text-slate-100">ATS-native formatting</div>
              We stick to recruiter-approved structure—no columns, no graphics—just clean, keyword-optimized sections.
            </div>
            <div className="rounded-2xl border border-blue-200/60 bg-blue-500/10 p-5 shadow-sm dark:border-blue-500/20 dark:bg-blue-950/30">
              <div className="mb-2 font-semibold text-blue-700 dark:text-blue-200">Privacy by default</div>
              Files never leave memory. Exports are generated on-demand and wiped instantly after download.
            </div>
          </div>
        </aside>
      </section>

      {session && <Preview session={session} />}

      {showExperienceModal && (
        <ExperienceInputModal
          isOpen={showExperienceModal}
          onClose={() => setShowExperienceModal(false)}
          onSubmit={handleExperienceSubmit}
        />
      )}

      {showLineMarkingModal && (
        <LineMarkingModal
          isOpen={showLineMarkingModal}
          onClose={() => setShowLineMarkingModal(false)}
          onSubmit={handleLineMarkingSubmit}
          resumeText={resumeText}
          originalResume={session?.original_sections_json}
        />
      )}
    </main>
  )
}
