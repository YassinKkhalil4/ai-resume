import { ResumeJSON, Experience } from './types'

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

  const experiences: Experience[] = []

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
function processGroupedSelections(selections: LineSelection[]): Experience | null {
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
function processUngroupedSelections(selections: LineSelection[]): Experience | null {
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
  if (/^[A-Z][a-z\s&.,-]+$/.test(trimmed) && 
      (/\b(engineer|developer|manager|director|analyst|specialist|coordinator|lead|senior|junior|architect|consultant|designer|programmer|administrator|supervisor|executive|officer|representative|assistant|intern|trainee)\b/i.test(trimmed) ||
       (trimmed.length > 5 && trimmed.length < 50 && !trimmed.includes('•') && !trimmed.includes('-'))) {
    return 'role'
  }
  
  // Bullet patterns
  if (/^[•\-\*]\s+/.test(trimmed) || 
      /^(developed|implemented|created|designed|managed|led|built|improved|increased|reduced|optimized|delivered|achieved|collaborated|coordinated|supervised|trained|mentored|analyzed|researched|planned|executed|maintained|supported|facilitated|organized|streamlined|enhanced|established|launched|initiated|oversaw|directed|guided|influenced|negotiated|presented|communicated|documented|tested|debugged|troubleshot|configured|deployed|integrated|customized|automated|scaled|monitored|evaluated|assessed|reviewed|audited|validated|verified|ensured|guaranteed|secured|protected|maintained|updated|upgraded|modernized|refactored|optimized|performance|efficiency|productivity|quality|reliability|scalability|usability|accessibility|security|compliance|standards|best practices|methodologies|frameworks|tools|technologies|platforms|systems|applications|databases|networks|infrastructure|cloud|mobile|web|desktop|enterprise|consumer|business|technical|functional|non-functional|requirements|specifications|documentation|training|support|maintenance|troubleshooting|debugging|testing|quality assurance|user experience|user interface|user acceptance|integration|deployment|configuration|customization|automation|monitoring|logging|analytics|reporting|dashboard|metrics|key performance indicators|kpis|sla|service level agreement|uptime|availability|reliability|performance|scalability|security|compliance|governance|risk management|change management|project management|agile|scrum|kanban|waterfall|devops|ci/cd|continuous integration|continuous deployment|version control|git|svn|mercurial|branching|merging|code review|peer review|pull request|merge request|issue tracking|bug tracking|project tracking|time tracking|resource management|team management|stakeholder management|client management|vendor management|supplier management|contract management|budget management|cost management|quality management|risk management|change management|configuration management|release management|incident management|problem management|service management|asset management|inventory management|knowledge management|document management|content management|workflow management|process management|business process|business analysis|requirements analysis|system analysis|data analysis|performance analysis|root cause analysis|gap analysis|impact analysis|feasibility analysis|cost benefit analysis|risk analysis|security analysis|compliance analysis|audit|assessment|evaluation|review|inspection|testing|validation|verification|quality assurance|quality control|testing strategy|test plan|test case|test script|test data|test environment|test execution|test reporting|defect management|bug tracking|issue tracking|ticket management|support|help desk|customer service|user support|technical support|application support|system support|infrastructure support|network support|database support|security support|compliance support|training|documentation|user guide|technical documentation|system documentation|process documentation|procedure documentation|policy documentation|standard operating procedure|sop|runbook|playbook|checklist|template|form|report|dashboard|metrics|kpi|sla|service level agreement|uptime|availability|reliability|performance|scalability|security|compliance|governance|risk|change|project|program|portfolio|initiative|strategy|roadmap|milestone|deliverable|artifact|work product|output|outcome|result|benefit|value|roi|return on investment|cost savings|efficiency|productivity|quality|customer satisfaction|user satisfaction|stakeholder satisfaction|business value|strategic value|tactical value|operational value|financial value|technical value|functional value|non-functional value|business requirement|functional requirement|non-functional requirement|technical requirement|system requirement|user requirement|stakeholder requirement|regulatory requirement|compliance requirement|security requirement|performance requirement|scalability requirement|usability requirement|accessibility requirement|reliability requirement|availability requirement|maintainability requirement|portability requirement|interoperability requirement|compatibility requirement|integration requirement|deployment requirement|configuration requirement|customization requirement|automation requirement|monitoring requirement|logging requirement|analytics requirement|reporting requirement|dashboard requirement|metrics requirement|kpi requirement|sla requirement|service level agreement requirement|uptime requirement|availability requirement|reliability requirement|performance requirement|scalability requirement|security requirement|compliance requirement|governance requirement|risk requirement|change requirement|project requirement|program requirement|portfolio requirement|initiative requirement|strategy requirement|roadmap requirement|milestone requirement|deliverable requirement|artifact requirement|work product requirement|output requirement|outcome requirement|result requirement|benefit requirement|value requirement|roi requirement|return on investment requirement|cost savings requirement|efficiency requirement|productivity requirement|quality requirement|customer satisfaction requirement|user satisfaction requirement|stakeholder satisfaction requirement|business value requirement|strategic value requirement|tactical value requirement|operational value requirement|financial value requirement|technical value requirement|functional value requirement|non-functional value requirement)/i.test(trimmed)) {
    return 'bullet'
  }
  
  return 'other'
}

/**
 * Validate and clean processed experience data
 */
export function validateProcessedExperience(experience: Experience): Experience {
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
  processedExperiences: Experience[]
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
