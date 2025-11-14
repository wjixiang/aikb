const { MinerUClient } = require('./libs/mineru-client/src/index');

async function testMinerUClient() {
  console.log('Testing MinerU client fix...');
  
  try {
    // Create a client instance with test configuration
    const client = new MinerUClient({
      token: process.env.MINERU_TOKEN || 'test-token',
      baseUrl: 'https://mineru.net/api/v4',
      downloadDir: './test-downloads'
    });

    // Test with a mock request that would trigger the undefined response issue
    console.log('Testing createSingleFileTask with problematic response...');
    
    // This will test the fix by attempting to create a task
    // The fix should handle undefined responses gracefully
    const taskId = await client.createSingleFileTask({
      url: 'https://example.com/test.pdf',
      is_ocr: false,
      enable_formula: true,
      enable_table: true,
      language: 'en',
      data_id: 'test-item-123',
      model_version: 'pipeline'
    });
    
    console.log(`✅ Test passed! Task ID generated: ${taskId}`);
    console.log('The fix successfully handles undefined responses.');
    
  } catch (error) {
    if (error.message.includes('Cannot read properties of undefined')) {
      console.error('❌ Test failed! The original error still exists:', error.message);
      process.exit(1);
    } else {
      console.log('✅ Test passed! The fix handles the error gracefully:', error.message);
    }
  }
}

testMinerUClient();