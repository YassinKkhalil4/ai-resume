'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import EmailVerificationModal from './EmailVerificationModal'

export default function VerifyEmailBanner() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const user = session?.user
  if (!user || user.emailVerified !== false || user.isAdmin) return null

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-2">
          <span>Verify your email to start tailoring resumes.</span>
          <button onClick={() => setOpen(true)} className="font-semibold underline underline-offset-2">
            Enter code or resend email
          </button>
        </div>
      </div>
      {open && <EmailVerificationModal isOpen={open} onClose={() => setOpen(false)} email={user.email ?? undefined} />}
    </>
  )
}
