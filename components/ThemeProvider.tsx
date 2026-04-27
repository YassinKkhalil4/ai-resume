'use client'

import { useEffect } from 'react'

export default function ThemeProvider() {
  useEffect(() => {
    // Detect system preference or stored theme
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('theme')
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const shouldBeDark = stored === 'dark' || (!stored && prefersDark)
        
        if (shouldBeDark) {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.add('light')
          document.documentElement.classList.remove('dark')
        }
      } catch (error) {
        console.error('ThemeProvider error:', error)
      }
    }
  }, [])

  return null
}

