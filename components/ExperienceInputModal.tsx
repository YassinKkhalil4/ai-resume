'use client'

import { useState } from 'react'

interface ExperienceInputModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (experience: string) => void
  originalText?: string
}

export default function ExperienceInputModal({ isOpen, onClose, onSubmit, originalText }: ExperienceInputModalProps) {
  const [experience, setExperience] = useState(originalText || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  if (!isOpen) return null
  
  const handleSubmit = async () => {
    if (!experience.trim()) return
    
    setIsSubmitting(true)
    try {
      await onSubmit(experience.trim())
      onClose()
    } catch (error) {
      console.error('Failed to submit experience:', error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Add Work Experience</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Paste your work experience below. Include job titles, companies, dates, and bullet points describing your responsibilities and achievements.
          </p>
          
          <textarea
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="Example:
Software Engineer at Google (2020-2023)
• Developed scalable web applications using React and Node.js
• Led a team of 5 engineers to deliver features on time
• Improved application performance by 40%

Senior Developer at Microsoft (2018-2020)
• Built microservices architecture for enterprise clients
• Mentored junior developers and conducted code reviews
• Reduced system downtime by 60%"
            className="w-full h-64 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!experience.trim() || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing...' : 'Add Experience'}
          </button>
        </div>
      </div>
    </div>
  )
}
