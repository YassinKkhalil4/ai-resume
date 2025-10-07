'use client'

import { useState, useEffect } from 'react'
import { LineSelection } from './LineMarkingModal'

interface LineSelectorProps {
  lines: string[]
  onSelectionChange: (selections: LineSelection[]) => void
  initialSelections?: LineSelection[]
}

export default function LineSelector({ 
  lines, 
  onSelectionChange, 
  initialSelections = [] 
}: LineSelectorProps) {
  const [selections, setSelections] = useState<LineSelection[]>(initialSelections)

  useEffect(() => {
    setSelections(initialSelections)
  }, [initialSelections])

  const detectLineType = (line: string): LineSelection['type'] => {
    const trimmed = line.trim()
    
    // Date patterns
    if (/\b(19|20)\d{2}\b/.test(trimmed) || 
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(trimmed)) {
      return 'date'
    }
    
    // Company patterns (all caps, contains company indicators)
    if (/^[A-Z][A-Z\s&.,-]+$/.test(trimmed) && 
        (/\b(inc|llc|corp|ltd|company|co|group|technologies|systems)\b/i.test(trimmed) ||
         trimmed.length > 10)) {
      return 'company'
    }
    
    // Role patterns (title-like, often after company)
    if (/^[A-Z][a-z\s&.,-]+$/.test(trimmed) && 
        (/\b(engineer|developer|manager|director|analyst|specialist|coordinator|lead|senior|junior)\b/i.test(trimmed) ||
         trimmed.length > 5 && trimmed.length < 50)) {
      return 'role'
    }
    
    // Bullet patterns
    if (/^[•\-\*]\s+/.test(trimmed) || 
        /^(developed|implemented|created|designed|managed|led|built|improved|increased|reduced)/i.test(trimmed)) {
      return 'bullet'
    }
    
    return 'other'
  }

  const getLineTypeColor = (type: LineSelection['type']): string => {
    switch (type) {
      case 'company': return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'role': return 'bg-green-50 border-green-200 text-green-800'
      case 'date': return 'bg-purple-50 border-purple-200 text-purple-800'
      case 'bullet': return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      default: return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const toggleLineSelection = (lineIndex: number, lineText: string) => {
    const existingIndex = selections.findIndex(s => s.lineIndex === lineIndex)
    
    if (existingIndex >= 0) {
      // Remove selection
      const newSelections = selections.filter(s => s.lineIndex !== lineIndex)
      setSelections(newSelections)
      onSelectionChange(newSelections)
    } else {
      // Add selection
      const lineType = detectLineType(lineText)
      const newSelection: LineSelection = {
        lineIndex,
        lineText,
        type: lineType
      }
      
      const newSelections = [...selections, newSelection].sort((a, b) => a.lineIndex - b.lineIndex)
      setSelections(newSelections)
      onSelectionChange(newSelections)
    }
  }

  const isLineSelected = (lineIndex: number): boolean => {
    return selections.some(s => s.lineIndex === lineIndex)
  }

  const getLineGroupId = (lineIndex: number): string | undefined => {
    return selections.find(s => s.lineIndex === lineIndex)?.groupId
  }

  return (
    <div className="p-4 space-y-2">
      {lines.map((line, index) => {
        const isSelected = isLineSelected(index)
        const lineType = detectLineType(line)
        const groupId = getLineGroupId(index)
        const typeColor = getLineTypeColor(lineType)
        
        return (
          <div
            key={index}
            className={`
              flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all
              ${isSelected 
                ? 'bg-blue-100 border-blue-300 shadow-sm' 
                : 'hover:bg-gray-50 border-gray-200'
              }
            `}
            onClick={() => toggleLineSelection(index, line)}
          >
            <div className="flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleLineSelection(index, line)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 font-mono">
                  {String(index + 1).padStart(3, '0')}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full border ${typeColor}`}>
                  {lineType}
                </span>
                {groupId && (
                  <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                    Group {groupId.split('_')[1]}
                  </span>
                )}
              </div>
              
              <div className="text-sm text-gray-800 break-words">
                {line || <span className="text-gray-400 italic">(empty line)</span>}
              </div>
            </div>
          </div>
        )
      })}
      
      {lines.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No lines found in resume text
        </div>
      )}
    </div>
  )
}
