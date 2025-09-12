import fs from 'fs'
import path from 'path'
import { extractKeywords2 } from '../lib/jd'

const FIX = path.join(process.cwd(), 'qa/fixtures')
const resumes = fs.readdirSync(path.join(FIX, 'resumes')).map(f=>path.join(FIX, 'resumes', f))
const jds = fs.readdirSync(path.join(FIX, 'jds')).map(f=>path.join(FIX, 'jds', f))

function read(p:string){ return fs.readFileSync(p, 'utf8') }

function coverage(resumeText:string, all:string[]){
  const r = resumeText.toLowerCase()
  const matched = all.filter(k => r.includes(k.toLowerCase()))
  return matched.length / (all.length||1)
}

;(async () => {
  const results:any[] = []
  for (const r of resumes) {
    for (const j of jds) {
      const rText = read(r), jText = read(j)
      const { all } = extractKeywords2(jText, 20)
      const cov = coverage(rText, all)
      results.push({ resume: path.basename(r), jd: path.basename(j), baseline_cov: Number((cov*100).toFixed(1)) })
    }
  }
  const outDir = path.join(process.cwd(), 'qa', 'results')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'baseline.json'), JSON.stringify(results, null, 2))
  const summary = `# QA Summary\n\nPairs: ${results.length}\nBaseline coverage avg: ${ (results.reduce((a,b)=>a+b.baseline_cov,0)/results.length).toFixed(1) }%\n`
  fs.writeFileSync(path.join(process.cwd(), 'qa', 'summary.md'), summary)
  console.log('QA done. See qa/results and qa/summary.md')
})()
