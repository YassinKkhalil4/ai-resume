'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Role } from '../lib/types'

export type ConfirmExperienceRole = {
  company: string
  role: string
  dates?: string
  bullets: string[]
}

interface ConfirmExperienceModalProps {
  isOpen: boolean
  onClose: () => void
  rawText: string
  experience: Role[]
  sessionId: string
  onSuccess: (resume: any, validation: any) => void
  getInviteCode?: () => string
}

export default function ConfirmExperienceModal({
  isOpen,
  onClose,
  rawText,
  experience,
  sessionId,
  onSuccess,
  getInviteCode = () => '',
}: ConfirmExperienceModalProps) {
  const [roles, setRoles] = useState<ConfirmExperienceRole[]>(() =>
    experience.map((r) => ({
      company: r.company ?? '',
      role: r.role ?? '',
      dates: r.dates ?? '',
      bullets: Array.isArray(r.bullets)
        ? (r.bullets as string[]).map((b) => (typeof b === 'string' ? b : (b as { text: string }).text))
        : [],
    }))
  )
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number>(0)
  const [selection, setSelection] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setRoles(
        experience.map((r) => ({
          company: r.company ?? '',
          role: r.role ?? '',
          dates: r.dates ?? '',
          bullets: Array.isArray(r.bullets)
            ? (r.bullets as string[]).map((b) => (typeof b === 'string' ? b : (b as { text: string }).text))
            : [],
        }))
      )
      setSelectedRoleIndex(0)
      setSelection('')
      setError(null)
    }
  }, [isOpen, experience])

  const captureSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) {
      setSelection('')
      return
    }
    const text = rawText.slice(start, end)
    setSelection(text.trim())
  }, [rawText])

  const assignToRole = useCallback(() => {
    if (!selection.trim()) return
    setRoles((prev) => {
      const next = [...prev]
      const r = next[selectedRoleIndex]
      if (!r) return prev
      next[selectedRoleIndex] = { ...r, bullets: [...r.bullets, selection.trim()] }
      return next
    })
    setSelection('')
  }, [selection, selectedRoleIndex])

  const removeBullet = useCallback((roleIndex: number, bulletIndex: number) => {
    setRoles((prev) => {
      const next = [...prev]
      const r = next[roleIndex]
      if (!r) return prev
      next[roleIndex] = {
        ...r,
        bullets: r.bullets.filter((_, i) => i !== bulletIndex),
      }
      return next
    })
  }, [])

  const confirmedCount = roles.filter((r) => r.bullets.length > 0).length
  const totalRoles = roles.length
  const canSave = roles.length > 0 && roles.every((r) => r.bullets.length > 0)

  const handleSave = async () => {
    if (!canSave) {
      setError('Every role must have at least one bullet.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/confirm-experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-invite-code': getInviteCode() },
        body: JSON.stringify({
          sessionId,
          confirmedExperience: roles.map((r) => ({
            company: r.company,
            role: r.role,
            dates: r.dates,
            bullets: r.bullets,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Failed to save.')
        return
      }
      onSuccess(data.resume, data.validation)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Confirm experience
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tailora only rewrites experience you explicitly confirm. Highlight text in your resume, then assign it to a role as a bullet.
          </p>
          <div className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {confirmedCount} of {totalRoles} roles confirmed
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Resume text (select to assign as bullet)
            </label>
            <textarea
              ref={textareaRef}
              readOnly
              className="min-h-[280px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              value={rawText}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
            />
            {selection && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Selected: &quot;{selection.slice(0, 60)}{selection.length > 60 ? '…' : ''}&quot;
              </p>
            )}
          </div>

          <div className="flex flex-col overflow-auto">
            <label className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Experience roles
            </label>
            <div className="space-y-3 overflow-y-auto pr-2">
              {roles.map((r, idx) => {
                const hasBullets = r.bullets.length > 0
                const isSelected = selectedRoleIndex === idx
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {r.role || 'Role'}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {r.company || 'Company'}
                          {r.dates ? ` · ${r.dates}` : ''}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          hasBullets
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}
                      >
                        {hasBullets ? 'Has bullets' : 'Missing bullets'}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {r.bullets.map((b, bi) => (
                        <li
                          key={bi}
                          className="flex items-start gap-2 rounded bg-slate-100/80 py-1.5 px-2 text-sm dark:bg-slate-800/80"
                        >
                          <span className="flex-1 break-words text-slate-700 dark:text-slate-200">
                            {b}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeBullet(idx, bi)}
                            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                            aria-label="Remove bullet"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRoleIndex(idx)}
                        className={`rounded-lg border px-2 py-1 text-xs font-medium ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-500'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Select this role'}
                      </button>
                      {selection.trim() && isSelected && (
                        <button
                          type="button"
                          onClick={assignToRole}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Assign to this role
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
