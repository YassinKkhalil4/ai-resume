#!/usr/bin/env node

/**
 * Test script to verify the export fix works
 * This simulates the export API call to check for JSON parsing issues
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://tryrolefit.com';

async function testExportAPI() {
  console.log('🧪 Testing Export API Fix...\n');

  // Test 1: Check if the API endpoint is accessible
  console.log('1. Testing API endpoint accessibility...');
  try {
    const response = await fetch(`${BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: 'test-session-id',
        template: 'minimal',
        format: 'pdf',
        options: { includeSummary: true, includeSkills: true }
      })
    });

    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response length: ${responseText.length}`);
    
    // Try to parse as JSON
    try {
      const jsonData = JSON.parse(responseText);
      console.log('   ✅ Response is valid JSON');
      console.log('   Response keys:', Object.keys(jsonData));
      
      if (jsonData.error) {
        console.log('   ⚠️  API returned error (expected for test session):', jsonData.error);
      } else {
        console.log('   ✅ API response looks good');
      }
    } catch (parseError) {
      console.log('   ❌ Response is not valid JSON:', parseError.message);
      console.log('   Raw response:', responseText.substring(0, 200));
    }
    
  } catch (error) {
    console.log('   ❌ Failed to test API:', error.message);
  }

  console.log('\n2. Testing error handling...');
  try {
    const response = await fetch(`${BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Missing session_id to trigger error
        template: 'minimal',
        format: 'pdf'
      })
    });

    const responseText = await response.text();
    console.log(`   Status: ${response.status}`);
    
    try {
      const jsonData = JSON.parse(responseText);
      console.log('   ✅ Error response is valid JSON');
      console.log('   Error message:', jsonData.error);
    } catch (parseError) {
      console.log('   ❌ Error response is not valid JSON:', parseError.message);
    }
    
  } catch (error) {
    console.log('   ❌ Failed to test error handling:', error.message);
  }

  console.log('\n🎉 Export API test complete!');
  console.log('\nIf you see "Response is valid JSON" above, the JSON parsing issue should be fixed.');
  console.log('The "Unexpected end of JSON input" error should no longer occur.');
}

// Run the test
testExportAPI().catch(console.error);
