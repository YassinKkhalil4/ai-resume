'use client'

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
  const [inviteCode, setInviteCode] = useState('')
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
        body: JSON.stringify({ email, password, inviteCode: inviteCode || undefined }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to create account')
        return
      }

      // Track invite code usage
      if (inviteCode) {
        track('invite_code_used', { inviteCode })
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
          hasInviteCode: !!inviteCode,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Create Account</h2>
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
            <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="invite-code" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Invite Code <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="invite-code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
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
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Sign up with Google
        </button>

        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Sign in
          </button>
        </p>
      </div>

      {showVerificationModal && (
        <EmailVerificationModal
          isOpen={showVerificationModal}
          onClose={() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/auth/SignupModal.tsx:verification-modal-close',message:'Verification modal closed from signup',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            // Allow closing - account will remain unverified
            setShowVerificationModal(false)
            onClose()
            window.location.reload()
          }}
          email={email}
        />
      )}
    </div>
  )
}

