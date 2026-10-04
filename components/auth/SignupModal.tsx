'use client'

import Modal, { ModalClose } from '../Modal'
import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useTracking } from '../../lib/analytics/useTracking'
import { detectUniversity } from '../../lib/analytics/university-detector'
import EmailVerificationModal from './EmailVerificationModal'

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToLogin: () => void
}

export default function SignupModal({ isOpen, onClose, onSwitchToLogin }: SignupModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const { track } = useTracking()

  // Track signup started when modal opens
  useEffect(() => {
    if (isOpen) {
      track('signup_started', { source: 'modal' })
    }
  }, [isOpen, track])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to create account')
        return
      }

      // Track university domain detection
      const university = detectUniversity(email)
      if (university) {
        track('university_domain_detected', {
          domain: university.domain,
          universityName: university.name,
        })
      }

      // Sign in after signup (user will need to verify email)
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Account created but failed to sign in. Please try logging in.')
      } else {
        // Track signup completed
        track('signup_completed', {
          method: 'email',
          isUniversity: !!university,
        })
        // Temporarily skip verification modal - auto-verified on signup
        // setShowVerificationModal(true)
        // Close modal and reload
        onClose()
        window.location.reload()
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    track('signup_started', { method: 'google' })
    try {
      await signIn('google', { callbackUrl: window.location.href })
      // Note: signup_completed will be tracked after redirect
    } catch (err) {
      setError('Failed to sign up with Google')
      setLoading(false)
    }
  }

  return (
    <>
      <Modal onClose={onClose} labelledBy="signup-title" size="md">
      <ModalClose onClick={onClose} />

        <h2 id="signup-title" className="mb-2 text-2xl font-semibold tracking-tight">Create Account</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Get started with <span className="font-semibold text-blue-600 dark:text-blue-400">1 free credit</span>!
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-email" className="label block mb-1">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="label block mb-1">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button w-full"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="my-4 flex items-center">
          <div className="flex-1 border-t border-slate-300 dark:border-slate-700"></div>
          <span className="px-4 text-sm text-slate-500 dark:text-slate-400">or</span>
          <div className="flex-1 border-t border-slate-300 dark:border-slate-700"></div>
        </div>

        <button
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="button-outline w-full"
        >
          Sign up with Google
        </button>

        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Sign in
          </button>
        </p>
      </Modal>

      {showVerificationModal && (
        <EmailVerificationModal
          isOpen={showVerificationModal}
          onClose={() => {
            // Allow closing - account will remain unverified
            setShowVerificationModal(false)
            onClose()
            window.location.reload()
          }}
          email={email}
        />
      )}
    </>
  )
}
