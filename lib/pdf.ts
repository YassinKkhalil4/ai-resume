import { minimalTemplate } from './templates/minimal'
import { modernTemplate } from './templates/modern'
import { classicTemplate } from './templates/classic'
import type { ResumeJSON } from './types'

export async function renderHTML(
  resume: ResumeJSON,
  template: 'classic' | 'modern' | 'minimal',
  options: { includeSkills: boolean; includeSummary: boolean }
) {
  if (template === 'classic') return classicTemplate(resume, options)
  if (template === 'modern') return modernTemplate(resume, options)
  return minimalTemplate(resume, options)
}

export async function htmlToPDF(html: string): Promise<Buffer> {
  const useLambda = process.env.USE_LAMBDA_CHROMIUM === '1'

  // Lambda / Vercel Functions path: puppeteer-core + @sparticuz/chromium
  if (useLambda) {
    // NOTE: keep these deps in "dependencies" (not devDependencies)
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteerCore = (await import('puppeteer-core')).default

    let browser: import('puppeteer-core').Browser | undefined
    try {
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      })

      const page = await browser.newPage()
      await page.setCacheEnabled(false)
      await page.emulateMediaType('screen')
      // Avoid networkidle0 (can hang on serverless)
      await page.setContent(html, { waitUntil: 'domcontentloaded' })

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
      })
      return pdf
    } finally {
      if (browser) await browser.close().catch(() => {})
    }
  }

  // Local dev / full VM path: full puppeteer (downloads Chrome on your machine)
  const puppeteer = (await import('puppeteer')).default
  let browser: import('puppeteer').Browser | undefined
  try {
    browser = await puppeteer.launch({
      headless: true,
      // harmless locally; useful if you ever run this in a docker/VM without sandbox
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setCacheEnabled(false)
    await page.emulateMediaType('screen')
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    })
    return pdf
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}