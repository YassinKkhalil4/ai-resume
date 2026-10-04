'use client'

import Modal, { ModalClose } from '../Modal'
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

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to resend verification email')
        return
      }

      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err) {
      setError('Failed to resend verification email')
    } finally {
      setResendLoading(false)
    }
  }

  const displayEmail = email || session?.user?.email || 'your email'

  return (
    <Modal onClose={onClose} labelledBy="verify-title" size="md" closeOnScrim>
      <ModalClose onClick={onClose} />

        <h2 id="verify-title" className="mb-2 text-2xl font-semibold tracking-tight">Verify Your Email</h2>
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
            <label htmlFor="verification-code" className="label block mb-1">
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
              className="input font-mono"
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Enter the 6-digit code sent to your email, or click the verification link in the email.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="button w-full"
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
    </Modal>
  )
}

