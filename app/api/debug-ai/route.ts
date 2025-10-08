import { NextRequest, NextResponse } from 'next/server'
import { getTailoredResume } from '../../../lib/ai-response-parser'
import { ResumeJSON } from '../../../lib/types'

export async function POST(req: NextRequest) {
  try {
    console.log('Debug AI API called')
    
    // Create a simple test resume
    const testResume: ResumeJSON = {
      summary: '',
      skills: ['JavaScript', 'React', 'Node.js'],
      experience: [{
        role: 'Software Engineer',
        company: 'Tech Corp',
        dates: '2020-2024',
        bullets: ['Developed web applications using React and Node.js']
      }],
      education: [],
      certifications: []
    }
    
    console.log('Testing AI call with test resume...')
    
    // Test AI call
    const { tailored, tokens } = await getTailoredResume(testResume, 'Looking for a senior developer with React experience', 'professional')
    
    console.log('AI call successful', {
      hasSummary: !!tailored.summary,
      skillsCount: tailored.skills_section?.length || 0,
      experienceCount: tailored.experience?.length || 0,
      tokens
    })
    
    return NextResponse.json({
      status: 'success',
      message: 'AI call working',
      data: {
        tailored: tailored,
        tokens: tokens
      }
    })
    
  } catch (error: any) {
    console.error('Debug AI API error:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
