#!/usr/bin/env node

// Test script to check OpenAI key configuration and functionality
import OpenAI from 'openai';

async function testOpenAIKey() {
  console.log('🔍 Testing OpenAI Key Configuration...\n');
  
  // Check environment variables
  const apiKey = process.env.OPENAI_API_KEY;
  const projectId = process.env.OPENAI_PROJECT_ID;
  const orgId = process.env.OPENAI_ORG_ID;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  console.log('📋 Environment Variables:');
  console.log(`  OPENAI_API_KEY: ${apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT SET'}`);
  console.log(`  OPENAI_PROJECT_ID: ${projectId || 'NOT SET'}`);
  console.log(`  OPENAI_ORG_ID: ${orgId || 'NOT SET'}`);
  console.log(`  OPENAI_MODEL: ${model}`);
  console.log('');
  
  // Validate key format
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set');
    return false;
  }
  
  if (!apiKey.startsWith('sk-')) {
    console.error('❌ OPENAI_API_KEY does not start with "sk-"');
    return false;
  }
  
  if (apiKey.startsWith('sk-proj-')) {
    console.log('✅ Using OpenAI Project Key (recommended for production)');
  } else if (apiKey.startsWith('sk-')) {
    console.log('⚠️  Using OpenAI Personal Key (consider upgrading to project key)');
  }
  
  // Test OpenAI client initialization
  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      project: projectId,
      organization: orgId
    });
    
    console.log('✅ OpenAI client initialized successfully');
    
    // Test a simple API call
    console.log('🧪 Testing API call...');
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello, OpenAI API test successful!" and nothing else.'
        }
      ],
      max_tokens: 20,
      temperature: 0
    });
    
    const content = response.choices[0]?.message?.content;
    if (content && content.includes('successful')) {
      console.log('✅ API call successful');
      console.log(`📝 Response: "${content}"`);
    } else {
      console.log('⚠️  API call returned unexpected response');
      console.log(`📝 Response: "${content}"`);
    }
    
    // Check usage
    if (response.usage) {
      console.log('📊 Token Usage:');
      console.log(`  Prompt tokens: ${response.usage.prompt_tokens}`);
      console.log(`  Completion tokens: ${response.usage.completion_tokens}`);
      console.log(`  Total tokens: ${response.usage.total_tokens}`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ OpenAI API test failed:');
    console.error(`  Error: ${error.message}`);
    
    if (error.status) {
      console.error(`  Status: ${error.status}`);
    }
    
    if (error.code) {
      console.error(`  Code: ${error.code}`);
    }
    
    // Common error scenarios
    if (error.message.includes('Invalid API key')) {
      console.error('  💡 The API key appears to be invalid');
    } else if (error.message.includes('Insufficient credits')) {
      console.error('  💡 Insufficient credits on the OpenAI account');
    } else if (error.message.includes('Rate limit')) {
      console.error('  💡 Rate limit exceeded');
    } else if (error.message.includes('Project not found')) {
      console.error('  💡 Project ID may be incorrect');
    } else if (error.message.includes('Organization not found')) {
      console.error('  💡 Organization ID may be incorrect');
    }
    
    return false;
  }
}

// Test the application's OpenAI configuration
async function testAppConfiguration() {
  console.log('\n🔧 Testing Application Configuration...\n');
  
  try {
    // Test the app's OpenAI client
    const { getOpenAI, OPENAI_MODEL } = await import('./lib/openai.ts');
    
    console.log(`📋 App Model: ${OPENAI_MODEL}`);
    
    const client = getOpenAI();
    if (client) {
      console.log('✅ App OpenAI client created successfully');
      
      // Test with app's configuration
      const response = await client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'user',
            content: 'Test message for app configuration'
          }
        ],
        max_tokens: 10
      });
      
      console.log('✅ App configuration test successful');
      return true;
    } else {
      console.error('❌ App OpenAI client creation failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ App configuration test failed:');
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 OpenAI Key and Configuration Test Suite\n');
  console.log('=' .repeat(50));
  
  const basicTest = await testOpenAIKey();
  const appTest = await testAppConfiguration();
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results:');
  console.log(`  Basic OpenAI Test: ${basicTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  App Configuration Test: ${appTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (basicTest && appTest) {
    console.log('\n🎉 All tests passed! OpenAI configuration is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the configuration.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Test suite crashed:', error);
  process.exit(1);
});
