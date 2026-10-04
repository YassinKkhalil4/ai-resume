'use client'

import { useEffect, useId, useRef } from 'react'

type ModalProps = {
  onClose?: () => void
  /** id of the element that titles the dialog (aria-labelledby) */
  labelledBy: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Close when the dimmed backdrop is clicked. Off by default so a stray click never discards form input. */
  closeOnScrim?: boolean
  className?: string
  children: React.ReactNode
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-6xl',
} as const

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Open modals, topmost last: Esc and focus trapping only act on the top one.
const stack: string[] = []

export default function Modal({ onClose, labelledBy, size = 'md', closeOnScrim = false, className = '', children }: ModalProps) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    stack.push(id)
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select')
    ;(first ?? panel)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const index = stack.lastIndexOf(id)
      if (index !== -1) stack.splice(index, 1)
      document.body.style.overflow = stack.length === 0 ? previousOverflow : 'hidden'
      previouslyFocused?.focus?.()
    }
  }, [id])

  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (closeOnScrim && event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`modal-panel ${SIZES[size]} ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalClose({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}
