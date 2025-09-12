function tok(s:string){ return new Set((s.toLowerCase().match(/[a-z0-9\+#\.\-]{3,}/g)||[])) }
export function explainChanges(original:string[], tailored:string[]) {
  const o = new Set<string>(), t = new Set<string>()
  for (const b of original) for (const k of tok(b)) o.add(k)
  for (const b of tailored) for (const k of tok(b)) t.add(k)
  const added = [...t].filter(x=>!o.has(x)).slice(0,8)
  if (!added.length) return []
  return added.map(a => `Emphasized "${a}" based on JD alignment.`)
}
