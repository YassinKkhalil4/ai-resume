'use client'

import { Info, Warning } from '@phosphor-icons/react'
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
    <div role={isBlocking ? 'alert' : 'status'}>
      <div
        className={`rounded-3xl border ${
          isBlocking
            ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100'
        }`}
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                isBlocking
                  ? 'bg-rose-500/20 text-rose-700 dark:bg-rose-500/25 dark:text-rose-200'
                  : 'bg-amber-400/20 text-amber-600 dark:bg-amber-400/25 dark:text-amber-100'
              }`}
            >
              {isBlocking ? (
                <Warning className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Info className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">{errorState.title}</h3>
              <p className="mt-1 text-sm leading-snug">{errorState.message}</p>
              {isExpanded && validation.suggestions.length > 0 && (
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
                  {validation.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            {validation.suggestions.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-xs font-semibold ${
                  isBlocking ? 'text-rose-800 hover:text-rose-950 dark:text-rose-200 dark:hover:text-rose-50' : 'text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50'
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
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                    isBlocking
                      ? 'bg-rose-700 text-white hover:bg-rose-800'
                      : 'bg-amber-700 text-white hover:bg-amber-800'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {onDismiss && !isBlocking && (
              <button
                onClick={onDismiss}
                className="text-xs font-semibold text-amber-800 underline underline-offset-4 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50"
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
