#!/usr/bin/env node

// Test OpenAI client configuration
import OpenAI from 'openai';

console.log('🔍 Testing OpenAI Client Configuration\n');

// Test 1: Check environment variables
console.log('📋 Environment Variables:');
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  OPENAI_PROJECT_ID: ${process.env.OPENAI_PROJECT_ID ? 'SET' : 'NOT SET'}`);
console.log(`  OPENAI_ORG_ID: ${process.env.OPENAI_ORG_ID ? 'SET' : 'NOT SET'}`);
console.log(`  OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'NOT SET'}`);

// Test 2: Try to create OpenAI client with project configuration
console.log('\n🔧 Testing OpenAI Client Creation:');

try {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
    organization: process.env.OPENAI_ORG_ID
  });
  console.log('✅ OpenAI client created successfully');
  
  // Test 3: Try a simple API call
  console.log('\n🚀 Testing API Call:');
  
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello, test message' }],
    max_tokens: 10
  });
  
  console.log('✅ API call successful');
  console.log(`📊 Response: ${response.choices[0].message.content}`);
  console.log(`📊 Tokens used: ${response.usage.total_tokens}`);
  
} catch (error) {
  console.log('❌ OpenAI client creation or API call failed:');
  console.log(`   Error: ${error.message}`);
  console.log(`   Type: ${error.constructor.name}`);
  
  if (error.message.includes('project')) {
    console.log('\n💡 Suggestion: Make sure OPENAI_PROJECT_ID is set correctly');
  }
  if (error.message.includes('organization')) {
    console.log('\n💡 Suggestion: Make sure OPENAI_ORG_ID is set correctly');
  }
  if (error.message.includes('apiKey')) {
    console.log('\n💡 Suggestion: Make sure OPENAI_API_KEY is set correctly');
  }
}

console.log('\n🏁 Test completed');
