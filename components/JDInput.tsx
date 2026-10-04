'use client'

import { Check, CheckCircle, CircleNotch, Warning, WarningCircle, X } from '@phosphor-icons/react'
import { useState } from 'react'

type ValidationInfo = {
  valid: boolean
  score: number
  issues: string[]
}

export default function JDInput({ value, onChange }:{ value:string, onChange:(v:string)=>void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'fetching' | 'extracting' | 'validating' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationInfo | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [originalLength, setOriginalLength] = useState(0)
  const charCount = value.trim().length

  // Validate URL format on input
  function isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString)
      return /^https?:$/.test(url.protocol)
    } catch {
      return false
    }
  }

  async function fetchUrl() {
    if (!url) return
    
    // Validate URL format
    if (!isValidUrl(url)) {
      setError('Please enter a valid URL starting with http:// or https://')
      setStatus('error')
      return
    }

    setLoading(true)
    setError(null)
    setValidation(null)
    setTruncated(false)
    setStatus('fetching')

    try {
      setStatus('extracting')
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

      if (!res.ok) {
        // Handle different error codes with better messages
        let errorMessage = 'Could not fetch that URL. Please paste the job description manually.'
        
        if (data.code === 'rate_limit') {
          errorMessage = 'Too many requests. Please wait a moment before trying again.'
        } else if (data.code === 'timeout') {
          errorMessage = 'Request timed out. The page may be slow or unavailable. Please try again or paste manually.'
        } else if (data.code === 'invalid_url') {
          errorMessage = data.message || 'Invalid or unsafe URL. Please check the link and try again.'
        } else if (data.code === 'no_content') {
          errorMessage = 'Could not find job description content on this page. The page may not contain a job listing.'
        } else if (data.code === 'http_error') {
          errorMessage = `Unable to access the page (${data.message}). The link may be broken or require authentication.`
        } else if (data.message) {
          errorMessage = data.message
        }

        setError(errorMessage)
        setStatus('error')
        return
      }

      if (data?.jd_text) {
        setStatus('validating')
        
        // Show validation info if available
        if (data.validation) {
          setValidation(data.validation)
        }
        
        if (data.truncated) {
          setTruncated(true)
          setOriginalLength(data.originalLength || 0)
        }

        // Show warning if validation score is low
        if (data.validation && data.validation.score < 60) {
          const warning = `Warning: Low extraction quality (score: ${data.validation.score}/100). ${data.validation.issues.join(' ')}`
          console.warn(warning)
          // Still populate but show warning
        }

        setStatus('success')
        onChange(data.jd_text)
        
        // Clear URL after successful fetch
        setTimeout(() => {
          setUrl('')
          setStatus('idle')
        }, 1000)
      } else {
        setError('No content extracted from the URL. Please paste the job description manually.')
        setStatus('error')
      }
    } catch (e: any) {
      const errorMessage = e?.message || 'Failed to fetch URL. Please check your connection and try again.'
      setError(errorMessage)
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  function getStatusText(): string {
    switch (status) {
      case 'fetching': return 'Fetching page...'
      case 'extracting': return 'Extracting content...'
      case 'validating': return 'Validating content...'
      case 'success': return 'Success!'
      case 'error': return 'Error'
      default: return 'Fetch job listing'
    }
  }

  function getStatusColor(): string {
    switch (status) {
      case 'success': return 'text-emerald-600 dark:text-emerald-400'
      case 'error': return 'text-red-600 dark:text-red-400'
      default: return 'text-slate-600 dark:text-slate-400'
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--control)] bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-blue-600 focus-within:ring-[3px] focus-within:ring-blue-600/30 dark:bg-slate-900 dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400/30">
        <textarea
          className="h-48 w-full resize-none rounded-xl bg-transparent px-3.5 py-3 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-500 dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder="Paste the job description here. Include responsibilities, requirements, and key qualifications so we can match keywords precisely."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Tip: include responsibilities, requirements, and any listed tools.</span>
        <span>{charCount.toLocaleString()} characters</span>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-2xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-start gap-2">
            <WarningCircle className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-medium">Failed to fetch job description</div>
              <div className="mt-1 text-xs">{error}</div>
            </div>
            <button
              onClick={() => {
                setError(null)
                setStatus('idle')
              }}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Validation info */}
      {validation && status === 'success' && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          validation.score >= 70 
            ? 'border-emerald-200/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300'
            : validation.score >= 50
            ? 'border-amber-200/60 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300'
            : 'border-red-200/60 bg-red-50/80 text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300'
        }`}>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-medium">
                Extraction Quality: {validation.score}/100
                {validation.valid ? <Check weight="bold" className="ml-1 inline h-4 w-4" aria-label="passed" /> : <Warning className="ml-1 inline h-4 w-4" aria-label="needs review" />}
              </div>
              {validation.issues.length > 0 && (
                <div className="mt-1 text-xs">
                  {validation.issues.slice(0, 2).join('. ')}
                  {validation.issues.length > 2 && ` (+${validation.issues.length - 2} more)`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Truncation warning */}
      {truncated && (
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <Warning className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="font-medium">Content truncated</div>
              <div className="mt-1 text-xs">
                Job description was too long ({originalLength.toLocaleString()} characters). 
                First {value.length.toLocaleString()} characters extracted. You may want to check the original page for complete details.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="jd-url" className="label mb-1.5 block">Or fetch from a job URL</label>
          <input
            id="jd-url"
            className={`input ${error && status === 'error' ? 'border-red-600 dark:border-red-500' : ''}`}
            placeholder="https://company.com/careers/role"
            value={url}
            onChange={e => {
              setUrl(e.target.value)
              if (error) {
                setError(null)
                setStatus('idle')
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !loading && url && isValidUrl(url)) {
                fetchUrl()
              }
            }}
          />
        </div>
        <div className="flex items-end">
          <button
            className="button-outline w-full whitespace-nowrap sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={fetchUrl}
            disabled={loading || !url || !isValidUrl(url)}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <CircleNotch className="h-4 w-4 animate-spin" aria-hidden="true" weight="bold" />
                {getStatusText()}
              </span>
            ) : (
              'Fetch job listing'
            )}
          </button>
        </div>
      </div>

      {/* Status indicator */}
      {status !== 'idle' && status !== 'error' && (
        <div className={`text-xs ${getStatusColor()}`}>
          {status === 'success' && <Check weight="bold" className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}
          {getStatusText()}
        </div>
      )}
    </div>
  )
}
