'use client'

import { useEffect } from 'react'

export default function ThemeProvider() {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ThemeProvider.tsx:useEffect:entry',message:'ThemeProvider useEffect started',data:{hasWindow:typeof window !== 'undefined',readyState:typeof window !== 'undefined' ? document.readyState : 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Detect system preference or stored theme
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('theme')
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const shouldBeDark = stored === 'dark' || (!stored && prefersDark)
        
        // #region agent log
        const beforeBg = getComputedStyle(document.body).backgroundColor;
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ThemeProvider.tsx:useEffect:before-theme',message:'Before applying theme',data:{stored,prefersDark,shouldBeDark,bodyBg:beforeBg,htmlClasses:document.documentElement.className},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        if (shouldBeDark) {
          document.documentElement.classList.add('dark')
          document.documentElement.classList.remove('light')
        } else {
          document.documentElement.classList.add('light')
          document.documentElement.classList.remove('dark')
        }
        
        // #region agent log
        const afterBg = getComputedStyle(document.body).backgroundColor;
        const afterBgImage = getComputedStyle(document.body).backgroundImage;
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ThemeProvider.tsx:useEffect:after-theme',message:'After applying theme',data:{bodyBg:afterBg,bodyBgImage:afterBgImage.substring(0,100),htmlClasses:document.documentElement.className},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cdfd2b9-0a91-4d01-9144-7ca1ae00ff40',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ThemeProvider.tsx:useEffect:error',message:'ThemeProvider error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.error('ThemeProvider error:', error)
      }
    }
  }, [])

  return null
}

