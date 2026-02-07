import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import AuthProvider from '../components/auth/AuthProvider'
import Navigation from '../components/Navigation'
import CookieConsent from '../components/CookieConsent'
import CookiePreferencesLink from '../components/CookiePreferencesLink'
import ThemeProvider from '../components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'tailora',
  description: 'tailora rewrites your resume to any job in seconds—ATS-safe and integrity-first.',
  icons: {
    icon: [
      { url: '/logos/icononly_transparent_nobuffer.png', sizes: 'any' },
      { url: '/logos/icononly_transparent_nobuffer.png', sizes: '32x32', type: 'image/png' },
      { url: '/logos/icononly_transparent_nobuffer.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/logos/icononly_transparent_nobuffer.png', sizes: '180x180' },
    ],
    shortcut: '/logos/icononly_transparent_nobuffer.png',
  },
  openGraph: {
    title: 'tailora - AI Resume Tailor',
    description: 'Tailor your resume to any job in seconds—ATS-safe and integrity-first.',
    images: [
      {
        url: '/logos/fulllogo.png',
        width: 1200,
        height: 630,
        alt: 'tailora logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'tailora - AI Resume Tailor',
    description: 'Tailor your resume to any job in seconds—ATS-safe and integrity-first.',
    images: ['/logos/fulllogo.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                
                function logCSSState(label) {
                  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
                  const bodyBg = getComputedStyle(document.body).backgroundColor;
                  const htmlBgImage = getComputedStyle(document.documentElement).backgroundImage;
                  const bodyBgImage = getComputedStyle(document.body).backgroundImage;
                  const stylesheets = Array.from(document.styleSheets).map(s => s.href || 'inline').filter(Boolean);
                  
                  fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      location: 'layout.tsx:css-check',
                      message: 'CSS state: ' + label,
                      data: {
                        htmlBg,
                        bodyBg,
                        htmlBgImage: htmlBgImage.substring(0, 100),
                        bodyBgImage: bodyBgImage.substring(0, 100),
                        htmlClasses: document.documentElement.className,
                        bodyClasses: document.body.className,
                        stylesheetCount: stylesheets.length,
                        stylesheets: stylesheets.slice(0, 3),
                        readyState: document.readyState,
                        timestamp: Date.now()
                      },
                      timestamp: Date.now(),
                      sessionId: 'debug-session',
                      runId: 'run1',
                      hypothesisId: 'A'
                    })
                  }).catch(() => {});
                }
                
                // Check immediately
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', () => logCSSState('DOMContentLoaded'));
                } else {
                  logCSSState('immediate');
                }
                
                // Check after delays to see if CSS loads
                setTimeout(() => logCSSState('100ms'), 100);
                setTimeout(() => logCSSState('500ms'), 500);
                setTimeout(() => logCSSState('1000ms'), 1000);
                setTimeout(() => logCSSState('2000ms'), 2000);
                
                // Monitor stylesheet loading
                document.addEventListener('load', function(e) {
                  if (e.target.tagName === 'LINK' && e.target.rel === 'stylesheet') {
                    logCSSState('stylesheet-loaded: ' + e.target.href);
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider />
        <AuthProvider>
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute -top-32 left-12 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.22),_transparent_65%)] blur-3xl" />
          <div className="pointer-events-none absolute top-1/3 right-[-140px] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.18),_transparent_70%)] blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.1),_transparent_55%)]" />

          <div className="relative z-10">
            <div className="container py-12">
              <div className="mb-12">
                <Navigation />
              </div>

              {children}

              <CookieConsent />

              <footer className="mt-16 rounded-3xl border border-white/50 bg-white/80 px-6 py-8 text-xs text-slate-600 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex-shrink-0 relative" style={{ width: '18px', height: '18px', minWidth: '18px' }}>
                      <Image
                        src="/logos/icononly_transparent_nobuffer.png"
                        alt="tailora"
                        width={18}
                        height={18}
                        className="object-contain opacity-70 dark:opacity-60"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                    <span>© {new Date().getFullYear()} tailora. Built for honest professionals.</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <a href="/about" className="hover:text-slate-700 dark:hover:text-slate-300">About</a>
                    <a href="/pricing" className="hover:text-slate-700 dark:hover:text-slate-300">Pricing</a>
                    <a href="/contact" className="hover:text-slate-700 dark:hover:text-slate-300">Contact</a>
                    <a href="/privacy" className="hover:text-slate-700 dark:hover:text-slate-300">Privacy</a>
                    <a href="/terms" className="hover:text-slate-700 dark:hover:text-slate-300">Terms</a>
                    <CookiePreferencesLink />
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
        </AuthProvider>
      </body>
    </html>
  )
}
