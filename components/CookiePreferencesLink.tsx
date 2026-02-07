'use client'

export default function CookiePreferencesLink() {
  return (
    <button
      onClick={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('openCookiePreferences'))
        }
      }}
      className="hover:text-slate-700 dark:hover:text-slate-300"
    >
      Cookie Preferences
    </button>
  )
}

