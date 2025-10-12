import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import ThemeToggle from '../components/ThemeToggle'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Resume Tailor',
  description: 'Tailor your resume to any job in seconds—ATS-safe and integrity-first.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} bg-transparent`}>
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute -top-32 left-12 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.22),_transparent_65%)] blur-3xl" />
          <div className="pointer-events-none absolute top-1/3 right-[-140px] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.18),_transparent_70%)] blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.1),_transparent_55%)]" />

          <div className="relative z-10">
            <div className="container py-12">
              <header className="mb-12 flex flex-col gap-6 rounded-3xl border border-white/40 bg-white/60 p-6 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
                    <span className="text-lg font-bold">RT</span>
                  </div>
                  <div>
                    <div className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
                      AI Resume Tailor
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="badge">Integrity-first • zero hallucinations</span>
                      <span className="badge">Privacy-safe • in-memory processing</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 text-xs text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-2 font-medium text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                      <path d="M12 3L7 8H10V16H14V8H17L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5 20H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Export ready in seconds
                  </div>
                  <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Instant • Secure • ATS Safe
                    </span>
                  </div>
                </div>
              </header>

              {children}

              <footer className="mt-16 rounded-3xl border border-white/40 bg-white/60 px-6 py-8 text-xs text-slate-500 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    © {new Date().getFullYear()} Resume Tailor. Built for honest professionals.
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="badge bg-transparent text-slate-500 dark:text-slate-300">Files wiped after processing</span>
                    <span className="badge bg-transparent text-slate-500 dark:text-slate-300">Invite-only beta</span>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
