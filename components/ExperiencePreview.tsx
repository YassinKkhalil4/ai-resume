'use client'

import { useMemo } from 'react'
import { LineSelection } from './LineMarkingModal'

interface ExperiencePreviewProps {
  selections: LineSelection[]
  lines: string[]
}

interface GroupedExperience {
  groupId: string
  company: string
  role: string
  dates: string
  bullets: string[]
  ungroupedLines: string[]
}

export default function ExperiencePreview({ selections, lines }: ExperiencePreviewProps) {
  const groupedExperiences = useMemo(() => {
    if (selections.length === 0) return []

    // Group selections by groupId
    const groups: Record<string, LineSelection[]> = {}
    const ungrouped: LineSelection[] = []

    selections.forEach(selection => {
      if (selection.groupId) {
        if (!groups[selection.groupId]) {
          groups[selection.groupId] = []
        }
        groups[selection.groupId].push(selection)
      } else {
        ungrouped.push(selection)
      }
    })

    const experiences: GroupedExperience[] = []

    // Process grouped selections
    Object.entries(groups).forEach(([groupId, groupSelections]) => {
      const sortedSelections = groupSelections.sort((a, b) => a.lineIndex - b.lineIndex)
      
      let company = ''
      let role = ''
      let dates = ''
      const bullets: string[] = []

      sortedSelections.forEach(selection => {
        const line = selection.lineText.trim()
        
        switch (selection.type) {
          case 'company':
            if (!company) company = line
            break
          case 'role':
            if (!role) role = line
            break
          case 'date':
            if (!dates) dates = line
            break
          case 'bullet':
            bullets.push(line)
            break
          default:
            // Try to infer type from content
            if (/^[A-Z][A-Z\s&.,-]+$/.test(line) && line.length > 5) {
              if (!company) company = line
            } else if (/^[A-Z][a-z\s&.,-]+$/.test(line) && line.length > 3 && line.length < 50) {
              if (!role) role = line
            } else if (/\b(19|20)\d{2}\b/.test(line)) {
              if (!dates) dates = line
            } else {
              bullets.push(line)
            }
        }
      })

      experiences.push({
        groupId,
        company: company || 'Unknown Company',
        role: role || 'Unknown Role',
        dates: dates || 'No dates specified',
        bullets,
        ungroupedLines: []
      })
    })

    // Process ungrouped selections
    if (ungrouped.length > 0) {
      const ungroupedLines = ungrouped.map(s => s.lineText.trim())
      experiences.push({
        groupId: 'ungrouped',
        company: 'Ungrouped Experience',
        role: 'Various Roles',
        dates: 'Various Dates',
        bullets: [],
        ungroupedLines
      })
    }

    return experiences
  }, [selections])

  const totalBullets = useMemo(() => {
    return groupedExperiences.reduce((total, exp) => total + exp.bullets.length, 0)
  }, [groupedExperiences])

  if (selections.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="mb-2">📝</div>
        <p>No lines selected</p>
        <p className="text-sm">Click on lines in the left panel to mark them as experience</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <h4 className="font-medium text-blue-800 mb-1">Selection Summary</h4>
        <div className="text-sm text-blue-700">
          <div>• {selections.length} lines selected</div>
          <div>• {groupedExperiences.length} experience entries</div>
          <div>• {totalBullets} bullet points</div>
        </div>
      </div>

      {groupedExperiences.map((experience, index) => (
        <div key={experience.groupId} className="border border-gray-200 rounded-md p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-medium text-gray-800">
                {experience.company}
              </h4>
              <p className="text-sm text-gray-600">
                {experience.role}
              </p>
              <p className="text-xs text-gray-500">
                {experience.dates}
              </p>
            </div>
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              Entry {index + 1}
            </span>
          </div>

          {experience.bullets.length > 0 && (
            <div className="mb-3">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Bullet Points:</h5>
              <ul className="space-y-1">
                {experience.bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex} className="text-sm text-gray-600 flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {experience.ungroupedLines.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Additional Lines:</h5>
              <div className="space-y-1">
                {experience.ungroupedLines.map((line, lineIndex) => (
                  <div key={lineIndex} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {experience.bullets.length === 0 && experience.ungroupedLines.length === 0 && (
            <div className="text-sm text-gray-500 italic">
              No detailed content selected for this entry
            </div>
          )}
        </div>
      ))}

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <h4 className="font-medium text-yellow-800 mb-1">Next Steps</h4>
        <div className="text-sm text-yellow-700">
          <div>• Selected lines will be processed into structured experience data</div>
          <div>• AI will tailor this experience to match the job description</div>
          <div>• You can edit the results in the preview after processing</div>
        </div>
      </div>
    </div>
  )
}
