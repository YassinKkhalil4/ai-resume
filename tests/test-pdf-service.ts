#!/usr/bin/env tsx
/**
 * Test script for PDF generation service
 * Tests PDFShift integration and fallback mechanisms
 * 
 * Usage:
 *   npx tsx test-pdf-service.ts
 * 
 * Environment variables required:
 *   PDF_SERVICE_API_KEY - Your PDFShift API key
 *   PDF_SERVICE_URL - Optional, defaults to PDFShift API
 */

import { htmlToPDF, renderTemplateHTML } from '../lib/pdf-service-v2'
import { normalizeTailored } from '../lib/export-normalize'
import * as fs from 'fs'
import * as path from 'path'

// Test HTML content
const testHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        font-size: 12pt;
        line-height: 1.35;
        color: #111;
        margin: 0;
        padding: 32px;
        background: #fff;
      }
      h1 {
        margin: 0 0 4pt;
        font-size: 22pt;
        font-weight: 700;
        color: #0f172a;
      }
      h2 {
        margin: 16pt 0 6pt;
        font-size: 12pt;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
        color: #1e293b;
      }
      .contact {
        margin-top: 6pt;
        font-size: 10pt;
        color: #334155;
      }
      ul {
        margin: 6pt 0 0 16pt;
        padding: 0;
        list-style: disc;
      }
      li {
        margin: 0 0 4pt;
      }
      p {
        margin: 0 0 6pt;
      }
    </style>
  </head>
  <body>
    <h1>John Doe</h1>
    <div class="contact">
      <a href="mailto:john.doe@example.com">john.doe@example.com</a> • 
      <a href="tel:+1234567890">+1 (234) 567-890</a> • 
      <span>San Francisco, CA</span>
    </div>
    
    <section>
      <h2>Summary</h2>
      <p>Experienced software engineer with 5+ years of expertise in full-stack development, cloud architecture, and team leadership.</p>
    </section>
    
    <section>
      <h2>Experience</h2>
      <div class="exp">
        <div class="exp-h">
          <strong>Senior Software Engineer</strong> &mdash; Tech Corp
          <span class="meta">2020 - Present • San Francisco, CA</span>
        </div>
        <ul>
          <li>Led development of microservices architecture serving 1M+ users</li>
          <li>Reduced API response time by 40% through optimization and caching</li>
          <li>Mentored team of 3 junior developers</li>
        </ul>
      </div>
      <div class="exp">
        <div class="exp-h">
          <strong>Software Engineer</strong> &mdash; Startup Inc
          <span class="meta">2018 - 2020 • Remote</span>
        </div>
        <ul>
          <li>Built RESTful APIs using Node.js and Express</li>
          <li>Implemented CI/CD pipelines reducing deployment time by 60%</li>
        </ul>
      </div>
    </section>
    
    <section>
      <h2>Skills</h2>
      <ul>
        <li>JavaScript, TypeScript, Node.js, React</li>
        <li>AWS, Docker, Kubernetes</li>
        <li>PostgreSQL, MongoDB, Redis</li>
      </ul>
    </section>
    
    <section>
      <h2>Education</h2>
      <p>Bachelor of Science in Computer Science<br>University of California, Berkeley (2018)</p>
    </section>
  </body>
</html>
`

// Test with actual resume data structure
const testResumeData = {
  contact: {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY'
  },
  summary: 'Full-stack developer specializing in React and Node.js with a passion for building scalable applications.',
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
  experience: [
    {
      company: 'Acme Corp',
      role: 'Senior Full-Stack Developer',
      dates: '2021 - Present',
      location: 'New York, NY',
      bullets: [
        'Developed and maintained React-based frontend applications',
        'Built RESTful APIs using Node.js and Express',
        'Improved application performance by 50% through optimization'
      ]
    },
    {
      company: 'Tech Solutions',
      role: 'Full-Stack Developer',
      dates: '2019 - 2021',
      location: 'Remote',
      bullets: [
        'Created responsive web applications using React and TypeScript',
        'Collaborated with cross-functional teams to deliver features on time'
      ]
    }
  ],
  education: ['Master of Science in Computer Science - MIT (2019)'],
  certifications: ['AWS Certified Solutions Architect', 'Docker Certified Associate'],
  projects: [],
  additional_sections: []
}

async function testPDFGeneration() {
  console.log('🧪 PDF Generation Test Suite\n')
  console.log('=' .repeat(60))
  
  // Check environment variables
  console.log('\n📋 Environment Check:')
  const apiKey = process.env.PDF_SERVICE_API_KEY
  const apiUrl = process.env.PDF_SERVICE_URL
  const serviceType = process.env.PDF_SERVICE_TYPE || 'pdfshift'
  
  if (apiKey) {
    console.log(`✅ PDF_SERVICE_API_KEY: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`)
  } else {
    console.log('❌ PDF_SERVICE_API_KEY: NOT SET')
    console.log('   Set it in .env.local or environment variables')
  }
  
  console.log(`✅ PDF_SERVICE_URL: ${apiUrl || 'https://api.pdfshift.io/v3/convert/pdf'}`)
  console.log(`✅ PDF_SERVICE_TYPE: ${serviceType}`)
  console.log(`✅ VERCEL: ${process.env.VERCEL === '1' ? 'Yes (serverless)' : 'No (local)'}`)
  
  // Test 1: Simple HTML to PDF
  console.log('\n' + '='.repeat(60))
  console.log('Test 1: Simple HTML to PDF')
  console.log('='.repeat(60))
  
  try {
    console.log('Generating PDF from test HTML...')
    const startTime = Date.now()
    const pdfBuffer = await htmlToPDF(testHTML)
    const duration = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty')
    }
    
    const outputPath = path.join(process.cwd(), 'test-output-simple.pdf')
    fs.writeFileSync(outputPath, pdfBuffer)
    
    console.log(`✅ Success!`)
    console.log(`   Size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`)
    console.log(`   Duration: ${duration}ms`)
    console.log(`   Saved to: ${outputPath}`)
  } catch (error: any) {
    console.error(`❌ Failed: ${error.message}`)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
  
  // Test 2: Resume data structure to PDF
  console.log('\n' + '='.repeat(60))
  console.log('Test 2: Resume Data Structure to PDF')
  console.log('='.repeat(60))
  
  try {
    console.log('Normalizing resume data...')
    const normalized = normalizeTailored(testResumeData)
    
    console.log('Rendering HTML template...')
    const html = renderTemplateHTML(normalized, 'modern', {
      includeSummary: true,
      includeSkills: true
    })
    
    console.log('Generating PDF...')
    const startTime = Date.now()
    const pdfBuffer = await htmlToPDF(html)
    const duration = Date.now() - startTime
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty')
    }
    
    const outputPath = path.join(process.cwd(), 'test-output-resume.pdf')
    fs.writeFileSync(outputPath, pdfBuffer)
    
    console.log(`✅ Success!`)
    console.log(`   Size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`)
    console.log(`   Duration: ${duration}ms`)
    console.log(`   Saved to: ${outputPath}`)
  } catch (error: any) {
    console.error(`❌ Failed: ${error.message}`)
    if (error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
  
  // Test 3: Error handling - empty HTML
  console.log('\n' + '='.repeat(60))
  console.log('Test 3: Error Handling (Empty HTML)')
  console.log('='.repeat(60))
  
  try {
    await htmlToPDF('')
    console.error('❌ Should have thrown an error for empty HTML')
  } catch (error: any) {
    console.log(`✅ Correctly caught error: ${error.message}`)
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Summary')
  console.log('='.repeat(60))
  console.log('Check the generated PDF files:')
  console.log('  - test-output-simple.pdf')
  console.log('  - test-output-resume.pdf')
  console.log('\n✅ All tests completed!')
}

// Run tests
testPDFGeneration().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

