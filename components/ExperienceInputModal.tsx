'use client'

import Modal, { ModalClose } from './Modal'
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
    <Modal onClose={onClose} labelledBy="experience-title" size="lg">
        <ModalClose onClick={onClose} />
        <h2 id="experience-title" className="mb-4 pr-8 text-xl font-semibold tracking-tight">Add Work Experience</h2>
        
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
            className="button"
          >
            {isSubmitting ? 'Processing...' : 'Add Experience'}
          </button>
        </div>
    </Modal>
  )
}
