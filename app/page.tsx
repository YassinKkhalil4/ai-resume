"use client"

import { useRef, useState } from 'react'
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
      const res = await fetch('/api/tailor', { method: 'POST', body: fd })
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
    // TODO: Implement experience processing
    console.log('Experience submitted:', experience)
    setShowExperienceModal(false)
    // For now, just hide the modal
    // In a real implementation, this would process the experience and retry tailoring
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
      {validation && showBanner && (
        <ParsingErrorBanner 
          validation={validation}
          onAction={handleBannerAction}
          onDismiss={() => setShowBanner(false)}
          resumeText={resumeText}
        />
      )}
      
      <section className="card p-6">
        <h1 className="mb-1">AI Resume Tailor</h1>
        <p className="text-gray-600 mb-4">Upload your resume and paste a job description to get a tailored version.</p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="label mb-2">Resume</div>
            <FileDrop onFile={setResumeFile} />
            {resumeFile && (
              <div className="mt-2 text-sm text-gray-600">
                Selected: {resumeFile.name}
              </div>
            )}
          </div>
          
          <div>
            <div className="label mb-2">Job Description</div>
            <JDInput value={jdText} onChange={setJdText} />
          </div>
        </div>
        
        <div className="mt-4">
          <div className="label mb-2">Tone</div>
          <div className="flex gap-2">
            <button 
              className={`button-outline ${tone === 'professional' ? 'border-black' : ''}`}
              onClick={() => setTone('professional')}
            >
              Professional
            </button>
            <button 
              className={`button-outline ${tone === 'concise' ? 'border-black' : ''}`}
              onClick={() => setTone('concise')}
            >
              Concise
            </button>
            <button 
              className={`button-outline ${tone === 'impact-heavy' ? 'border-black' : ''}`}
              onClick={() => setTone('impact-heavy')}
            >
              Impact Heavy
            </button>
          </div>
        </div>
        
        <div className="mt-6">
          <button 
            className="button" 
            onClick={handleTailor}
            disabled={loading || !resumeFile || !jdText}
          >
            {loading ? 'Tailoring...' : 'Tailor Resume'}
          </button>
        </div>
      </section>

      {session && (
        <Preview session={session} />
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
          originalResume={session?.original_sections_json}
        />
      )}
    </main>
  )
}
