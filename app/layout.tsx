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
      <body className={inter.className}>
        <div className="container py-10">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-black" />
              <span className="font-semibold">AI Resume Tailor</span>
              <span className="badge">Integrity: <strong>No fabricated credentials</strong></span>
              <span className="badge">Privacy: <strong>Files deleted immediately</strong></span>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="text-xs text-gray-500">Processed in-memory • Files deleted immediately • Not stored unless you opt in</div>
            </div>
          </header>
          {children}
          <footer className="mt-12 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>© {new Date().getFullYear()} Resume Tailor</span>
              <span>Privacy: files processed in memory; not persisted by default.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
