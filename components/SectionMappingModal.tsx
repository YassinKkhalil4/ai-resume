'use client'

import Modal, { ModalClose } from './Modal'
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
    <Modal onClose={onClose} labelledBy="mapping-title" size="lg">
        <ModalClose onClick={onClose} />
        <h2 id="mapping-title" className="mb-4 pr-8 text-xl font-semibold tracking-tight">Confirm Section Mappings</h2>
        
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
                    &quot;{originalSection}&quot;
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
            className="button"
          >
            Confirm Mappings
          </button>
        </div>
    </Modal>
  )
}
