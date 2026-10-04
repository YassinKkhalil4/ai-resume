'use client'

import Modal, { ModalClose } from '../Modal'
import { useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import EmailVerificationModal from './EmailVerificationModal'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToSignup: () => void
}

export default function LoginModal({ isOpen, onClose, onSwitchToSignup }: LoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const { data: session, update: updateSession } = useSession()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        // Update session to get latest user data
        await updateSession()
        
        // TEMPORARILY DISABLED: Skip verification check until Resend is set up
        // const updatedSession = await fetch('/api/auth/session').then(res => res.json())
        // if (updatedSession?.user && !updatedSession.user.emailVerified) {
        //   // Show verification modal
        //   setShowVerificationModal(true)
        // } else {
        //   onClose()
        //   window.location.reload()
        // }
        onClose()
        window.location.reload()
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const result = await signIn('google', { callbackUrl: window.location.href })
      if (result?.error) {
        setError('Failed to sign in with Google')
        setLoading(false)
      }
    } catch (err) {
      setError('Failed to sign in with Google')
      setLoading(false)
    }
  }

  return (
    <>
      <Modal onClose={onClose} labelledBy="login-title" size="md">
      <ModalClose onClick={onClose} />

        <h2 id="login-title" className="mb-4 text-2xl font-semibold tracking-tight">Sign In</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label block mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="label block mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="my-4 flex items-center">
          <div className="flex-1 border-t border-slate-300 dark:border-slate-700"></div>
          <span className="px-4 text-sm text-slate-500 dark:text-slate-400">or</span>
          <div className="flex-1 border-t border-slate-300 dark:border-slate-700"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="button-outline w-full"
        >
          Sign in with Google
        </button>

        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{' '}
          <button onClick={onSwitchToSignup} className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
            Sign up
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

