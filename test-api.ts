#!/usr/bin/env tsx

// Test script to check API endpoints with OpenAI project key
import fs from 'fs';
import path from 'path';

async function testTailorAPI() {
  console.log('🧪 Testing Tailor API Endpoint...\n');
  
  try {
    // Create a test resume file
    const testResume = `John Doe
Software Engineer
john.doe@email.com
(555) 123-4567

EXPERIENCE
Software Engineer at Tech Corp (2020-2023)
• Developed web applications using React and Node.js
• Led a team of 5 engineers to deliver features on time
• Improved application performance by 40%

Junior Developer at Startup Inc (2018-2020)
• Built microservices architecture for enterprise clients
• Mentored junior developers and conducted code reviews
• Reduced system downtime by 60%

SKILLS
JavaScript, TypeScript, React, Node.js, Python, AWS, Docker, Git

EDUCATION
Bachelor of Science in Computer Science
University of Technology (2018)`;

    const testJD = `We are looking for a Senior Software Engineer to join our team.

Requirements:
- 5+ years of experience in software development
- Strong experience with React, Node.js, and TypeScript
- Experience with cloud platforms (AWS, Azure, or GCP)
- Experience with microservices architecture
- Strong leadership and mentoring skills
- Experience with performance optimization
- Knowledge of Docker and containerization
- Strong problem-solving and communication skills

Responsibilities:
- Lead development of scalable web applications
- Mentor junior developers
- Optimize application performance
- Work with cross-functional teams
- Implement best practices and code reviews`;

    // Create FormData
    const formData = new FormData();
    const resumeBlob = new Blob([testResume], { type: 'text/plain' });
    formData.append('resume_file', resumeBlob, 'test-resume.txt');
    formData.append('jd_text', testJD);
    formData.append('tone', 'professional');

    console.log('📤 Sending request to /api/tailor...');
    
    const response = await fetch('http://localhost:3000/api/tailor', {
      method: 'POST',
      body: formData,
      headers: {
        'x-invite-code': 'X3P9F2' // Use one of the invite codes from .env.local
      }
    });

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:');
      console.error(`  Status: ${response.status}`);
      console.error(`  Error: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log('✅ API request successful!');
    
    // Validate response structure
    const requiredFields = ['session_id', 'original_sections_json', 'preview_sections_json', 'keyword_stats'];
    const missingFields = requiredFields.filter(field => !(field in data));
    
    if (missingFields.length > 0) {
      console.error('❌ Response missing required fields:', missingFields);
      return false;
    }
    
    console.log('✅ Response structure is valid');
    console.log(`📋 Session ID: ${data.session_id}`);
    console.log(`📋 Original Experience Count: ${data.original_sections_json?.experience?.length || 0}`);
    console.log(`📋 Tailored Experience Count: ${data.preview_sections_json?.experience?.length || 0}`);
    console.log(`📋 Original Coverage: ${((data.keyword_stats?.original?.coverage || 0) * 100).toFixed(1)}%`);
    console.log(`📋 Tailored Coverage: ${((data.keyword_stats?.tailored?.coverage || 0) * 100).toFixed(1)}%`);
    console.log(`📋 Coverage Delta: ${((data.keyword_stats?.deltas?.coverage || 0) * 100).toFixed(1)} pts`);
    
    if (data.ai_tokens_used) {
      console.log(`📊 AI Tokens Used: ${data.ai_tokens_used}`);
    }
    
    if (data.ai_error) {
      console.log(`⚠️  AI Error: ${data.ai_error}`);
    }
    
    return true;
    
  } catch (error: any) {
    console.error('❌ Test failed with error:');
    console.error(`  Error: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack}`);
    }
    return false;
  }
}

async function testProcessExperienceAPI() {
  console.log('\n🧪 Testing Process Experience API Endpoint...\n');
  
  try {
    const testExperience = `Software Engineer at Tech Corp (2020-2023)
• Developed web applications using React and Node.js
• Led a team of 5 engineers to deliver features on time
• Improved application performance by 40%

Senior Developer at Startup Inc (2018-2020)
• Built microservices architecture for enterprise clients
• Mentored junior developers and conducted code reviews
• Reduced system downtime by 60%`;

    const testJD = `We are looking for a Senior Software Engineer with React and Node.js experience.`;

    const requestBody = {
      experienceText: testExperience,
      jdText: testJD,
      tone: 'professional'
    };

    console.log('📤 Sending request to /api/process-experience...');
    
    const response = await fetch('http://localhost:3000/api/process-experience', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-invite-code': 'X3P9F2'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📊 Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:');
      console.error(`  Status: ${response.status}`);
      console.error(`  Error: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log('✅ API request successful!');
    
    console.log(`📋 Session ID: ${data.session_id}`);
    console.log(`📋 Extracted Experience Count: ${data.extracted_experience_count || 0}`);
    console.log(`📋 AI Tokens Used: ${data.tokens_used || 0}`);
    
    return true;
    
  } catch (error: any) {
    console.error('❌ Test failed with error:');
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

async function testProcessLineSelectionsAPI() {
  console.log('\n🧪 Testing Process Line Selections API Endpoint...\n');
  
  try {
    const testResumeText = `John Doe
Software Engineer
john.doe@email.com

EXPERIENCE
Software Engineer at Tech Corp (2020-2023)
• Developed web applications using React and Node.js
• Led a team of 5 engineers to deliver features on time

SKILLS
JavaScript, TypeScript, React, Node.js`;

    const testJD = `We are looking for a Software Engineer with React experience.`;

    const selectedLines = [
      { lineIndex: 0, lineText: 'Software Engineer at Tech Corp (2020-2023)', type: 'company' },
      { lineIndex: 1, lineText: '• Developed web applications using React and Node.js', type: 'bullet' },
      { lineIndex: 2, lineText: '• Led a team of 5 engineers to deliver features on time', type: 'bullet' }
    ];

    const requestBody = {
      resumeText: testResumeText,
      selectedLines: selectedLines,
      jdText: testJD,
      tone: 'professional'
    };

    console.log('📤 Sending request to /api/process-line-selections...');
    
    const response = await fetch('http://localhost:3000/api/process-line-selections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-invite-code': 'X3P9F2'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📊 Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API request failed:');
      console.error(`  Status: ${response.status}`);
      console.error(`  Error: ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log('✅ API request successful!');
    
    console.log(`📋 Session ID: ${data.session_id}`);
    console.log(`📋 Processing Summary:`, data.processing_summary);
    console.log(`📋 AI Tokens Used: ${data.tokens_used || 0}`);
    
    return true;
    
  } catch (error: any) {
    console.error('❌ Test failed with error:');
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

// Main test function
async function runAPITests() {
  console.log('🚀 API Endpoint Test Suite with OpenAI Project Key\n');
  console.log('=' .repeat(60));
  
  const tailorTest = await testTailorAPI();
  const experienceTest = await testProcessExperienceAPI();
  const lineSelectionsTest = await testProcessLineSelectionsAPI();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 API Test Results:');
  console.log(`  Tailor API: ${tailorTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Process Experience API: ${experienceTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Process Line Selections API: ${lineSelectionsTest ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = tailorTest && experienceTest && lineSelectionsTest;
  
  if (allPassed) {
    console.log('\n🎉 All API tests passed! OpenAI project key is working correctly with all endpoints.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some API tests failed. Please check the configuration.');
    process.exit(1);
  }
}

// Run the tests
runAPITests().catch(error => {
  console.error('💥 API test suite crashed:', error);
  process.exit(1);
});
