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

export function extractKeywords(jdText: string, topN=20): string[] {
  return extractKeywords2(jdText, topN).all
}

export function extractKeywords2(jdText: string, topN=20): { all: string[], must: string[], nice: string[] } {
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
  const critical = ['sql','python','excel','tableau','crm','react','node','aws','azure','gcp','adwords','google','facebook','paid','seo','sem','kpi','etl','ml','terraform','salesforce','hubspot','redux','typescript','next','fastapi','django','flask','java','go','kotlin','swift','figma']
  for (const c of critical) if (lower.includes(c) && !ranked.includes(c)) ranked.unshift(c)
  ranked = Array.from(new Set(ranked)).slice(0, topN)
  const must = ranked.filter(k => critical.includes(k))
  const nice = ranked.filter(k => !critical.includes(k))
  return { all: ranked, must, nice }
}
