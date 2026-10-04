'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import LoginModal from './auth/LoginModal'
import SignupModal from './auth/SignupModal'
import { useTracking } from '../lib/analytics/useTracking'

export default function Navigation() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const { track } = useTracking()

  const isActive = (path: string) => pathname === path

  // Check admin status when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      checkAdminStatus()
    } else {
      setIsAdmin(false)
    }
  }, [status, session])

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/billing/credits')
      if (response.ok) {
        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
      }
    } catch (error) {
      // Not admin or error
      setIsAdmin(false)
    }
  }

  const handleSignupClick = () => {
    track('signup_started', { source: 'navigation' })
    setShowSignupModal(true)
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/contact', label: 'Contact' },
    { href: '/tailor', label: 'App' },
  ]

  const accountLinks = [
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/profile', label: 'Profile' },
  ]

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      isActive(href)
        ? 'text-slate-900 dark:text-slate-50'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50'
    }`

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        <nav aria-label="Primary" className="container">
          <div className="flex h-16 items-center justify-between gap-6">
            <Link href="/" className="flex shrink-0 items-center" aria-label="Rolefit home">
              <Image
                src="/logos/fulllogo_transparent_nobuffer.png"
                alt="Rolefit"
                width={200}
                height={48}
                className="h-11 w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop navigation: one line from lg up */}
            <div className="hidden flex-1 items-center justify-between lg:flex">
              <div className="flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href + link.label}
                    href={link.href}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                    className={linkClass(link.href)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              {status === 'authenticated' ? (
                <div className="flex items-center gap-6">
                  {accountLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={isActive(link.href) ? 'page' : undefined}
                      className={linkClass(link.href)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowLoginModal(true)} className="button-outline button-sm">
                    Sign In
                  </button>
                  <button onClick={handleSignupClick} className="button button-sm">
                    Sign Up
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="-mr-2 rounded-xl p-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50 lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              <svg className="h-6 w-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {mobileMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="menu-panel border-t border-slate-200 dark:border-slate-800 lg:hidden">
            <div className="container flex flex-col gap-1 py-4">
              {[...navLinks, ...(status === 'authenticated' ? accountLinks : [])].map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={`rounded-xl px-3 py-2.5 ${linkClass(link.href)} ${isActive(link.href) ? 'bg-slate-100 dark:bg-slate-900' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
              {status !== 'authenticated' && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setShowLoginModal(true)
                      setMobileMenuOpen(false)
                    }}
                    className="button-outline"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      handleSignupClick()
                      setMobileMenuOpen(false)
                    }}
                    className="button"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSwitchToSignup={() => {
            setShowLoginModal(false)
            handleSignupClick()
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
    </>
  )
}
