import { ResumeJSON } from './types'

export interface SectionMapping {
  [key: string]: string // original section name -> standard section name
}

export interface ParsingResult {
  resume: ResumeJSON
  mapping: SectionMapping
  confidence: number
  needsConfirmation: boolean
  suggestedMapping?: SectionMapping
}

export function createSectionMapper() {
  return {
    // Standard section names
    standardSections: ['summary', 'experience', 'skills', 'education', 'certifications'],
    
    // Common variations and synonyms
    sectionSynonyms: {
      summary: ['profile', 'objective', 'about', 'overview', 'introduction', 'bio', 'biography', 'personal statement', 'professional summary'],
      experience: ['work experience', 'professional experience', 'employment', 'work history', 'career history', 'professional background', 'work', 'career', 'professional'],
      skills: ['technical skills', 'core competencies', 'key skills', 'competencies', 'tech stack', 'technologies', 'technical expertise', 'core skills', 'key competencies', 'technical competencies', 'professional skills', 'programming languages', 'software skills', 'tools', 'software'],
      education: ['academic background', 'academic qualifications', 'academic credentials', 'academic', 'qualifications', 'credentials', 'degrees'],
      certifications: ['certificates', 'certs', 'professional certifications', 'licenses', 'licences', 'credentials', 'professional credentials']
    },
    
    // Suggest mapping for unknown sections
    suggestMapping(unknownSections: string[]): SectionMapping {
      const mapping: SectionMapping = {}
      
      for (const section of unknownSections) {
        const normalized = this.normalizeSectionName(section)
        const suggestion = this.findBestMatch(normalized)
        
        if (suggestion) {
          mapping[section] = suggestion
        }
      }
      
      return mapping
    },
    
    // Normalize section name for comparison
    normalizeSectionName(name: string): string {
      return name
        .toLowerCase()
        .replace(/[:\-\*\.\s]+$/, '') // Remove trailing punctuation
        .replace(/^[:\-\*\.\s]+/, '') // Remove leading punctuation
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim()
    },
    
    // Find best match for a section name
    findBestMatch(normalizedName: string): string | null {
      let bestMatch = ''
      let bestScore = 0
      
      for (const [standardSection, synonyms] of Object.entries(this.sectionSynonyms)) {
        // Check exact match
        if (normalizedName === standardSection) {
          return standardSection
        }
        
        // Check synonym matches
        for (const synonym of synonyms) {
          const score = this.calculateSimilarity(normalizedName, synonym)
          if (score > bestScore && score > 0.6) {
            bestScore = score
            bestMatch = standardSection
          }
        }
      }
      
      return bestMatch || null
    },
    
    // Calculate similarity between two strings
    calculateSimilarity(str1: string, str2: string): number {
      const words1 = str1.split(/\s+/)
      const words2 = str2.split(/\s+/)
      
      const set1 = new Set(words1)
      const set2 = new Set(words2)
      
      const intersection = new Set([...set1].filter(x => set2.has(x)))
      const union = new Set([...set1, ...set2])
      
      return union.size > 0 ? intersection.size / union.size : 0
    },
    
    // Apply mapping to resume sections
    applyMapping(resume: ResumeJSON, mapping: SectionMapping): ResumeJSON {
      const mapped: any = { ...resume }
      
      for (const [originalSection, standardSection] of Object.entries(mapping)) {
        if (mapped[originalSection]) {
          mapped[standardSection] = mapped[originalSection]
          delete mapped[originalSection]
        }
      }
      
      return mapped
    },
    
    // Validate mapping
    validateMapping(mapping: SectionMapping): { valid: boolean, errors: string[] } {
      const errors: string[] = []
      
      for (const [original, standard] of Object.entries(mapping)) {
        if (!this.standardSections.includes(standard)) {
          errors.push(`Invalid standard section: ${standard}`)
        }
      }
      
      return {
        valid: errors.length === 0,
        errors
      }
    }
  }
}

// Helper function to create parsing result with user confirmation
export function createParsingResult(
  resume: ResumeJSON, 
  mapping: SectionMapping, 
  confidence: number
): ParsingResult {
  const needsConfirmation = confidence < 0.8
  const suggestedMapping = needsConfirmation ? mapping : undefined
  
  return {
    resume,
    mapping,
    confidence,
    needsConfirmation,
    suggestedMapping
  }
}
