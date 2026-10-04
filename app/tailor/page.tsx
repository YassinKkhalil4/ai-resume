"use client"

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useSession, signOut } from 'next-auth/react'
import JDInput from '../../components/JDInput'
import Preview from '../../components/Preview'
import ParsingErrorBanner from '../../components/ParsingErrorBanner'
import ExperienceInputModal from '../../components/ExperienceInputModal'
import LineMarkingModal, { LineSelection } from '../../components/LineMarkingModal'
import { ParsingValidationResult } from '../../lib/parsing-validation'
import LoginModal from '../../components/auth/LoginModal'
import SignupModal from '../../components/auth/SignupModal'
import CreditDisplay from '../../components/billing/CreditDisplay'
import BuyCreditsModal from '../../components/billing/BuyCreditsModal'
import { useTracking } from '../../lib/analytics/useTracking'

const capabilities = [
  {
    title: 'Guided accuracy checks',
    detail: 'Select resume lines and group related bullets. The honesty scan links each rewritten bullet back to the lines you marked.',
  },
  {
    title: 'Keyword radar',
    detail: 'The ATS coverage map shows which phrases from the posting are missing, then suggests rewrites that work them in naturally.',
  },
  {
    title: 'Export-ready previews',
    detail: 'Flip between templates, compare line-by-line diffs, and run honesty and ATS checks before you download anything.',
  },
]

const guarantees = [
  {
    title: 'Honesty guardrails',
    detail: 'Every bullet links back to your original resume. If we cannot find support for it, we flag it for you first.',
  },
  {
    title: 'ATS-native formatting',
    detail: 'Recruiter-approved structure: no columns, no graphics, just clean, keyword-optimized sections.',
  },
  {
    title: 'Privacy by default',
    detail: 'Files stay in memory. Exports are generated on demand and wiped right after download.',
  },
]

const FileDrop = dynamic(() => import('../../components/FileDrop'), { ssr: false })

export default function TailorPage() {
  const { data: session, status } = useSession()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState<string>('')
  const [tone, setTone] = useState<'professional'|'concise'|'impact-heavy'>('professional')
  const [strictHonestyMode, setStrictHonestyMode] = useState(true)
  const [tailorSession, setTailorSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [validation, setValidation] = useState<ParsingValidationResult | null>(null)
  const [showExperienceModal, setShowExperienceModal] = useState(false)
  const [showLineMarkingModal, setShowLineMarkingModal] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [resumeText, setResumeText] = useState<string>('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const { track } = useTracking()
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
  const tonePreview = toneOptions.find(option => option.id === tone) ?? toneOptions[0]

  // Fetch credits when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchCredits()
    }
  }, [status, session])

  // Track job description added
  useEffect(() => {
    if (jdText && jdText.trim().length > 50) {
      track('job_description_added', { length: jdText.length })
    }
  }, [jdText, track])

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
    
    // Track tailor clicked
    track('tailor_clicked', { hasResume: !!resumeFile, hasJd: !!jdText, tone })
    
    // Check authentication
    if (status !== 'authenticated') {
      setShowLoginModal(true)
      return
    }

    // Check credits
    if (!session?.user?.isAdmin && credits !== null && credits <= 0) {
      track('credits_exhausted', {})
      setShowBuyModal(true)
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
      fd.append('strict_honesty_mode', strictHonestyMode ? 'true' : 'false')
      
      const res = await fetch('/api/tailor', { 
        method: 'POST', 
        body: fd,
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
        // Track tailor failed
        track('tailor_failed', { error: data.code, message: data.message })
        
        if (data.code === 'unauthorized') {
          setShowLoginModal(true)
          setLoading(false)
          return
        }
        if (data.code === 'no_credits') {
          track('credits_exhausted', {})
          setCredits(0)
          setShowBuyModal(true)
          setLoading(false)
          return
        }
        if (
          data.code === 'missing_experience' ||
          data.code === 'no_bullets' ||
          data.code === 'validation_error' ||
          data.code === 'heuristic_experience'
        ) {
          // Treat all experience-related 422 responses the same: show the parsing banner
          setValidation(data.validation)
          setShowBanner(true)
          setLoading(false)
          return
        }
        throw new Error(data?.message || 'Tailoring failed.')
      }
      
      // Track tailor completed
      track('tailor_completed', {
        sessionId: data.session_id,
        hasValidation: !!data.validation,
        tokensUsed: data.tokens_used,
      })
      
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
      
      // Scroll to tailored CV section after a brief delay to ensure DOM update
      setTimeout(() => {
        const tailoredSection = document.getElementById('tailored-cv-section')
        if (tailoredSection) {
          tailoredSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
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
      
      // Scroll to tailored CV section after a brief delay to ensure DOM update
      setTimeout(() => {
        const tailoredSection = document.getElementById('tailored-cv-section')
        if (tailoredSection) {
          tailoredSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
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
      
      // Scroll to tailored CV section after a brief delay to ensure DOM update
      setTimeout(() => {
        const tailoredSection = document.getElementById('tailored-cv-section')
        if (tailoredSection) {
          tailoredSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (error: any) {
      console.error('Failed to process line selections:', error)
      alert(error?.message || 'Failed to process line selections')
    } finally {
      setLoading(false)
    }
  }

  const workflow = [
    { label: 'Upload resume', complete: Boolean(resumeFile) },
    { label: 'Paste job description', complete: Boolean(jdText) },
    { label: 'Tailor & review', complete: Boolean(tailorSession) }
  ]
  const activeStepIndex = workflow.findIndex(step => !step.complete)
  const highlightedStepIndex = activeStepIndex === -1 ? workflow.length - 1 : activeStepIndex

  return (
    <main className="space-y-20 md:space-y-28">
      {validation && showBanner && (
        <ParsingErrorBanner
          validation={validation}
          onAction={handleBannerAction}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <section aria-labelledby="tailor-heading" className="space-y-10">
        <div className="max-w-4xl">
          <h1
            id="tailor-heading"
            className="text-4xl font-semibold leading-[1.05] tracking-tighter text-slate-900 dark:text-slate-50 sm:text-5xl lg:text-6xl"
          >
            Tailor your resume to any role in under 60 seconds.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
            Upload your resume, paste the job description, and get a version aligned to the role. Nothing invented.
          </p>
        </div>

        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
          <div className="card p-6 sm:p-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <ol className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Progress">
                {workflow.map((step, index) => {
                  const isCurrent = index === highlightedStepIndex && !step.complete
                  return (
                    <li
                      key={step.label}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                        step.complete
                          ? 'text-slate-900 dark:text-slate-50'
                          : isCurrent
                            ? 'text-slate-900 dark:text-slate-50'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                          step.complete
                            ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-400 dark:text-slate-950'
                            : isCurrent
                              ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                              : 'border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {step.complete ? '✓' : index + 1}
                      </span>
                      {step.label}
                    </li>
                  )
                })}
              </ol>
              {status === 'authenticated' && (
                <div className="flex items-center gap-3">
                  <CreditDisplay />
                  <button onClick={() => signOut()} className="button-outline button-sm">
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-8">
              <div>
                <div className="label mb-2">Resume</div>
                <FileDrop onFile={(file) => {
                  setResumeFile(file)
                  if (file) {
                    track('resume_uploaded', { fileName: file.name, fileSize: file.size, fileType: file.type })
                  }
                }} />
                {resumeFile && (
                  <p className="mt-3 break-words text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-900 dark:text-slate-100">Selected:</span> {resumeFile.name}
                  </p>
                )}
              </div>

              <div>
                <div className="label mb-2">Job description</div>
                <JDInput value={jdText} onChange={setJdText} />
              </div>

              <div>
                <div className="label mb-2" id="tone-label">Tone</div>
                <div role="radiogroup" aria-labelledby="tone-label" className="grid gap-2 sm:grid-cols-3">
                  {toneOptions.map(option => {
                    const isActive = tone === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setTone(option.id)}
                        className={`rounded-xl border p-3.5 text-left transition-colors duration-150 ${
                          isActive
                            ? 'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${isActive ? 'text-blue-800 dark:text-blue-200' : 'text-slate-900 dark:text-slate-100'}`}>
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {option.tagline}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-900 dark:text-slate-300" aria-live="polite">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sample of the {tonePreview.label.toLowerCase()} tone</span>
                  &ldquo;{tonePreview.example}&rdquo;
                </p>
              </div>

              <div className="flex items-start gap-3">
                <input
                  id="strict-honesty-mode"
                  type="checkbox"
                  checked={strictHonestyMode}
                  onChange={(e) => setStrictHonestyMode(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                />
                <label htmlFor="strict-honesty-mode" className="cursor-pointer text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-slate-100">Strict honesty mode</span> (on by default). No bullet creation, minimal rewrites, maximum similarity to your original.
                </label>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                DOCX, PDF, and TXT resumes supported. Scans and photos won&apos;t parse, so upload text-based files.
              </p>
              <button
                className="button w-full sm:w-auto"
                onClick={() => {
                  if (!session?.user?.isAdmin && credits !== null && credits <= 0) {
                    setShowBuyModal(true)
                    return
                  }
                  handleTailor()
                }}
                disabled={
                  loading ||
                  !resumeFile ||
                  !jdText
                }
              >
                {loading
                  ? 'Tailoring...'
                  : !session?.user?.isAdmin && credits !== null && credits <= 0
                    ? 'Buy Credits to Continue'
                    : 'Tailor my resume'}
              </button>
            </div>
            {!session?.user?.isAdmin && credits !== null && credits <= 0 && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Buy credits to continue tailoring resumes.
              </p>
            )}
          </div>

          <aside aria-labelledby="trust-heading" className="xl:sticky xl:top-24">
            <h2 id="trust-heading" className="text-lg font-semibold tracking-tight">Why it stays honest</h2>
            <dl className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {guarantees.map(item => (
                <div key={item.title} className="py-4 first:pt-0">
                  <dt className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      {tailorSession && (
        <div id="tailored-cv-section">
          <Preview session={tailorSession} />
        </div>
      )}

      <section aria-labelledby="capabilities-heading" className="grid gap-10 border-t border-slate-200 pt-14 dark:border-slate-800 lg:grid-cols-12 lg:gap-14">
        <h2 id="capabilities-heading" className="text-3xl font-semibold tracking-tighter sm:text-4xl lg:col-span-5">
          Check every line before it goes out.
        </h2>
        <ul className="space-y-10 lg:col-span-7">
          {capabilities.map((item, index) => (
            <li key={item.title} className={index === 0 ? '' : 'lg:ml-12'}>
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 max-w-xl leading-relaxed text-slate-600 dark:text-slate-400">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

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

      {showBuyModal && (
        <BuyCreditsModal
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
          onSuccess={fetchCredits}
        />
      )}
    </main>
  )
}
