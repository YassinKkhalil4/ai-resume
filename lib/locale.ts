export function detectLocale(text: string): 'en'|'fr'|'es'|'ar' {
  const t = (text||'').toLowerCase()
  const fr = [' le ', ' la ', ' et ', ' avec ', ' expérience', ' gestion']
  const es = [' el ', ' la ', ' con ', ' experiencia', 'gestión']
  const ar = [' و ', ' خبرة', 'إدارة', 'ال']
  let score = { en: 0, fr: 0, es: 0, ar: 0 }
  for (const w of fr) if (t.includes(w)) score.fr++
  for (const w of es) if (t.includes(w)) score.es++
  for (const w of ar) if (t.includes(w)) score.ar++
  if (score.fr>score.es && score.fr>score.ar) return 'fr'
  if (score.es>score.fr && score.es>score.ar) return 'es'
  if (score.ar>score.fr && score.ar>score.es) return 'ar'
  return 'en'
}
