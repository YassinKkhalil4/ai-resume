import mammoth from 'mammoth'
import { ResumeJSON } from './types'

export async function extractTextFromFile(file: File | Blob): Promise<{text:string, ext:string}> {
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
      return { text, ext }
    } catch (error) {
      console.error('PDF parsing failed:', error)
      return { text: buffer.toString('utf8'), ext: 'txt' }
    }
  } else if (ext === 'docx') {
    const data = await mammoth.extractRawText({ buffer })
    return { text: data.value, ext }
  } else {
    return { text: buffer.toString('utf8'), ext: 'txt' }
  }
}

export function heuristicParseResume(raw: string): ResumeJSON {
  const text = (raw||'').replace('\r','').split('\n').map(l=>l.trim()).filter(Boolean).join('\n')

  // Try primary parsing with enhanced heading detection
  let sections = splitByHeadings(text)
  
  // If primary parsing fails, try fallback segmentation
  if (Object.keys(sections).length === 0 || !hasMeaningfulContent(sections)) {
    console.log('Primary parsing failed, attempting fallback segmentation')
    sections = fallbackSegmentation(text)
  }

  const experience = parseExperience(sections['experience'] || sections['work'] || sections['work experience'] || sections['professional experience'] || '')
  const skills = parseSkills(sections['skills'] || sections['core competencies'] || sections['technical skills'] || sections['key skills'] || sections['tech stack'] || sections['competencies'] || '')
  const summary = (sections['summary'] || sections['profile'] || sections['objective'] || sections['about'] || '').split('\n').slice(0,3).join(' ')
  const education = (sections['education'] || sections['academic background'] || '').split('\n').filter(Boolean)
  const certifications = (sections['certifications'] || sections['certificates'] || sections['certs'] || '').split('\n').filter(Boolean)

  return { summary, skills, experience, education, certifications }
}

function splitByHeadings(text: string) {
  const sections: Record<string, string> = {}
  const lines = text.split('\n')
  let currentSection = ''
  let currentContent: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (isHeading(trimmed)) {
      if (currentSection) {
        sections[currentSection.toLowerCase()] = currentContent.join('\n')
      }
      currentSection = trimmed
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }
  
  if (currentSection) {
    sections[currentSection.toLowerCase()] = currentContent.join('\n')
  }
  
  return sections
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
    /^(languages|language skills|interests|hobbies|additional information)$/
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

function hasMeaningfulContent(sections: Record<string, string>): boolean {
  const meaningfulSections = ['experience', 'skills', 'summary', 'education']
  return meaningfulSections.some(section => 
    sections[section] && sections[section].trim().length > 20
  )
}

function fallbackSegmentation(text: string): Record<string, string> {
  console.log('Attempting fallback segmentation')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const sections: Record<string, string> = {}
  
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
  }
  
  // If still no sections found, try content-based segmentation
  if (Object.keys(sections).length === 0) {
    return contentBasedSegmentation(text)
  }
  
  return sections
}

function contentBasedSegmentation(text: string): Record<string, string> {
  console.log('Attempting content-based segmentation')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const sections: Record<string, string> = {}
  
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
  }
  
  return sections
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
      currentRole.bullets.push(trimmed)
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
    /^[A-Z][^•\-\*]*\b(engineer|manager|developer|analyst|consultant|director|lead|senior|junior)\b/i
  ]
  
  return rolePatterns.some(pattern => pattern.test(line))
}

function parseRoleLine(line: string) {
  // Enhanced role parsing
  const separators = /at|@|\-|\||\b(19|20)\d{2}\b/
  const parts = line.split(separators).map(p => p.trim()).filter(Boolean)
  
  if (parts.length >= 2) {
    return {
      role: parts[0],
      company: parts[1] || 'Unknown',
      bullets: []
    }
  }
  
  // Fallback: try to extract role and company from the line
  const roleMatch = line.match(/\b(engineer|manager|developer|analyst|consultant|director|lead|senior|junior)\b/i)
  const companyMatch = line.match(/\b[A-Z][^•\-\*]*[A-Z]\b/)
  
  return {
    role: roleMatch ? roleMatch[0] : line,
    company: companyMatch ? companyMatch[0] : 'Unknown',
    bullets: []
  }
}

function isBulletPoint(line: string): boolean {
  return /^[•\-\*]/.test(line) || /^[0-9]+\./.test(line)
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
