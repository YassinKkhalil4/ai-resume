'use client'

import { useState } from 'react'

interface SectionMappingModalProps {
  isOpen: boolean
  onClose: () => void
  suggestedMapping: Record<string, string>
  onConfirm: (mapping: Record<string, string>) => void
  confidence: number
}

export default function SectionMappingModal({ 
  isOpen, 
  onClose, 
  suggestedMapping, 
  onConfirm, 
  confidence 
}: SectionMappingModalProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(suggestedMapping)
  
  if (!isOpen) return null
  
  const standardSections = [
    { value: 'summary', label: 'Summary/Profile' },
    { value: 'experience', label: 'Experience' },
    { value: 'skills', label: 'Skills' },
    { value: 'education', label: 'Education' },
    { value: 'certifications', label: 'Certifications' },
    { value: 'ignore', label: 'Ignore Section' }
  ]
  
  const handleMappingChange = (originalSection: string, newMapping: string) => {
    setMapping(prev => ({
      ...prev,
      [originalSection]: newMapping
    }))
  }
  
  const handleConfirm = () => {
    onConfirm(mapping)
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Confirm Section Mappings</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Parsing Confidence: {Math.round(confidence * 100)}%</strong>
          </p>
          <p className="text-sm text-yellow-700 mt-1">
            We found some sections that need your confirmation. Please map each section to the correct category.
          </p>
        </div>
        
        <div className="space-y-4">
          {Object.entries(suggestedMapping).map(([originalSection, suggestedMapping]) => (
            <div key={originalSection} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700">
                    "{originalSection}"
                  </label>
                  <p className="text-sm text-gray-500">
                    Suggested: {suggestedMapping}
                  </p>
                </div>
                <select
                  value={mapping[originalSection] || suggestedMapping}
                  onChange={(e) => handleMappingChange(originalSection, e.target.value)}
                  className="ml-4 px-3 py-1 border rounded text-sm"
                >
                  {standardSections.map(section => (
                    <option key={section.value} value={section.value}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm Mappings
          </button>
        </div>
      </div>
    </div>
  )
}
