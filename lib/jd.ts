export async function extractJDFromUrl(url: string): Promise<string> {
  const u = new URL(url)
  if (!/^https?:$/.test(u.protocol)) throw new Error('Invalid protocol')

  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 AI-Resume-Tailor' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g,' ')
      .replace(/<style[\s\S]*?<\/style>/g,' ')
      .replace(/<[^>]+>/g,' ')
      .replace(/\s+/g,' ')
    return text.slice(0, 5000)
  } finally {
    clearTimeout(to)
  }
}

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
