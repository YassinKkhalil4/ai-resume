import mammoth from 'mammoth'
import { ResumeJSON } from './types'

// Dynamic import for pdfjs-dist to avoid build-time issues
let pdfjsLib: any = null

async function getPdfJs() {
  if (!pdfjsLib) {
    try {
      // Use dynamic import to avoid build-time issues
      pdfjsLib = await import('pdfjs-dist')
      
      // Configure worker for both Node and browser environments
      if (typeof window === 'undefined') {
        // Server-side configuration (Node.js/SSR)
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      } else {
        // Browser configuration
        pdfjsLib.GlobalWorkerOptions.workerSrc = 
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }
    } catch (error) {
      console.error('Failed to load pdfjs-dist:', error)
      throw new Error('PDF parsing library not available')
    }
  }
  return pdfjsLib
}

// Export the getPdfJs function for client-side use
export { getPdfJs }

export async function extractTextFromFile(file: File | Blob): Promise<{text:string, ext:string}> {
  // @ts-ignore
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mime = (file as File).type || ''
  const name = (file as File).name || ''
  const lower = (name||'').toLowerCase()
  const ext = lower.endsWith('.docx') || mime.includes('wordprocessingml') ? 'docx'
            : lower.endsWith('.pdf') || mime.includes('pdf') ? 'pdf'
            : 'txt'

  if (ext === 'pdf') {
    try {
      const pdfjs = await getPdfJs()
      const pdf = await pdfjs.getDocument({ data: buffer }).promise
      let text = ''
      
      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        text += pageText + '\n'
      }
      
      return { text: text.trim(), ext }
    } catch (error) {
      console.error('PDF parsing error:', error)
      // Fallback: try to extract some text from the PDF buffer
      const bufferStr = buffer.toString('utf8', 0, Math.min(buffer.length, 10000))
      const textMatch = bufferStr.match(/\/Type\s*\/Page[^>]*>.*?stream\s*([^>]*?)endstream/gs)
      if (textMatch) {
        const extractedText = textMatch
          .map(match => match.replace(/[^\x20-\x7E]/g, ' '))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (extractedText.length > 50) {
          return { text: extractedText, ext }
        }
      }
      return { text: '', ext }
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
  const skills = parseSkills(sections['skills'] || '')
  const summary = (sections['summary'] || sections['profile'] || '').split('\n').slice(0,3).join(' ')
  const education = (sections['education'] || '').split('\n').filter(Boolean)
  const certifications = (sections['certifications'] || sections['certs'] || '').split('\n').filter(Boolean)

  return { summary, skills, experience, education, certifications }
}

function splitByHeadings(text:string): Record<string,string> {
  const lines = text.split('\n')
  const map: Record<string,string[]> = {}
  let current = 'top'
  map[current] = []
  const headingRe = /^(summary|profile|experience|work|education|skills|projects|certifications)\b/i
  for (const l of lines) {
    const m = l.toLowerCase().match(headingRe)
    if (m) { current = m[1].toLowerCase(); map[current] = []; continue }
    map[current] = map[current] || []
    map[current].push(l)
  }
  const out:Record<string,string> = {}
  for (const [k, arr] of Object.entries(map)) out[k] = arr.join('\n').trim()
  return out
}

function parseExperience(section:string) {
  const lines = section.split('\n').filter(Boolean)
  const roles: Array<{company: string, role: string, dates: string, bullets: string[]}> = []
  let current: {company: string, role: string, dates: string, bullets: string[]} | null = null
  const roleWord = /Engineer|Manager|Analyst|Developer|Designer|Consultant|Lead|Director|Specialist|Scientist|Administrator|Coordinator/i
  const dateRe = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|\d{1,2})\s?\d{2,4}.*?(Present|\d{2,4})/i

  for (const l of lines) {
    if (dateRe.test(l) || roleWord.test(l)) {
      if (current) roles.push(current)
      current = { company: l.replace(/•.*/,'').trim(), role: '', dates: '', bullets: [] }
      continue
    }
    if (!current) { continue }
    if (l.startsWith('-') || l.startsWith('•') || l.startsWith('*')) {
      current.bullets.push(l.replace(/^[-•*]\s?/, '').trim())
    } else if (!current.role && roleWord.test(l)) {
      current.role = l.trim()
    } else if (!current.dates && dateRe.test(l)) {
      current.dates = l.trim()
    } else {
      if (l.length > 6) current.bullets.push(l.trim())
    }
  }
  if (current) roles.push(current)
  return roles.map(r=>({ ...r, bullets: r.bullets.filter(Boolean).slice(0,8) })).slice(0,6)
}

function parseSkills(section:string) {
  return section.split(/[•,;\n]/).map(s=>s.trim()).filter(Boolean).slice(0,60)
}
