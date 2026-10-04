import './globals.css'
import type { Metadata } from 'next'
import Logo from '../components/Logo'
import AuthProvider from '../components/auth/AuthProvider'
import Navigation from '../components/Navigation'
import CookieConsent from '../components/CookieConsent'
import CookiePreferencesLink from '../components/CookiePreferencesLink'
import ThemeProvider from '../components/ThemeProvider'
import { Geist, Geist_Mono } from 'next/font/google'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'Rolefit',
  description: 'Rolefit rewrites your resume to any job in seconds. ATS-safe and integrity-first.',
  icons: {
    icon: [
      { url: '/brand/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
    shortcut: '/favicon.png',
  },
  openGraph: {
    title: 'Rolefit - AI Resume Tailor',
    description: 'Tailor your resume to any job in seconds. ATS-safe and integrity-first.',
    images: [
      {
        url: '/brand/og.png',
        width: 1200,
        height: 630,
        alt: 'Rolefit: tailor your resume to any role. Nothing invented.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rolefit - AI Resume Tailor',
    description: 'Tailor your resume to any job in seconds. ATS-safe and integrity-first.',
    images: ['/brand/og.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Apply theme synchronously before render to prevent flash
                try {
                  const stored = localStorage.getItem('theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
                  
                  if (shouldBeDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  // Fallback to light if localStorage fails
                  document.documentElement.classList.add('light');
                }
                
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans">
        <ThemeProvider />
        <AuthProvider>
          <Navigation />

          <div className="container pb-16 pt-10 md:pt-14">
            {children}

            <CookieConsent />
          </div>

          <footer className="border-t border-slate-200 dark:border-slate-800">
            <div className="container flex flex-col gap-6 py-8 text-sm text-slate-600 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2.5">
                <Logo variant="mark" height={20} className="opacity-90" />
                <span>© {new Date().getFullYear()} Rolefit. Built for honest professionals.</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <a href="/about" className="transition-colors hover:text-slate-900 dark:hover:text-slate-100">About</a>
                <a href="/pricing" className="transition-colors hover:text-slate-900 dark:hover:text-slate-100">Pricing</a>
                <a href="/contact" className="transition-colors hover:text-slate-900 dark:hover:text-slate-100">Contact</a>
                <a href="/privacy" className="transition-colors hover:text-slate-900 dark:hover:text-slate-100">Privacy</a>
                <a href="/terms" className="transition-colors hover:text-slate-900 dark:hover:text-slate-100">Terms</a>
                <CookiePreferencesLink />
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  )
}
