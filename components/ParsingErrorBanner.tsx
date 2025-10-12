'use client'

import { useState } from 'react'
import { ParsingValidationResult, createErrorState } from '../lib/parsing-validation'

interface ParsingErrorBannerProps {
  validation: ParsingValidationResult
  onAction: (action: string) => void
  onDismiss?: () => void
}

export default function ParsingErrorBanner({ validation, onAction, onDismiss }: ParsingErrorBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const errorState = createErrorState(validation)
  
  if (errorState.type === 'success') {
    return null // Don't show banner for success
  }
  
  const isBlocking = errorState.type === 'error'
  
  return (
    <div className="fixed inset-x-0 top-4 z-50 px-5 sm:px-8">
      <div
        className={`relative mx-auto max-w-3xl overflow-hidden rounded-3xl border backdrop-blur-xl ${
          isBlocking
            ? 'border-rose-400/40 bg-rose-100/80 text-rose-800 shadow-2xl shadow-rose-300/40 dark:border-rose-500/30 dark:bg-rose-900/40 dark:text-rose-100'
            : 'border-amber-300/50 bg-amber-50/90 text-amber-800 shadow-2xl shadow-amber-200/40 dark:border-amber-400/30 dark:bg-amber-900/40 dark:text-amber-100'
        }`}
      >
        <div className="pointer-events-none absolute -top-20 right-0 h-48 w-48 rounded-full bg-gradient-to-br from-white/40 to-transparent blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                isBlocking
                  ? 'bg-rose-500/20 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200'
                  : 'bg-amber-400/20 text-amber-600 dark:bg-amber-400/25 dark:text-amber-100'
              }`}
            >
              {isBlocking ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M9.88 4.17L3.94 14.04C3.35 15.02 4.06 16.29 5.18 16.29H18.82C19.94 16.29 20.65 15.02 20.06 14.04L14.12 4.17C13.55 3.23 12.45 3.23 11.88 4.17L9.88 4.17Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M12 9V12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 15.5H12.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M12 6V13"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 10H15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">{errorState.title}</h3>
              <p className="mt-1 text-sm leading-snug">{errorState.message}</p>
              {isExpanded && validation.suggestions.length > 0 && (
                <ul className="mt-3 space-y-2 text-xs leading-relaxed">
                  {validation.suggestions.map((suggestion, index) => (
                    <li key={index}>• {suggestion}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            {validation.suggestions.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                  isBlocking ? 'text-rose-600 hover:text-rose-500 dark:text-rose-200 dark:hover:text-rose-100' : 'text-amber-600 hover:text-amber-500 dark:text-amber-100 dark:hover:text-amber-50'
                }`}
              >
                {isExpanded ? 'Hide suggestions' : 'Show suggestions'}
              </button>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {errorState.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => onAction(action.action)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    isBlocking
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 hover:bg-rose-600'
                      : 'bg-amber-400 text-amber-950 shadow-lg shadow-amber-400/30 hover:bg-amber-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {onDismiss && !isBlocking && (
              <button
                onClick={onDismiss}
                className="text-xs font-semibold text-amber-500 underline underline-offset-4 hover:text-amber-400 dark:text-amber-200 dark:hover:text-amber-100"
              >
                Dismiss for now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
