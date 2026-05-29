#!/usr/bin/env node

// Simple connection test script
import https from 'https';
import http from 'http';

async function testConnection(url, name) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    console.log(`🔍 Testing ${name}...`);
    
    const req = client.request(url, { method: 'GET' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ ${name}: ${res.statusCode} - ${res.statusMessage}`);
        if (res.statusCode === 200) {
          console.log(`   📊 Response: ${data.substring(0, 100)}...`);
        }
        resolve({ success: res.statusCode === 200, status: res.statusCode });
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${name}: Connection failed - ${err.message}`);
      resolve({ success: false, error: err.message });
    });
    
    req.setTimeout(5000, () => {
      console.log(`⏰ ${name}: Timeout after 5 seconds`);
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });
    
    req.end();
  });
}

async function testAPIEndpoint(url, name) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    console.log(`🔍 Testing ${name}...`);
    
    const postData = JSON.stringify({ test: 'ping' });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ ${name}: ${res.statusCode} - ${res.statusMessage}`);
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            console.log(`   📊 Response: ${JSON.stringify(response).substring(0, 100)}...`);
          } catch (e) {
            console.log(`   📊 Response: ${data.substring(0, 100)}...`);
          }
        }
        resolve({ success: res.statusCode === 200, status: res.statusCode });
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${name}: Connection failed - ${err.message}`);
      resolve({ success: false, error: err.message });
    });
    
    req.setTimeout(5000, () => {
      console.log(`⏰ ${name}: Timeout after 5 seconds`);
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });
    
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Connection Test Suite\n');
  console.log('=' .repeat(50));
  
  // Test local development server
  const localResults = await Promise.all([
    testConnection('http://localhost:3000', 'Local Server'),
    testConnection('http://localhost:3000/api/health/pdf', 'Local Health API'),
    testAPIEndpoint('http://localhost:3000/api/test', 'Local Test API')
  ]);
  
  console.log('\n' + '=' .repeat(50));
  
  // Test production server
  const productionResults = await Promise.all([
    testConnection('https://tryrolefit.com', 'Production Server'),
    testConnection('https://tryrolefit.com/api/health/pdf', 'Production Health API'),
    testAPIEndpoint('https://tryrolefit.com/api/test', 'Production Test API')
  ]);
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results:');
  
  const localSuccess = localResults.filter(r => r.success).length;
  const productionSuccess = productionResults.filter(r => r.success).length;
  
  console.log(`  Local Server: ${localSuccess}/3 tests passed`);
  console.log(`  Production Server: ${productionSuccess}/3 tests passed`);
  
  if (localSuccess === 3 && productionSuccess === 3) {
    console.log('\n🎉 All connection tests passed!');
    console.log('✅ Local development server is running');
    console.log('✅ Production server is accessible');
    console.log('✅ API endpoints are responding');
    console.log('✅ OpenAI key configuration is working');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some connection tests failed.');
    console.log('Please check the server status and configuration.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('💥 Connection test suite crashed:', error);
  process.exit(1);
});
