import { JSDOM } from 'jsdom'
import { logUrlFetch } from './telemetry'

// Configuration
const MAX_TEXT_LENGTH = 15000 // Increased from 5000
const FETCH_TIMEOUT = 15000 // 15 seconds
const MAX_RETRIES = 2
const RETRY_DELAY_BASE = 1000 // 1 second base delay

// URL Validation - Security hardening
export function validateUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  // Protocol validation
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Invalid protocol. Only HTTP and HTTPS are allowed.')
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block localhost and loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
    throw new Error('This URL cannot be accessed for security reasons. Cannot access localhost.')
  }

  // Block private IP ranges
  const privateIPPatterns = [
    /^10\./,                                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./,          // 172.16.0.0/12
    /^192\.168\./,                              // 192.168.0.0/16
    /^169\.254\./,                              // Link-local (includes AWS metadata)
    /^127\./,                                   // Loopback (additional check)
  ]

  for (const pattern of privateIPPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('This URL cannot be accessed for security reasons. Cannot access private networks.')
    }
  }

  // Block cloud metadata endpoints
  const blockedHosts = [
    '169.254.169.254',           // AWS, GCP, Azure metadata
    'metadata.google.internal',   // GCP metadata
    'metadata.azure.com',         // Azure metadata
    '169.254.169.254.nip.io',     // DNS rebinding protection
  ]

  if (blockedHosts.includes(hostname)) {
    throw new Error('This URL cannot be accessed for security reasons.')
  }

  // Block internal/private domains
  const internalDomains = [
    '.local',
    '.internal',
    '.corp',
    '.lan',
  ]

  for (const domain of internalDomains) {
    if (hostname.endsWith(domain)) {
      throw new Error('This URL cannot be accessed for security reasons. Cannot access internal domains.')
    }
  }
}

// Extract main content from HTML using intelligent heuristics
function extractMainContent(dom: JSDOM): string {
  const document = (dom as any).window.document
  const body = document.body
  if (!body) return ''

  // Remove unwanted elements
  const unwantedSelectors = [
    'nav', 'header', 'footer', 'aside',
    'script', 'style', 'noscript',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]',
    '.nav', '.navigation', '.menu', '.header', '.footer',
    '.sidebar', '.ad', '.advertisement', '.ads', '.ad-container',
    '.cookie', '.cookie-banner', '.cookie-consent',
    '.social', '.social-share', '.share-buttons',
    '.comments', '.comment-section',
  ]

  unwantedSelectors.forEach(selector => {
    try {
      const elements = body.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    } catch {
      // Ignore invalid selectors
    }
  })

  // Remove elements with unwanted classes/ids
  const unwantedPatterns = [
    /nav/i, /menu/i, /header/i, /footer/i, /sidebar/i,
    /ad/i, /advertisement/i, /cookie/i, /social/i, /comment/i,
  ]

  const allElements = body.querySelectorAll('*')
  allElements.forEach(el => {
    const className = el.className?.toString().toLowerCase() || ''
    const id = el.id?.toLowerCase() || ''
    const combined = `${className} ${id}`
    
    for (const pattern of unwantedPatterns) {
      if (pattern.test(combined)) {
        el.remove()
        return
      }
    }
  })

  // Try to find main content using semantic HTML and common job description selectors
  const contentSelectors = [
    // Semantic HTML
    'main',
    'article',
    '[role="main"]',
    '[role="article"]',
    
    // Common job description containers
    '.job-description',
    '.job-details',
    '.job-content',
    '.description',
    '.job-post',
    '.job-posting',
    '.job-listing',
    '#job-description',
    '#job-details',
    '#description',
    '[data-job-description]',
    '[data-content]',
    '[data-job-content]',
    
    // Generic content containers
    '.content',
    '.main-content',
    '.post-content',
    '.entry-content',
  ]

  let mainContent: Element | null = null

  for (const selector of contentSelectors) {
    try {
      const element = body.querySelector(selector)
      if (element) {
        const text = element.textContent || ''
        // Only use if it has substantial content (at least 200 chars)
        if (text.trim().length >= 200) {
          mainContent = element
          break
        }
      }
    } catch {
      continue
    }
  }

  // Fallback: Find largest text block
  if (!mainContent) {
    let maxLength = 0
    const candidates = body.querySelectorAll('div, section, article, main')
    
    candidates.forEach(el => {
      const text = el.textContent || ''
      const length = text.trim().length
      if (length > maxLength && length >= 200) {
        maxLength = length
        mainContent = el
      }
    })
  }

  // Final fallback: use body if nothing else found
  if (!mainContent) {
    mainContent = body
  }

  return mainContent.textContent || ''
}

// Extract structured text preserving formatting
function extractStructuredText(dom: JSDOM): string {
  const document = (dom as any).window.document
  const body = document.body
  if (!body) return ''

  // Find main content element using the same logic as extractMainContent
  let mainContentElement: Element | null = null

  // Remove unwanted elements first (same as extractMainContent)
  const unwantedSelectors = [
    'nav', 'header', 'footer', 'aside',
    'script', 'style', 'noscript',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]',
    '.nav', '.navigation', '.menu', '.header', '.footer',
    '.sidebar', '.ad', '.advertisement', '.ads', '.ad-container',
    '.cookie', '.cookie-banner', '.cookie-consent',
    '.social', '.social-share', '.share-buttons',
    '.comments', '.comment-section',
  ]

  unwantedSelectors.forEach(selector => {
    try {
      const elements = body.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    } catch {}
  })

  // Find main content using semantic HTML and common job description selectors
  const contentSelectors = [
    'main', 'article', '[role="main"]', '[role="article"]',
    '.job-description', '.job-details', '.job-content', '.description',
    '.job-post', '.job-posting', '.job-listing',
    '#job-description', '#job-details', '#description',
    '[data-job-description]', '[data-content]', '[data-job-content]',
    '.content', '.main-content', '.post-content', '.entry-content',
  ]

  for (const selector of contentSelectors) {
    try {
      const element = body.querySelector(selector)
      if (element) {
        const text = element.textContent || ''
        if (text.trim().length >= 200) {
          mainContentElement = element
          break
        }
      }
    } catch {
      continue
    }
  }

  // Fallback: Find largest text block
  if (!mainContentElement) {
    let maxLength = 0
    const candidates = body.querySelectorAll('div, section, article, main')
    candidates.forEach(el => {
      const text = el.textContent || ''
      const length = text.trim().length
      if (length > maxLength && length >= 200) {
        maxLength = length
        mainContentElement = el
      }
    })
  }

  // Final fallback: use body
  if (!mainContentElement) {
    mainContentElement = body
  }

  const lines: string[] = []

  function processNode(node: Node, indent: number = 0): void {
    if (node.nodeType === 3) { // Text node
      const text = node.textContent?.trim()
      if (text) {
        lines.push(' '.repeat(indent) + text)
      }
      return
    }

    if (node.nodeType !== 1) return // Not an element
    const element = node as Element
    const tagName = element.tagName.toLowerCase()

    // Process headings
    if (tagName.match(/^h[1-6]$/)) {
      const level = parseInt(tagName[1])
      const text = element.textContent?.trim()
      if (text) {
        lines.push('')
        lines.push('#'.repeat(level) + ' ' + text)
        lines.push('')
      }
      return
    }

    // Process lists
    if (tagName === 'ul' || tagName === 'ol') {
      const items = element.querySelectorAll('li')
      items.forEach((item, index) => {
        const text = item.textContent?.trim()
        if (text) {
          const prefix = tagName === 'ol' ? `${index + 1}. ` : '• '
          lines.push(' '.repeat(indent) + prefix + text)
        }
      })
      lines.push('')
      return
    }

    // Process paragraphs
    if (tagName === 'p') {
      const text = element.textContent?.trim()
      if (text) {
        lines.push(text)
        lines.push('')
      }
      return
    }

    // Process bold/italic
    if (tagName === 'strong' || tagName === 'b') {
      const text = element.textContent?.trim()
      if (text) {
        lines.push('**' + text + '**')
      }
      return
    }

    if (tagName === 'em' || tagName === 'i') {
      const text = element.textContent?.trim()
      if (text) {
        lines.push('*' + text + '*')
      }
      return
    }

    // Process line breaks
    if (tagName === 'br') {
      lines.push('')
      return
    }

    // Recursively process children
    Array.from(element.childNodes).forEach(child => {
      processNode(child, indent)
    })
  }

  processNode(mainContentElement)
  
  // Clean up and join
  return lines
    .map(line => line.trim())
    .filter((line, index, arr) => {
      // Remove excessive blank lines
      if (line === '' && index > 0 && arr[index - 1] === '') return false
      return true
    })
    .join('\n')
    .trim()
}

// Smart truncation that preserves complete sections
function smartTruncate(text: string, maxLength: number): { text: string, truncated: boolean, originalLength: number } {
  const originalLength = text.length
  if (text.length <= maxLength) {
    return { text, truncated: false, originalLength }
  }

  // Try to truncate at sentence boundaries
  let truncated = text.substring(0, maxLength)
  
  // Find last complete sentence
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const lastBreak = Math.max(lastPeriod, lastNewline)
  
  if (lastBreak > maxLength * 0.8) { // Only use if we're not losing too much
    truncated = truncated.substring(0, lastBreak + 1)
  } else {
    // Fallback: truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > maxLength * 0.8) {
      truncated = truncated.substring(0, lastSpace) + '...'
    } else {
      truncated = truncated.substring(0, maxLength - 3) + '...'
    }
  }

  return { text: truncated.trim(), truncated: true, originalLength }
}

// Content validation
export type ValidationResult = {
  valid: boolean
  score: number // 0-100
  issues: string[]
}

export function validateJobDescription(text: string): ValidationResult {
  const issues: string[] = []
  let score = 100

  // Minimum length check
  if (text.length < 200) {
    issues.push('Content is too short (less than 200 characters)')
    score -= 40
  } else if (text.length < 500) {
    issues.push('Content is quite short (less than 500 characters)')
    score -= 20
  }

  const lower = text.toLowerCase()

  // Job-related keywords check
  const jobKeywords = [
    'requirements', 'responsibilities', 'qualifications', 'experience',
    'skills', 'education', 'degree', 'years', 'role', 'position',
    'job', 'career', 'opportunity', 'candidate', 'applicant',
    'duties', 'tasks', 'work', 'team', 'company', 'organization'
  ]

  const foundKeywords = jobKeywords.filter(kw => lower.includes(kw))
  if (foundKeywords.length < 3) {
    issues.push('Few job-related keywords found. Content may not be a job description.')
    score -= 30
  }

  // Check for navigation/common non-job content
  const noiseIndicators = [
    'home', 'about us', 'contact us', 'privacy policy', 'terms of service',
    'cookie policy', 'copyright', 'all rights reserved', 'login', 'sign up',
    'subscribe', 'newsletter', 'follow us', 'share this'
  ]

  const noiseCount = noiseIndicators.filter(indicator => lower.includes(indicator)).length
  if (noiseCount > 3) {
    issues.push('Page contains significant navigation or non-job content')
    score -= 25
  }

  // Industry keyword detection (leverage existing function)
  const industry = inferIndustry(text)
  if (industry.key === 'general' && text.length > 500) {
    // If content is substantial but no industry detected, might not be a job description
    issues.push('No clear industry or job-related content detected')
    score -= 15
  }

  // Text quality: check ratio of meaningful words vs common words
  const words: string[] = lower.match(/\b[a-z]{3,}\b/g) || []
  const meaningfulWords = words.filter((w: string) => {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'try', 'use', 'she', 'put', 'end', 'why', 'let', 'say', 'ask', 'run', 'own', 'too', 'any', 'same', 'tell', 'well', 'also', 'back', 'come', 'good', 'know', 'life', 'make', 'most', 'over', 'such', 'take', 'than', 'them', 'very', 'what', 'when', 'work', 'year', 'your']
    return !stopWords.includes(w) && w.length >= 4
  })
  
  const meaningfulRatio = meaningfulWords.length / Math.max(words.length, 1)
  if (meaningfulRatio < 0.3) {
    issues.push('Low ratio of meaningful content. May contain mostly navigation or boilerplate text.')
    score -= 20
  }

  const valid = score >= 50 && issues.length < 3

  return { valid, score: Math.max(0, Math.min(100, score)), issues }
}

// Main extraction function with retry logic
export type ExtractionResult = {
  text: string
  truncated: boolean
  originalLength: number
  validation: ValidationResult
}

export async function extractJDFromUrl(url: string): Promise<ExtractionResult> {
  // Validate URL first
  validateUrl(url)

  const startTime = Date.now()
  console.log('[JD Fetch] Starting extraction from URL:', url)

  let lastError: Error | null = null
  let extractionMethod = 'jsdom'

  // Retry logic
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const ctrl = new AbortController()
      const timeoutId = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT)

      try {
        console.log(`[JD Fetch] Attempt ${attempt}/${MAX_RETRIES + 1}`)
        
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const html = await res.text()
        console.log(`[JD Fetch] Fetched HTML, length: ${html.length} bytes`)

        // Parse with JSDOM
        const dom = new JSDOM(html, url ? { url } : undefined)
        console.log('[JD Fetch] Parsed HTML with JSDOM')

        // Extract structured text
        let extractedText = extractStructuredText(dom)
        
        // Fallback to simple extraction if structured extraction is too short
        if (extractedText.trim().length < 200) {
          console.log('[JD Fetch] Structured extraction too short, using simple extraction')
          extractedText = extractMainContent(dom)
        }

        if (!extractedText || extractedText.trim().length < 50) {
          throw new Error('Could not find job description content on this page. The page may not contain a job listing, or the content structure is not recognized.')
        }

        console.log(`[JD Fetch] Extracted text, length: ${extractedText.length} characters`)

        // Smart truncation
        const { text, truncated, originalLength } = smartTruncate(extractedText, MAX_TEXT_LENGTH)
        
        if (truncated) {
          console.log(`[JD Fetch] Text truncated from ${originalLength} to ${text.length} characters`)
        }

        // Validate content
        const validation = validateJobDescription(text)
        console.log(`[JD Fetch] Validation score: ${validation.score}/100, valid: ${validation.valid}`)

        if (validation.issues.length > 0) {
          console.log('[JD Fetch] Validation issues:', validation.issues)
        }

        // Log successful extraction
        const duration = Date.now() - startTime
        logUrlFetch({
          url,
          success: true,
          duration,
          extractedLength: text.length,
          truncated,
          validationScore: validation.score,
          validationValid: validation.valid,
          method: extractionMethod
        })

        return { text, truncated, originalLength, validation }

      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The page may be slow or unavailable. Please try again or paste the job description manually.')
        }
        throw fetchError
      }

    } catch (error: any) {
      lastError = error as Error
      const errorMessage = error.message || String(error)

      // Don't retry on certain errors
      if (errorMessage.includes('security') || 
          errorMessage.includes('Invalid URL') ||
          errorMessage.includes('Invalid protocol') ||
          errorMessage.includes('HTTP 4')) { // 4xx errors are usually permanent
        throw error
      }

      // Retry on transient errors
      if (attempt <= MAX_RETRIES) {
        const delay = RETRY_DELAY_BASE * attempt
        console.log(`[JD Fetch] Attempt ${attempt} failed: ${errorMessage}. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // All retries exhausted
      const duration = Date.now() - startTime
      logUrlFetch({
        url,
        success: false,
        duration,
        error: errorMessage,
        method: extractionMethod
      })
      throw error
    }
  }

  // Should never reach here, but TypeScript needs it
  const duration = Date.now() - startTime
  logUrlFetch({
    url,
    success: false,
    duration,
    error: lastError?.message || 'Unknown error',
    method: extractionMethod
  })
  throw lastError || new Error('Failed to extract job description')
}

// Legacy function for backward compatibility (returns just text)
export async function extractJDFromUrlLegacy(url: string): Promise<string> {
  const result = await extractJDFromUrl(url)
  return result.text
}

// Industry keyword map and functions (unchanged)
const INDUSTRY_KEYWORD_MAP: Record<string, { label: string, keywords: string[] }> = {
  software: {
    label: 'Software & Technology',
    keywords: ['saas','api','microservices','kubernetes','cloud','ci','cd','microservice','devops','terraform','sre','observability','platform','javascript','typescript','react','node','golang','python','java','scala','aws','azure','gcp','docker']
  },
  data: {
    label: 'Data & Analytics',
    keywords: ['analytics','etl','datawarehouse','data-warehouse','warehouse','databricks','sql','python','spark','airflow','dbt','ml','machine','learning','modeling','statistics','tableau','powerbi','looker']
  },
  finance: {
    label: 'Finance & FinTech',
    keywords: ['fintech','payments','ledger','gaap','audit','risk','compliance','portfolio','valuation','fp&a','forecasting','treasury','derivative','capital','investment','reconciliation']
  },
  healthcare: {
    label: 'Healthcare & Life Sciences',
    keywords: ['ehr','emr','hipaa','pharma','clinical','patient','medtech','medical','healthcare','diagnostic','trial','regulatory','fda','biotech']
  },
  marketing: {
    label: 'Marketing & Growth',
    keywords: ['seo','sem','ppc','paid','campaign','crm','martech','funnel','engagement','retention','growth','copy','brand','kpi','conversion','adwords','facebook','linkedin','tiktok']
  },
  sales: {
    label: 'Sales & GTM',
    keywords: ['pipeline','quota','crm','salesforce','territory','prospecting','account','closing','negotiation','revops','enablement','deal','hunter','farmer','renewal','upsell']
  },
  operations: {
    label: 'Operations & Supply Chain',
    keywords: ['logistics','supply','chain','inventory','warehouse','fulfillment','six','sigma','lean','process','optimization','operations','manufacturing','procurement','vendor']
  },
  hr: {
    label: 'People & HR',
    keywords: ['talent','recruiting','hr','people','benefits','compensation','onboarding','employee','engagement','performance','l&d','training','culture']
  },
  legal: {
    label: 'Legal & Compliance',
    keywords: ['legal','contract','compliance','gdpr','hipaa','policy','regulatory','litigation','negotiation','privacy','intellectual','property']
  },
  education: {
    label: 'Education',
    keywords: ['curriculum','instruction','pedagogy','classroom','students','learning','education','teacher','academic','assessment','k-12','edtech']
  }
}

export type IndustryInsight = {
  key: string
  label: string
  canonicalKeywords: string[]
  jdKeywords: string[]
}

export function inferIndustry(jdText: string): IndustryInsight {
  const lower = (jdText || '').toLowerCase()
  let bestKey = 'general'
  let bestMatches: string[] = []

  for (const [key, meta] of Object.entries(INDUSTRY_KEYWORD_MAP)) {
    const matches = Array.from(new Set(meta.keywords.filter(kw => lower.includes(kw))))
    if (matches.length > bestMatches.length) {
      bestKey = key
      bestMatches = matches
    }
  }

  if (bestKey === 'general' || bestMatches.length < 2) {
    return { key: 'general', label: 'General Professional', canonicalKeywords: [], jdKeywords: [] }
  }

  const meta = INDUSTRY_KEYWORD_MAP[bestKey]
  return {
    key: bestKey,
    label: meta.label,
    canonicalKeywords: meta.keywords,
    jdKeywords: bestMatches.slice(0, 20)
  }
}

export function extractKeywords(jdText: string, topN=20): string[] {
  return extractKeywords2(jdText, topN).all
}

export function extractKeywords2(jdText: string, topN=20): { all: string[], must: string[], nice: string[], industry?: IndustryInsight } {
  const lower = (jdText||'').toLowerCase()
  const tokens = lower.match(/[a-zA-Z0-9\+#\.\-]{2,}/g) || []
  const stop = new Set(['and','the','for','with','you','our','will','are','is','to','in','of','a','an','on','as','be','by','or','we','your','this','that','at','from','preferred','requirements','responsibilities','experience'])
  const counts: Record<string, number> = {}
  for (const t of tokens) {
    if (stop.has(t)) continue
    if (t.length <= 2) continue
    counts[t] = (counts[t] || 0) + 1
  }
  let ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k])=>k)
  const industry = inferIndustry(jdText)
  const industryPriority = industry.jdKeywords || []
  const critical = ['sql','python','excel','tableau','crm','react','node','aws','azure','gcp','adwords','google','facebook','paid','seo','sem','kpi','etl','ml','terraform','salesforce','hubspot','redux','typescript','next','fastapi','django','flask','java','go','kotlin','swift','figma']
  const criticalSet = new Set([...critical, ...industryPriority])
  for (const c of critical) if (lower.includes(c) && !ranked.includes(c)) ranked.unshift(c)
  ranked = Array.from(new Set([...industryPriority, ...ranked])).slice(0, topN)
  const must = ranked.filter(k => criticalSet.has(k))
  const nice = ranked.filter(k => !criticalSet.has(k))
  return { all: ranked, must, nice, industry: industry.key === 'general' ? undefined : industry }
}
