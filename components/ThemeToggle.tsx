'use client'

export default function ThemeToggle() {
  function toggle() {
    if (typeof document !== 'undefined') {
      const el = document.documentElement
      el.classList.toggle('dark')
    }
  }
  return (
    <button className="button-outline text-xs" onClick={toggle}>Toggle Dark</button>
  )
}


