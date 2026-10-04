'use client'

export default function CookiePreferencesLink() {
  return (
    <button
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('openCookiePreferences'))
        }
      }}
      className="transition-colors hover:text-slate-900 dark:hover:text-slate-100"
    >
      Cookie Preferences
    </button>
  )
}

