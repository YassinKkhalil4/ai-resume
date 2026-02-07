'use client'

export default function ThemeToggle() {
  function toggle() {
    if (typeof document !== 'undefined') {
      const el = document.documentElement
      const isDark = el.classList.contains('dark')
      
      if (isDark) {
        el.classList.remove('dark')
        el.classList.add('light')
        localStorage.setItem('theme', 'light')
      } else {
        el.classList.remove('light')
        el.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      }
    }
  }
  return (
    <button className="button-outline text-xs" onClick={toggle}>Toggle Dark</button>
  )
}


