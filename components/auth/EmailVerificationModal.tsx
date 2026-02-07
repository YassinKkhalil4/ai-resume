'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface EmailVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  email?: string
}

export default function EmailVerificationModal({ isOpen, onClose, email }: EmailVerificationModalProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const { data: session, update: updateSession } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/EmailVerificationModal.tsx:useEffect:modal-opened',message:'Verification modal opened',data:{email,hasSession:!!session,emailVerified:session?.user?.emailVerified},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setCode('')
      setError('')
      setResendSuccess(false)
    }
  }, [isOpen, session, email])

  if (!isOpen) return null

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Invalid verification code')
        return
      }

      // Update session to reflect verified status
      await updateSession()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/EmailVerificationModal.tsx:handleVerify:success',message:'Verification successful, closing modal',data:{codeLength:code.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Close modal and reload to refresh UI
      onClose()
      window.location.reload()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setError('')
    setResendSuccess(false)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/EmailVerificationModal.tsx:handleResend:start',message:'Resend verification email requested',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/EmailVerificationModal.tsx:handleResend:response',message:'Resend verification response received',data:{ok:response.ok,status:response.status,hasError:!response.ok,errorMessage:data.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        setError(data.message || 'Failed to resend verification email')
        return
      }

      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/EmailVerificationModal.tsx:handleResend:error',message:'Resend verification error caught',data:{error:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setError('Failed to resend verification email')
    } finally {
      setResendLoading(false)
    }
  }

  const displayEmail = email || session?.user?.email || 'your email'

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Allow closing when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/EmailVerificationModal.tsx:X-button-clicked',message:'X button clicked - closing modal',data:{emailVerified:session?.user?.emailVerified,hasSession:!!session},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            onClose()
          }}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Verify Your Email</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          We&apos;ve sent a verification code to <span className="font-semibold">{displayEmail}</span>
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {resendSuccess && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
            Verification email sent! Please check your inbox.
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="verification-code" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Verification Code
            </label>
            <input
              id="verification-code"
              type="text"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(value)
              }}
              placeholder="000000"
              maxLength={6}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-2xl font-mono tracking-widest text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Enter the 6-digit code sent to your email, or click the verification link in the email.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={resendLoading}
            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
          >
            {resendLoading ? 'Sending...' : 'Resend verification email'}
          </button>
        </div>
      </div>
    </div>
  )
}

