#!/usr/bin/env node

/**
 * Test script to verify the applied fixes work correctly
 * Run with: node test-fixes.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Applied Fixes...\n');

// Test 1: Check if new files exist
console.log('1. Checking new files exist...');
const newFiles = [
  'lib/pdf-service.ts',
  'lib/ai-response-parser.ts',
  'FIXES_APPLIED.md'
];

newFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file} exists`);
  } else {
    console.log(`   ❌ ${file} missing`);
  }
});

// Test 2: Check package.json changes
console.log('\n2. Checking package.json changes...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Check if Puppeteer dependencies were removed
  const hasPuppeteer = packageJson.dependencies['puppeteer'] || packageJson.dependencies['puppeteer-core'];
  const hasChromium = packageJson.dependencies['@sparticuz/chromium'];
  
  if (!hasPuppeteer && !hasChromium) {
    console.log('   ✅ Puppeteer dependencies removed');
  } else {
    console.log('   ❌ Puppeteer dependencies still present');
  }
  
  // Check if html-pdf-node was added
  if (packageJson.dependencies['html-pdf-node']) {
    console.log('   ✅ html-pdf-node dependency added');
  } else {
    console.log('   ❌ html-pdf-node dependency missing');
  }
} catch (error) {
  console.log('   ❌ Error reading package.json:', error.message);
}

// Test 3: Check if imports were updated
console.log('\n3. Checking import updates...');
try {
  const tailorRoute = fs.readFileSync('app/api/tailor/route.ts', 'utf8');
  const exportRoute = fs.readFileSync('app/api/export/route.ts', 'utf8');
  
  if (tailorRoute.includes('getTailoredResume')) {
    console.log('   ✅ Tailor route uses new AI parser');
  } else {
    console.log('   ❌ Tailor route not updated');
  }
  
  if (exportRoute.includes('pdf-service')) {
    console.log('   ✅ Export route uses new PDF service');
  } else {
    console.log('   ❌ Export route not updated');
  }
} catch (error) {
  console.log('   ❌ Error checking route files:', error.message);
}

// Test 4: Check telemetry enhancements
console.log('\n4. Checking telemetry enhancements...');
try {
  const telemetry = fs.readFileSync('lib/telemetry.ts', 'utf8');
  
  const hasLogAIResponse = telemetry.includes('logAIResponse');
  const hasLogPDFGeneration = telemetry.includes('logPDFGeneration');
  const hasLogError = telemetry.includes('logError');
  
  if (hasLogAIResponse && hasLogPDFGeneration && hasLogError) {
    console.log('   ✅ Enhanced telemetry functions added');
  } else {
    console.log('   ❌ Telemetry enhancements incomplete');
  }
} catch (error) {
  console.log('   ❌ Error checking telemetry:', error.message);
}

console.log('\n🎉 Fix verification complete!');
console.log('\nNext steps:');
console.log('1. Run: npm install');
console.log('2. Test the application with: npm run dev');
console.log('3. Check logs in /tmp/ for monitoring data');
console.log('4. Verify PDF generation works without Puppeteer');
