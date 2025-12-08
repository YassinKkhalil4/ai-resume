"use client"

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSession, signOut } from 'next-auth/react'
import JDInput from '../components/JDInput'
import Preview from '../components/Preview'
import ParsingErrorBanner from '../components/ParsingErrorBanner'
import ExperienceInputModal from '../components/ExperienceInputModal'
import LineMarkingModal, { LineSelection } from '../components/LineMarkingModal'
import useInviteGate from '../components/useInviteGate'
import { ParsingValidationResult } from '../lib/parsing-validation'
import LoginModal from '../components/auth/LoginModal'
import SignupModal from '../components/auth/SignupModal'
import CreditDisplay from '../components/billing/CreditDisplay'

const FileDrop = dynamic(() => import('../components/FileDrop'), { ssr: false })

export default function Home() {
  const { data: session, status } = useSession()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState<string>('')
  const [tone, setTone] = useState<'professional'|'concise'|'impact-heavy'>('professional')
  const [tailorSession, setTailorSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<ParsingValidationResult | null>(null)
  const [showExperienceModal, setShowExperienceModal] = useState(false)
  const [showLineMarkingModal, setShowLineMarkingModal] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [resumeText, setResumeText] = useState<string>('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const gate = useInviteGate()
  const toneOptions = useMemo(() => [
    {
      id: 'professional' as const,
      label: 'Professional',
      tagline: 'Balanced and ATS-friendly phrasing',
      example: 'Partnered with product and engineering leads to deliver roadmap initiatives on time while maintaining audit-ready documentation.'
    },
    {
      id: 'concise' as const,
      label: 'Concise',
      tagline: 'Sharp bullets for fast reads',
      example: 'Delivered roadmap features on time, aligning PM + Eng stakeholders while keeping documentation audit-ready.'
    },
    {
      id: 'impact-heavy' as const,
      label: 'Impact Heavy',
      tagline: 'Quantified wins front-and-center',
      example: 'Accelerated roadmap velocity 32% by orchestrating PM/Engineering alignment and shipping milestone releases ahead of schedule.'
    }
  ], [])
  const highlightPhrases = [
    'busy product leads',
    'staff-level ICs',
    'growing teams',
    'career switchers',
    'new grads who need traction'
  ]
  const featureCards = [
    {
      title: 'Guided accuracy checks',
      summary: 'Mark the lines that prove your achievements—no guessing.',
      detail: 'Select resume lines, group related bullets, and we transform them into structured evidence. The honesty scan links each rewritten bullet back to these anchors.',
      icon: (
        <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 12L10 17L20 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: 'Keyword radar',
      summary: 'Spot hard requirements before you tailor.',
      detail: 'Our ATS coverage map highlights missing phrases, then suggests rewrites that weave them in naturally without overstuffing.',
      icon: (
        <svg className="h-4 w-4 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5C8.13401 5 5 8.13401 5 12" stroke="currentColor" strokeLinecap="round" />
          <path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12" stroke="currentColor" strokeLinecap="round" />
          <path d="M12 13.5C12.8284 13.5 13.5 12.8284 13.5 12C13.5 11.1716 12.8284 10.5 12 10.5C11.1716 10.5 10.5 11.1716 10.5 12C10.5 12.8284 11.1716 13.5 12 13.5Z" stroke="currentColor" />
          <path d="M4 12H2" stroke="currentColor" strokeLinecap="round" />
        </svg>
      )
    },
    {
      title: 'Export-ready previews',
      summary: 'See recruiter view, diff view, and ATS score together.',
      detail: 'Flip between templates, compare line-by-line diffs, and run honesty + ATS checks before you ever download the file.',
      icon: (
        <svg className="h-4 w-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 5H19V19H5V5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 5V19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 11H19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ]
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [activeFeature, setActiveFeature] = useState(0)
  const [tonePreview, setTonePreview] = useState(toneOptions[0])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHighlightIndex(prev => (prev + 1) % highlightPhrases.length)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [highlightPhrases.length])

  // Fetch credits when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchCredits()
    }
  }, [status, session])

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/billing/credits')
      if (response.ok) {
        const data = await response.json()
        setCredits(data.creditsRemaining)
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    }
  }

  useEffect(() => {
    const selected = toneOptions.find(option => option.id === tone)
    if (selected) {
      setTonePreview(prev => (prev.id === selected.id ? prev : selected))
    }
  }, [tone, toneOptions])

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
    
    // Check authentication
    if (status !== 'authenticated') {
      setShowLoginModal(true)
      return
    }

    // Check credits
    if (credits !== null && credits <= 0) {
      alert('You have no credits remaining. Please purchase credits to continue.')
      return
    }

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
      
      // Check content-type before parsing JSON
      const contentType = res.headers.get('content-type') || ''
      let data
      
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        // If not JSON, get the text response
        const text = await res.text()
        console.error('Non-JSON response received:', text)
        throw new Error(`Server returned non-JSON response: ${text.slice(0, 200)}`)
      }
      
      if (!res.ok) {
        if (data.code === 'unauthorized') {
          setShowLoginModal(true)
          setLoading(false)
          return
        }
        if (data.code === 'no_credits') {
          alert('You have no credits remaining. Please purchase credits to continue.')
          setCredits(0)
          setLoading(false)
          return
        }
        if (data.code === 'missing_experience') {
          // Handle missing experience case
          setValidation(data.validation)
          setShowBanner(true)
          setLoading(false)
          return
        }
        throw new Error(data?.message || 'Tailoring failed.')
      }
      
      setTailorSession(data)
      setValidation(data.validation)
      setShowBanner(false) // Hide banner on success
      
      // Update credits if returned
      if (data.credits_remaining !== undefined) {
        setCredits(data.credits_remaining)
      } else {
        // Refresh credits
        await fetchCredits()
      }
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
        setTailorSession(null)
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
          sessionId: tailorSession?.session_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to process experience')
      }

      // Update session with the processed results
      setTailorSession(data)
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
          sessionId: tailorSession?.session_id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to process line selections')
      }

      // Update session with the processed results
      setTailorSession(data)
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
            <p className="mt-4 text-xs text-slate-500">No invite? Join the waitlist at tailora.ai</p>
          </div>
        </section>
      </main>
    )
  }

  const activeFeatureCard = featureCards[activeFeature] || featureCards[0]
  const highlightPhrase = highlightPhrases[highlightIndex]

  const workflow = [
    { label: 'Upload resume', complete: Boolean(resumeFile) },
    { label: 'Paste job description', complete: Boolean(jdText) },
    { label: 'Tailor & review', complete: Boolean(tailorSession) }
  ]
  const activeStepIndex = workflow.findIndex(step => !step.complete)
  const highlightedStepIndex = activeStepIndex === -1 ? workflow.length - 1 : activeStepIndex

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
        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-700 dark:border-blue-400/40 dark:text-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            ATS-safe rewriting • human-vetted prompts • no fabrication
          </div>
          <div className="space-y-5">
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 dark:text-slate-100 md:text-5xl">
              Tailor your resume to any role in under 60 seconds.
            </h1>
            <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Upload your existing resume, drop in the job description, and get a deeply aligned version—complete with keyword coverage, honesty checks, and exports that stay ATS-friendly.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              <span>Designed for</span>
              <span key={highlightIndex} className="animate-fade-slide rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200">
                {highlightPhrase}
              </span>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-3">
            {featureCards.map((feature, index) => {
              const isActive = index === activeFeature
              return (
                <button
                  key={feature.title}
                  type="button"
                  onMouseEnter={() => setActiveFeature(index)}
                  onFocus={() => setActiveFeature(index)}
                  className={`flex h-full flex-col gap-2 rounded-2xl border px-4 py-3 text-left shadow-sm transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 dark:focus-visible:ring-blue-500/40 ${
                    isActive
                      ? 'border-blue-400/50 bg-blue-500/10 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-100'
                      : 'border-slate-200/60 bg-white/70 hover:-translate-y-1 hover:border-blue-300/50 hover:bg-blue-500/10 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-blue-400/40'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    {feature.icon}
                    {feature.title}
                  </span>
                  <span className="leading-relaxed text-sm">{feature.summary}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">Hover to explore</span>
                </button>
              )
            })}
          </div>
          <div className="glass-panel rounded-3xl border border-blue-400/20 p-6 shadow-lg">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-200">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-100">
                  {activeFeature + 1}
                </span>
                {activeFeatureCard.title}
              </div>
              <div className="text-xs text-blue-500 dark:text-blue-200">More detail on hover</div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {activeFeatureCard.detail}
            </p>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-8 xl:grid-cols-[minmax(0,4fr)_minmax(0,1.6fr)]">
        <div className="card p-10 shadow-2xl lg:p-12">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Tailoring workspace</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Upload, align, export.</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status === 'authenticated' ? (
                <>
                  <CreditDisplay />
                  <button
                    onClick={() => signOut()}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setShowSignupModal(true)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {workflow.map((step, index) => (
                <div
                  key={step.label}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    step.complete
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/30 dark:text-emerald-300'
                      : index === highlightedStepIndex
                        ? 'border-blue-400/40 bg-blue-500/10 text-blue-600 shadow-sm shadow-blue-500/30 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-100'
                        : 'border-slate-200/60 bg-white/80 text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400'
                  }`}
                  aria-current={index === highlightedStepIndex && !step.complete ? 'step' : undefined}
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
                  <div className="mt-3 break-words rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
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
                      onMouseEnter={() => setTonePreview(prev => (prev.id === option.id ? prev : option))}
                      onFocus={() => setTonePreview(prev => (prev.id === option.id ? prev : option))}
                      onMouseLeave={() => {
                        const selected = toneOptions.find(t => t.id === tone)
                        if (selected) {
                          setTonePreview(prev => (prev.id === selected.id ? prev : selected))
                        }
                      }}
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
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-blue-500 dark:text-blue-200">
                <span>Tone preview</span>
                <span className="rounded-full border border-blue-400/40 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold dark:border-blue-400/30 dark:bg-blue-500/20">
                  Live sample
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-blue-700 dark:text-blue-100">
                {tonePreview.label} tone
              </div>
              <p className="mt-2 rounded-2xl border border-blue-200/60 bg-white/70 p-4 text-sm leading-relaxed text-slate-600 dark:border-blue-400/20 dark:bg-slate-900/50 dark:text-slate-200">
                “{tonePreview.example}”
              </p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Hover a tone to preview it instantly, then click to lock it in for export.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              DOCX, PDF, and TXT resumes supported. Photos or scans won’t parse—upload text-based files.
            </div>
            <button
              className="button w-full sm:w-auto"
              onClick={handleTailor}
              disabled={loading || !resumeFile || !jdText || (credits !== null && credits <= 0)}
            >
              {loading ? 'Tailoring...' : credits !== null && credits <= 0 ? 'No Credits' : 'Tailor my resume'}
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

      {tailorSession && <Preview session={tailorSession} />}

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSwitchToSignup={() => {
            setShowLoginModal(false)
            setShowSignupModal(true)
          }}
        />
      )}

      {showSignupModal && (
        <SignupModal
          isOpen={showSignupModal}
          onClose={() => setShowSignupModal(false)}
          onSwitchToLogin={() => {
            setShowSignupModal(false)
            setShowLoginModal(true)
          }}
        />
      )}

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
          originalResume={tailorSession?.original_sections_json}
        />
      )}
    </main>
  )
}
