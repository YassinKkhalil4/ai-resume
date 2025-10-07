'use client'

import { useState, useEffect } from 'react'
import LineSelector from './LineSelector'
import ExperiencePreview from './ExperiencePreview'

export interface LineSelection {
  lineIndex: number
  lineText: string
  groupId?: string
  type?: 'company' | 'role' | 'date' | 'bullet' | 'other'
}

interface LineMarkingModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (selectedLines: LineSelection[]) => void
  resumeText: string
  originalResume?: any
}

export default function LineMarkingModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  resumeText, 
  originalResume 
}: LineMarkingModalProps) {
  const [selections, setSelections] = useState<LineSelection[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentGroupId, setCurrentGroupId] = useState<string>('')
  
  const lines = resumeText.split('\n').map((line, index) => ({
    index,
    text: line.trim(),
    isEmpty: !line.trim()
  })).filter(line => !line.isEmpty)

  useEffect(() => {
    if (isOpen) {
      setSelections([])
      setCurrentGroupId('')
    }
  }, [isOpen])

  const handleSelectionChange = (newSelections: LineSelection[]) => {
    setSelections(newSelections)
  }

  const handleGroupLines = () => {
    if (selections.length === 0) return
    
    const selectedIndices = selections.map(s => s.lineIndex)
    const newGroupId = `group_${Date.now()}`
    
    const updatedSelections = selections.map(selection => ({
      ...selection,
      groupId: newGroupId
    }))
    
    setSelections(updatedSelections)
    setCurrentGroupId(newGroupId)
  }

  const handleClearSelection = () => {
    setSelections([])
    setCurrentGroupId('')
  }

  const handleSubmit = async () => {
    if (selections.length === 0) return
    
    setIsSubmitting(true)
    try {
      await onSubmit(selections)
      onClose()
    } catch (error) {
      console.error('Failed to submit line selections:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Mark Lines as Experience</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Click on lines to mark them as experience. Group related lines together to form complete experience entries.
            Selected lines will be processed into structured experience data.
          </p>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
          {/* Left Panel - Line Selection */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Resume Lines ({lines.length} lines)</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleGroupLines}
                  disabled={selections.length === 0}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Group Selected
                </button>
                <button
                  onClick={handleClearSelection}
                  disabled={selections.length === 0}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto border rounded-md">
              <LineSelector
                lines={lines.map(l => l.text)}
                onSelectionChange={handleSelectionChange}
                initialSelections={selections}
              />
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex flex-col">
            <h3 className="font-medium mb-3">
              Experience Preview ({selections.length} lines selected)
            </h3>
            
            <div className="flex-1 overflow-y-auto border rounded-md">
              <ExperiencePreview
                selections={selections}
                lines={lines.map(l => l.text)}
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selections.length === 0 || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing...' : `Process ${selections.length} Lines`}
          </button>
        </div>
      </div>
    </div>
  )
}
