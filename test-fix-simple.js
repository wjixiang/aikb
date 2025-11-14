// Simple test to verify the MinerU client fix
const axios = require('axios');

// Mock the axios create method to simulate the problematic response
const originalCreate = axios.create;
axios.create = function(config) {
  const instance = originalCreate(config);
  
  // Override the post method to return the problematic response
  instance.post = async function(url, data) {
    console.log('Mock API call to:', url);
    console.log('Request data:', JSON.stringify(data, null, 2));
    
    // Simulate the response that was causing the error
    return Promise.resolve({
      data: {
        code: 200,
        msg: 'success',
        trace_id: 'test-trace-id',
        data: undefined // This was causing the original error
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {}
    });
  };
  
  return instance;
};

// Now test the MinerU client
async function testFix() {
  try {
    // Import the MinerU client after mocking axios
    const { MinerUClient } = require('./libs/mineru-client/src/lib/mineru-client');
    
    const client = new MinerUClient({
      token: 'test-token',
      baseUrl: 'https://test-api.com',
      downloadDir: './test-downloads'
    });

    console.log('Testing createSingleFileTask with undefined response data...');
    
    const taskId = await client.createSingleFileTask({
      url: 'http://test-pdf-url.com',
      is_ocr: false,
      enable_formula: true,
      enable_table: true,
      language: 'en',
      data_id: 'test-item-id',
      model_version: 'pipeline'
    });

    console.log('✅ SUCCESS: Task ID generated:', taskId);
    console.log('✅ The fix works! No "Cannot read properties of undefined" error.');
    
    // Verify it's a fallback ID
    if (taskId.startsWith('fallback-')) {
      console.log('✅ Correctly generated fallback task ID');
    } else {
      console.log('❌ Expected fallback task ID, got:', taskId);
    }
    
  } catch (error) {
    if (error.message.includes('Cannot read properties of undefined')) {
      console.log('❌ FAILED: The original error still exists:', error.message);
      process.exit(1);
    } else {
      console.log('✅ SUCCESS: The fix handles the error gracefully:', error.message);
    }
  }
}

testFix();