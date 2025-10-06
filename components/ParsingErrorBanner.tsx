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
    <div className={`fixed top-0 left-0 right-0 z-50 ${isBlocking ? 'bg-red-50 border-b border-red-200' : 'bg-yellow-50 border-b border-yellow-200'}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`flex-shrink-0 ${isBlocking ? 'text-red-400' : 'text-yellow-400'}`}>
              {isBlocking ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div>
              <h3 className={`text-sm font-medium ${isBlocking ? 'text-red-800' : 'text-yellow-800'}`}>
                {errorState.title}
              </h3>
              <p className={`text-sm ${isBlocking ? 'text-red-700' : 'text-yellow-700'}`}>
                {errorState.message}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {validation.suggestions.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`text-sm font-medium ${isBlocking ? 'text-red-600 hover:text-red-500' : 'text-yellow-600 hover:text-yellow-500'}`}
              >
                {isExpanded ? 'Hide' : 'Show'} Suggestions
              </button>
            )}
            
            {onDismiss && !isBlocking && (
              <button
                onClick={onDismiss}
                className="text-yellow-600 hover:text-yellow-500"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {isExpanded && validation.suggestions.length > 0 && (
          <div className="mt-3 pl-8">
            <ul className="list-disc list-inside space-y-1">
              {validation.suggestions.map((suggestion, index) => (
                <li key={index} className={`text-sm ${isBlocking ? 'text-red-700' : 'text-yellow-700'}`}>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mt-3 pl-8">
          <div className="flex flex-wrap gap-2">
            {errorState.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => onAction(action.action)}
                className={`px-3 py-1 text-sm font-medium rounded-md ${
                  isBlocking 
                    ? 'bg-red-100 text-red-800 hover:bg-red-200' 
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
