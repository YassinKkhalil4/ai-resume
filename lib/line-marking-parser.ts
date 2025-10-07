import { ResumeJSON, Role } from './types'

export interface LineSelection {
  lineIndex: number
  lineText: string
  groupId?: string
  type?: 'company' | 'role' | 'date' | 'bullet' | 'other'
}

export interface ProcessedExperience {
  company: string
  role: string
  dates: string
  bullets: string[]
}

/**
 * Process line selections and convert them into structured experience data
 */
export function processLineSelections(
  resumeText: string,
  selections: LineSelection[]
): ResumeJSON['experience'] {
  if (selections.length === 0) {
    return []
  }

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

  const experiences: Role[] = []

  // Process grouped selections
  Object.entries(groups).forEach(([groupId, groupSelections]) => {
    const experience = processGroupedSelections(groupSelections)
    if (experience) {
      experiences.push(experience)
    }
  })

  // Process ungrouped selections as a single experience entry
  if (ungrouped.length > 0) {
    const experience = processUngroupedSelections(ungrouped)
    if (experience) {
      experiences.push(experience)
    }
  }

  return experiences
}

/**
 * Process a group of related line selections into a single experience entry
 */
function processGroupedSelections(selections: LineSelection[]): Role | null {
  if (selections.length === 0) return null

  // Sort by line index to maintain order
  const sortedSelections = selections.sort((a, b) => a.lineIndex - b.lineIndex)

  let company = ''
  let role = ''
  let dates = ''
  const bullets: string[] = []

  // Process each selection based on its type
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
        // Try to infer type from content patterns
        const inferredType = inferLineType(line)
        switch (inferredType) {
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
            // If we can't classify it, treat as a bullet point
            bullets.push(line)
        }
    }
  })

  // Ensure we have at least a company and role
  if (!company && !role) {
    // Try to extract from the first line
    const firstLine = sortedSelections[0]?.lineText.trim() || ''
    if (firstLine) {
      const parts = firstLine.split(' - ')
      if (parts.length >= 2) {
        company = parts[0].trim()
        role = parts[1].trim()
      } else {
        company = firstLine
        role = 'Various Roles'
      }
    }
  }

  if (!company) company = 'Unknown Company'
  if (!role) role = 'Various Roles'
  if (!dates) dates = 'Dates not specified'

  return {
    company,
    role,
    dates,
    bullets: bullets.length > 0 ? bullets : ['Experience details not specified']
  }
}

/**
 * Process ungrouped selections as a single experience entry
 */
function processUngroupedSelections(selections: LineSelection[]): Role | null {
  if (selections.length === 0) return null

  const sortedSelections = selections.sort((a, b) => a.lineIndex - b.lineIndex)
  const lines = sortedSelections.map(s => s.lineText.trim()).filter(Boolean)

  if (lines.length === 0) return null

  // Try to extract company and role from the first few lines
  let company = ''
  let role = ''
  let dates = ''
  const bullets: string[] = []

  // Look for company/role patterns in the first few lines
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i]
    const inferredType = inferLineType(line)
    
    if (inferredType === 'company' && !company) {
      company = line
    } else if (inferredType === 'role' && !role) {
      role = line
    } else if (inferredType === 'date' && !dates) {
      dates = line
    }
  }

  // If we still don't have company/role, try to extract from the first line
  if (!company && !role && lines.length > 0) {
    const firstLine = lines[0]
    const parts = firstLine.split(' - ')
    if (parts.length >= 2) {
      company = parts[0].trim()
      role = parts[1].trim()
    } else {
      company = firstLine
      role = 'Various Roles'
    }
  }

  // Add remaining lines as bullets
  lines.forEach((line, index) => {
    if (index >= 3 || !company || !role) {
      bullets.push(line)
    }
  })

  if (!company) company = 'Various Companies'
  if (!role) role = 'Various Roles'
  if (!dates) dates = 'Dates not specified'

  return {
    company,
    role,
    dates,
    bullets: bullets.length > 0 ? bullets : ['Experience details not specified']
  }
}

/**
 * Infer the type of a line based on its content patterns
 */
function inferLineType(line: string): LineSelection['type'] {
  const trimmed = line.trim()
  
  // Date patterns
  if (/\b(19|20)\d{2}\b/.test(trimmed) || 
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(trimmed) ||
      /\b(present|current|ongoing)\b/i.test(trimmed)) {
    return 'date'
  }
  
  // Company patterns (all caps, contains company indicators, or long capitalized text)
  if (/^[A-Z][A-Z\s&.,-]+$/.test(trimmed) && 
      (/\b(inc|llc|corp|ltd|company|co|group|technologies|systems|solutions|services)\b/i.test(trimmed) ||
       trimmed.length > 10)) {
    return 'company'
  }
  
  // Role patterns (title-like, often after company)
  const roleKeywords = /\b(engineer|developer|manager|director|analyst|specialist|coordinator|lead|senior|junior|architect|consultant|designer|programmer|administrator|supervisor|executive|officer|representative|assistant|intern|trainee)\b/i
  if (/^[A-Z][a-z\s&.,-]+$/.test(trimmed) && 
      (roleKeywords.test(trimmed) ||
       (trimmed.length > 5 && trimmed.length < 50 && !trimmed.includes('•') && !trimmed.includes('-')))) {
    return 'role'
  }
  
  // Bullet patterns
  const bulletKeywords = /^(developed|implemented|created|designed|managed|led|built|improved|increased|reduced|optimized|delivered|achieved|collaborated|coordinated|supervised|trained|mentored|analyzed|researched|planned|executed|maintained|supported|facilitated|organized|streamlined|enhanced|established|launched|initiated|oversaw|directed|guided|influenced|negotiated|presented|communicated|documented|tested|debugged|troubleshot|configured|deployed|integrated|customized|automated|scaled|monitored|evaluated|assessed|reviewed|audited|validated|verified|ensured|guaranteed|secured|protected|updated|upgraded|modernized|refactored)/i
  if (/^[•\-\*]\s+/.test(trimmed) || bulletKeywords.test(trimmed)) {
    return 'bullet'
  }
  
  return 'other'
}

/**
 * Validate and clean processed experience data
 */
export function validateProcessedExperience(experience: Role): Role {
  return {
    company: experience.company.trim() || 'Unknown Company',
    role: experience.role.trim() || 'Unknown Role',
    dates: experience.dates.trim() || 'Dates not specified',
    bullets: experience.bullets
      .map(bullet => bullet.trim())
      .filter(bullet => bullet.length > 0)
      .slice(0, 12) // Limit to 12 bullets per experience
  }
}

/**
 * Create a summary of the processing results
 */
export function createProcessingSummary(
  originalSelections: LineSelection[],
  processedExperiences: Role[]
): {
  totalLines: number
  totalExperiences: number
  totalBullets: number
  groups: number
  ungrouped: number
} {
  const groups = new Set(originalSelections.map(s => s.groupId).filter(Boolean))
  
  return {
    totalLines: originalSelections.length,
    totalExperiences: processedExperiences.length,
    totalBullets: processedExperiences.reduce((total, exp) => total + exp.bullets.length, 0),
    groups: groups.size,
    ungrouped: originalSelections.filter(s => !s.groupId).length
  }
}
