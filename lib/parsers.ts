import mammoth from 'mammoth'
import { ResumeJSON } from './types'

type ParsedSections = {
  sections: Record<string, string>
  headings: Record<string, string>
  order: string[]
}

export async function extractTextFromFile(file: File | Blob): Promise<{text:string, ext:string, error?: string, message?: string}> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file instanceof File ? file.name.split('.').pop()?.toLowerCase() : 'txt') || 'txt'
  
  if (ext === 'pdf') {
    try {
      const pdfjs = await import('pdfjs-dist')
      const doc = await pdfjs.getDocument({ data: buffer }).promise
      let text = ''
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item: any) => item.str).join(' ') + '\n'
      }
      
      // Check if PDF is scanned (very little text extracted)
      if (text.trim().length < 50) {
        return { 
          text: '', 
          ext, 
          error: 'scanned_pdf',
          message: 'Your PDF appears to be scanned. Please upload DOCX or a text-based PDF (File → Save as PDF).'
        }
      }
      
      return { text, ext }
    } catch (error) {
      console.error('PDF parsing failed:', error)
      return { 
        text: '', 
        ext, 
        error: 'scanned_pdf',
        message: 'Your PDF appears to be scanned. Please upload DOCX or a text-based PDF (File → Save as PDF).'
      }
    }
  } else if (ext === 'docx') {
    const data = await mammoth.extractRawText({ buffer })
    return { text: data.value, ext }
  } else {
    return { text: buffer.toString('utf8'), ext: 'txt' }
  }
}

export function heuristicParseResume(raw: string): ResumeJSON {
  const text = (raw || '')
    .replace('\r', '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n')

  // Try primary parsing with enhanced heading detection
  let parsedSections = splitByHeadings(text)
  let sections = parsedSections.sections
  
  // If primary parsing fails, try fallback segmentation
  if (Object.keys(sections).length === 0 || !hasMeaningfulContent(sections)) {
    console.log('Primary parsing failed, attempting fallback segmentation')
    parsedSections = fallbackSegmentation(text)
    sections = parsedSections.sections
  }

  const experience = parseExperience(
    sections['experience'] ||
      sections['work'] ||
      sections['work experience'] ||
      sections['professional experience'] ||
      sections['employment'] ||
      sections['work history'] ||
      ''
  )
  const projects = parseProjects(
    sections['projects'] ||
      sections['project experience'] ||
      sections['key projects'] ||
      sections['project portfolio'] ||
      ''
  )
  const skills = parseSkills(
    sections['skills'] ||
      sections['core competencies'] ||
      sections['technical skills'] ||
      sections['key skills'] ||
      sections['tech stack'] ||
      sections['competencies'] ||
      sections['technologies'] ||
      ''
  )
  const summary = (sections['summary'] || sections['profile'] || sections['objective'] || sections['about'] || '').split('\n').slice(0,3).join(' ')
  const education = (sections['education'] || sections['academic background'] || '').split('\n').filter(Boolean)
  const certifications = (sections['certifications'] || sections['certificates'] || sections['certs'] || '').split('\n').filter(Boolean)

  const additionalSections = buildAdditionalSections(parsedSections)

  return { summary, skills, experience, education, certifications, projects, additional_sections: additionalSections }
}

function splitByHeadings(text: string): ParsedSections {
  const sections: Record<string, string> = {}
  const headings: Record<string, string> = {}
  const order: string[] = []
  const lines = text.split('\n')
  let currentSectionKey = ''
  let currentContent: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (isHeading(trimmed)) {
      if (currentSectionKey) {
        sections[currentSectionKey] = currentContent.join('\n')
      }
      const normalized = normalizeHeading(trimmed)
      currentSectionKey = normalized
      headings[normalized] = trimmed
      if (!order.includes(normalized)) {
        order.push(normalized)
      }
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  
  if (currentSectionKey) {
    sections[currentSectionKey] = currentContent.join('\n')
  }
  
  return { sections, headings, order }
}

function isHeading(line: string): boolean {
  // Normalize the line: trim punctuation/colons, lowercase, collapse whitespace
  const normalized = normalizeHeading(line)
  
  // Expanded synonyms and patterns
  const headingPatterns = [
    // Experience patterns
    /^(experience|work experience|professional experience|employment|work history|career history|professional background)$/,
    /^(work|employment|career|professional)$/,
    
    // Skills patterns
    /^(skills|technical skills|core competencies|key skills|competencies|tech stack|technologies|technical expertise)$/,
    /^(core skills|key competencies|technical competencies|professional skills)$/,
    /^(programming languages|software skills|tools|software)$/,
    
    // Summary patterns
    /^(summary|profile|objective|about|personal statement|professional summary)$/,
    /^(overview|introduction|bio|biography)$/,
    
    // Education patterns
    /^(education|academic background|academic qualifications|academic credentials)$/,
    /^(academic|qualifications|credentials|degrees)$/,
    
    // Certifications patterns
    /^(certifications|certificates|certs|professional certifications)$/,
    /^(licenses|licences|credentials|professional credentials)$/,
    
    // Projects patterns
    /^(projects|project experience|project portfolio|key projects)$/,
    /^(portfolio|project work|project history)$/,
    
    // Achievements patterns
    /^(achievements|accomplishments|awards|honors|honours)$/,
    /^(recognition|awards and recognition|professional achievements)$/,
    
    // Additional patterns
    /^(publications|research|volunteer|volunteer work|community service)$/,
    /^(languages|language skills|interests|hobbies|additional information)$/,
    
    // Extracurricular and volunteer patterns
    /^(extracurricular activities|extracurricular|activities|volunteer experience)$/,
    /^(volunteer work|community involvement|community service)$/
  ]
  
  return headingPatterns.some(pattern => pattern.test(normalized))
}

function normalizeHeading(line: string): string {
  return line
    .replace(/[:\-\*\.\s]+$/, '') // Remove trailing punctuation and whitespace
    .replace(/^[:\-\*\.\s]+/, '') // Remove leading punctuation and whitespace
    .toLowerCase()
    .replace(/\s+/g, ' ') // Collapse multiple whitespace to single space
    .trim()
}

function formatHeading(key: string): string {
  return key
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function hasMeaningfulContent(sections: Record<string, string>): boolean {
  const meaningfulSections = ['experience', 'skills', 'summary', 'education']
  return meaningfulSections.some(section => 
    sections[section] && sections[section].trim().length > 20
  )
}

function fallbackSegmentation(text: string): ParsedSections {
  console.log('Attempting fallback segmentation')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const sections: Record<string, string> = {}
  const headings: Record<string, string> = {}
  const order: string[] = []
  
  // Pattern-based section detection
  const patterns: Record<string, any> = {
    experience: {
      indicators: ['experience', 'work', 'employment', 'career', 'professional'],
      datePattern: /\b(19|20)\d{2}\b/, // Years 1900-2099
      bulletPattern: /^[•\-\*]\s+/,
      companyPattern: /^[A-Z][^•\-\*]*[A-Z]/
    },
    skills: {
      indicators: ['skills', 'competencies', 'technologies', 'tools', 'software'],
      listPattern: /^[A-Za-z][^•\-\*]*[,;]/, // Comma/semicolon separated
      shortLinePattern: /^[A-Za-z\s]{2,30}$/ // Short lines (likely skills)
    },
    summary: {
      indicators: ['summary', 'profile', 'objective', 'about'],
      longTextPattern: /^[A-Za-z][^•\-\*]{50,}/, // Long text without bullets
      firstSection: true // Often the first meaningful section
    }
  }
  
  let currentSection = ''
  let currentContent: string[] = []
  let sectionScores: Record<string, number> = {}
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const normalizedLine = normalizeHeading(line)
    
    // Score each line against section patterns
    for (const [sectionName, pattern] of Object.entries(patterns)) {
      let score = 0
      
      // Check for indicator words
      if (pattern.indicators.some((indicator: string) => normalizedLine.includes(indicator))) {
        score += 3
      }
      
      // Check for section-specific patterns
      if (sectionName === 'experience') {
        if (pattern.datePattern.test(line)) score += 2
        if (pattern.bulletPattern.test(line)) score += 1
        if (pattern.companyPattern.test(line)) score += 2
      } else if (sectionName === 'skills') {
        if (pattern.listPattern.test(line)) score += 2
        if (pattern.shortLinePattern.test(line)) score += 1
      } else if (sectionName === 'summary') {
        if (pattern.longTextPattern.test(line)) score += 2
        if (pattern.firstSection && i < 5) score += 1
      }
      
      sectionScores[sectionName] = (sectionScores[sectionName] || 0) + score
    }
    
    // If this line scores highly for a section, start that section
    const bestSection = Object.entries(sectionScores).reduce((a, b) => 
      sectionScores[a[0]] > sectionScores[b[0]] ? a : b
    )
    
    if (bestSection[1] > 2 && bestSection[0] !== currentSection) {
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n')
        headings[currentSection] = formatHeading(currentSection)
        if (!order.includes(currentSection)) order.push(currentSection)
      }
      currentSection = bestSection[0]
      currentContent = [line]
      sectionScores = {} // Reset scores
    } else {
      currentContent.push(line)
    }
  }
  
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n')
    headings[currentSection] = formatHeading(currentSection)
    if (!order.includes(currentSection)) order.push(currentSection)
  }
  
  // If still no sections found, try content-based segmentation
  if (Object.keys(sections).length === 0) {
    return contentBasedSegmentation(text)
  }
  
  return { sections, headings, order }
}

function contentBasedSegmentation(text: string): ParsedSections {
  console.log('Attempting content-based segmentation')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const sections: Record<string, string> = {}
  const headings: Record<string, string> = {}
  const order: string[] = []
  
  let currentSection = 'summary'
  let currentContent: string[] = []
  
  for (const line of lines) {
    // Detect section boundaries by content patterns
    if (isLikelyExperience(line)) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n')
      }
      currentSection = 'experience'
      currentContent = [line]
    } else if (isLikelySkills(line)) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n')
      }
      currentSection = 'skills'
      currentContent = [line]
    } else {
      currentContent.push(line)
    }
  }
  
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n')
    headings[currentSection] = formatHeading(currentSection)
    if (!order.includes(currentSection)) order.push(currentSection)
  }
  
  return { sections, headings, order }
}

function isLikelyExperience(line: string): boolean {
  // Look for experience indicators
  const experiencePatterns = [
    /\b(19|20)\d{2}\b/, // Years
    /\b(at|@|\-|\|)\b/, // Company separators
    /\b(engineer|manager|developer|analyst|consultant|director|lead|senior|junior)\b/i,
    /\b(company|corp|inc|llc|ltd)\b/i
  ]
  
  return experiencePatterns.some(pattern => pattern.test(line))
}

function isLikelySkills(line: string): boolean {
  // Look for skills indicators
  const skillsPatterns = [
    /^[A-Za-z][^•\-\*]*[,;]/, // Comma/semicolon separated
    /^[A-Za-z\s]{2,30}$/, // Short lines
    /\b(java|python|javascript|react|angular|vue|node|sql|aws|azure|docker|kubernetes)\b/i
  ]
  
  return skillsPatterns.some(pattern => pattern.test(line))
}

function parseExperience(section: string) {
  const roles: Array<{company: string, role: string, bullets: string[]}> = []
  const lines = section.split('\n').filter(Boolean)
  
  let currentRole: any = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (isRoleLine(trimmed)) {
      if (currentRole) roles.push(currentRole)
      currentRole = parseRoleLine(trimmed)
    } else if (currentRole && isBulletPoint(trimmed)) {
      const bullet = stripLeadingMarker(trimmed)
      if (bullet) currentRole.bullets.push(bullet)
    } else if (currentRole && trimmed.length > 0 && !isHeading(trimmed)) {
      const bullet = stripLeadingMarker(trimmed)
      if (bullet) currentRole.bullets.push(bullet)
    }
  }
  
  if (currentRole) roles.push(currentRole)
  return roles
}

function isRoleLine(line: string): boolean {
  // Enhanced role line detection
  const rolePatterns = [
    /^[^•\-\*].*(at|@|\-|\|).*[0-9]{4}/i, // "Role at Company 2020"
    /^[A-Z][^•\-\*]*[A-Z].*[0-9]{4}/, // "Company Role 2020"
    /^[^•\-\*].*\b(19|20)\d{2}\b/, // Any line with a year
    /^[A-Z][^•\-\*]*\b(engineer|manager|developer|analyst|consultant|director|lead|senior|junior|organizer|volunteer|intern|associate|athlete)\b/i,
    /^[^•\-\*].*\b(organizer|volunteer|intern|associate|athlete|sales|retail|consultant|real estate)\b.*[A-Z]/i, // "Role — Company" format
    /^[A-Z][^•\-\*]*\s*—\s*[A-Z]/, // "Company — Location" format
    /^[^•\-\*].*\s*—\s*[A-Z].*\s*—\s*[A-Z]/, // "Role — Company — Location" format
  ]
  
  return rolePatterns.some(pattern => pattern.test(line))
}

function parseRoleLine(line: string) {
  // Extract dates from the line first
  const dateMatch = line.match(/\b(19|20)\d{2}(?:\s*[-–]\s*(?:present|current|19|20)\d{2})?\b/gi)
  const dates = dateMatch ? dateMatch.join(' ') : ''
  
  // Handle "Role — Company — Location" format
  if (line.includes('—')) {
    const parts = line.split('—').map(p => p.trim())
    if (parts.length >= 2) {
      return {
        role: parts[0],
        company: parts[1],
        dates: dates,
        bullets: []
      }
    }
  }
  
  // Handle other formats with separators
  const separators = /at|@|\-|\||\b(19|20)\d{2}\b/
  const parts = line.split(separators).map(p => (p || '').trim()).filter(Boolean)
  
  if (parts.length >= 2) {
    return {
      role: parts[0],
      company: parts[1] || 'Unknown',
      dates: dates,
      bullets: []
    }
  }
  
  // Fallback: try to extract role and company from the line
  const roleMatch = line.match(/\b(engineer|manager|developer|analyst|consultant|director|lead|senior|junior|organizer|volunteer|intern|associate|athlete|sales|retail)\b/i)
  const companyMatch = line.match(/\b[A-Z][^•\-\*]*[A-Z]\b/)
  
  return {
    role: roleMatch ? roleMatch[0] : line,
    company: companyMatch ? companyMatch[0] : 'Unknown',
    dates: dates,
    bullets: []
  }
}

function isBulletPoint(line: string): boolean {
  return /^[\u2022•\-\*\u2014\u2013]/.test(line) || /^[0-9]+\./.test(line)
}

function stripLeadingMarker(line: string): string {
  return line
    .replace(/^[\u2022•\-\*\+\u2014\u2013]+[\s]*/, '')
    .replace(/^[0-9]+[.)]\s*/, '')
    .replace(/^[0-9]+\s*[-–]\s*/, '')
    .trim()
}

function parseSkills(section: string) {
  if (!section.trim()) return []
  
  // Enhanced skills parsing with multiple delimiters and formats
  const skills = section
    .split(/[•,;\n|]/) // Multiple delimiters
    .map(s => s.trim())
    .filter(Boolean)
    .filter(skill => skill.length > 2 && skill.length < 50) // Filter out too short/long items
    .slice(0, 60)
  
  return skills
}

function parseProjects(section: string) {
  const projects: Array<{ name: string; bullets: string[] }> = []
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean)
  
  let currentProject: { name: string; bullets: string[] } | null = null
  
  for (const line of lines) {
    if (!line) continue
    
    if (isHeading(line)) {
      // Skip section headings that may have slipped in
      continue
    }
    
    if (isBulletPoint(line)) {
      if (!currentProject) {
        currentProject = { name: 'Project', bullets: [] }
      }
      const bullet = stripLeadingMarker(line)
      if (bullet) currentProject.bullets.push(bullet)
      continue
    }
    
    const looksLikeNewProject = !currentProject || currentProject.bullets.length > 0
    
    if (looksLikeNewProject) {
      if (currentProject) {
        projects.push(currentProject)
      }
      currentProject = {
        name: cleanProjectTitle(line),
        bullets: []
      }
    } else if (currentProject) {
      const bullet = stripLeadingMarker(line)
      if (bullet) currentProject.bullets.push(bullet)
    }
  }
  
  if (currentProject) {
    projects.push(currentProject)
  }
  
  return projects.filter(project => project.name || project.bullets.length > 0)
}

function cleanProjectTitle(line: string): string {
  return stripLeadingMarker(line)
    .replace(/\s*[–—\-:]\s*$/, '')
    .trim()
}

function buildAdditionalSections(parsed: ParsedSections) {
  const consumedKeys = new Set<string>([
    'experience',
    'work',
    'work experience',
    'professional experience',
    'employment',
    'work history',
    'skills',
    'core competencies',
    'technical skills',
    'key skills',
    'tech stack',
    'competencies',
    'technologies',
    'summary',
    'profile',
    'objective',
    'about',
    'education',
    'academic background',
    'certifications',
    'certificates',
    'certs',
    'projects',
    'project experience',
    'key projects',
    'project portfolio'
  ])
  
  return parsed.order
    .filter(key => !consumedKeys.has(key))
    .map(key => {
      const lines = splitSectionLines(parsed.sections[key])
      return {
        heading: parsed.headings[key] || formatHeading(key),
        lines
      }
    })
    .filter(section => section.lines.length > 0)
}

function splitSectionLines(content: string): string[] {
  return content
    .split('\n')
    .map(line => stripLeadingMarker(line.trim()))
    .filter(Boolean)
}
