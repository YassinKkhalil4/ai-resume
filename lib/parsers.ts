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

  const sections = splitByHeadings(text)
  const experience = parseExperience(sections['experience'] || sections['work'] || '')
  const skills = parseSkills(sections['skills'] || sections['core competencies'] || sections['technical skills'] || sections['key skills'] || '')
  const summary = (sections['summary'] || sections['profile'] || '').split('\n').slice(0,3).join(' ')
  const education = (sections['education'] || '').split('\n').filter(Boolean)
  const certifications = (sections['certifications'] || sections['certs'] || '').split('\n').filter(Boolean)

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
  const headingPatterns = [
    /^(experience|work experience|professional experience|employment)$/i,
    /^(skills|technical skills|core competencies|key skills|competencies)$/i,
    /^(summary|profile|objective|about)$/i,
    /^(education|academic background)$/i,
    /^(certifications|certificates|certs)$/i,
    /^(projects|project experience)$/i,
    /^(achievements|accomplishments)$/i
  ]
  
  return headingPatterns.some(pattern => pattern.test(line))
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
  // Look for patterns like "Software Engineer at Google" or "Google - Software Engineer"
  return /^[^•\-\*].*(at|@|\-|\|).*[0-9]{4}/i.test(line) || 
         /^[A-Z][^•\-\*]*[A-Z].*[0-9]{4}/.test(line)
}

function parseRoleLine(line: string) {
  const parts = line.split(/at|@|\-|\|/).map(p => p.trim())
  if (parts.length >= 2) {
    return {
      role: parts[0],
      company: parts[1],
      bullets: []
    }
  }
  return { role: line, company: 'Unknown', bullets: [] }
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
