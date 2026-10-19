'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import LoginModal from '../../../components/auth/LoginModal'
import SignupModal from '../../../components/auth/SignupModal'

const ERRORS: Record<string, string> = {
  OAuthCallback: 'Google sign-in did not finish. Please try again.',
  OAuthSignin: 'Could not start Google sign-in. Please try again.',
  OAuthAccountNotLinked: 'That email is already registered with a different sign-in method.',
  AccessDenied: 'Sign-in was denied. Google must report your email as verified.',
  Callback: 'Something went wrong while signing you in. Please try again.',
}

function SignInContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { status } = useSession()
  const [mode, setMode] = useState<'none' | 'login' | 'signup'>('none')

  const error = params.get('error')
  const rawCallback = params.get('callbackUrl') || '/tailor'
  // Only follow same-origin callbacks
  const callbackUrl = (() => {
    try {
      const u = new URL(rawCallback, window.location.origin)
      return u.origin === window.location.origin ? u.pathname + u.search : '/tailor'
    } catch {
      return '/tailor'
    }
  })()

  useEffect(() => {
    if (status === 'authenticated') router.replace(callbackUrl)
  }, [status, callbackUrl, router])

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Sign in to Rolefit</h1>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {ERRORS[error] || 'Sign-in failed. Please try again.'}
        </div>
      )}
      <button onClick={() => signIn('google', { callbackUrl })} className="button w-full">
        Continue with Google
      </button>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Or use email:{' '}
        <button onClick={() => setMode('login')} className="font-semibold text-blue-600 dark:text-blue-400">Sign in</button>
        {' · '}
        <button onClick={() => setMode('signup')} className="font-semibold text-blue-600 dark:text-blue-400">Create account</button>
      </p>
      {mode === 'login' && (
        <LoginModal isOpen onClose={() => setMode('none')} onSwitchToSignup={() => setMode('signup')} />
      )}
      {mode === 'signup' && (
        <SignupModal isOpen onClose={() => setMode('none')} onSwitchToLogin={() => setMode('login')} />
      )}
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  )
}
