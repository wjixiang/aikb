const axios = require('axios');

// Test the new API endpoints
const API_BASE_URL = 'http://localhost:3000/api';

// Wait for service to be available
async function waitForService() {
  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`Checking if service is available... (${retries} retries left)`);
      await axios.get(`${API_BASE_URL}/library-items`);
      console.log('Service is available!');
      return true;
    } catch (error) {
      console.log(`Service not ready yet: ${error.message}`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

async function testApi() {
  try {
    console.log('Testing bibliography service APIs...');
    
    // Wait for service to be available
    const serviceReady = await waitForService();
    if (!serviceReady) {
      console.error('Service is not available after multiple retries');
      return;
    }
    
    let testItemId = null;
    
    // Test 1: Create and get library item
    try {
      console.log('1. Testing GET /api/library-items/:id');
      // First we need to create a test item
      const createResponse = await axios.post(`${API_BASE_URL}/library-items`, {
        title: 'Test PDF Document',
        authors: [{ firstName: 'Test', lastName: 'Author' }],
        abstract: 'Test abstract',
        publicationYear: 2023,
        publisher: 'Test Publisher',
        tags: ['test', 'api'],
        collections: [],
        fileType: 'pdf',
        language: 'en'
      });
      
      if (createResponse.data && createResponse.data.metadata && createResponse.data.metadata.id) {
        testItemId = createResponse.data.metadata.id;
        console.log(`Created test item with ID: ${testItemId}`);
        
        // Now test getting the item
        const getResponse = await axios.get(`${API_BASE_URL}/library-items/${testItemId}`);
        console.log('✓ GET request successful');
      } else {
        console.log('✗ Create response did not contain an ID');
      }
    } catch (error) {
      console.error('✗ Error in test 1:', error.response?.data || error.message);
    }
    
    // Test 2: Update metadata
    try {
      console.log('2. Testing PUT /api/library-items/:id/metadata');
      if (testItemId) {
        const updateResponse = await axios.put(`${API_BASE_URL}/library-items/${testItemId}/metadata`, {
          pageCount: 100,
          pdfProcessingStatus: 'processing',
          pdfProcessingMessage: 'API test update'
        });
        console.log('✓ PUT metadata request successful');
      } else {
        console.log('✗ Skipping test 2: No test item ID available');
      }
    } catch (error) {
      console.error('✗ Error in test 2:', error.response?.data || error.message);
    }
    
    // Test 3: Update processing status
    try {
      console.log('3. Testing PUT /api/library-items/:id/processing-status');
      if (testItemId) {
        const statusResponse = await axios.put(`${API_BASE_URL}/library-items/${testItemId}/processing-status`, {
          status: 'completed',
          message: 'API test status update',
          progress: 100
        });
        console.log('✓ PUT processing status request successful');
      } else {
        console.log('✗ Skipping test 3: No test item ID available');
      }
    } catch (error) {
      console.error('✗ Error in test 3:', error.response?.data || error.message);
    }
    
    // Test 4: Get download URL
    try {
      console.log('4. Testing GET /api/library-items/:id/download-url');
      if (testItemId) {
        const downloadResponse = await axios.get(`${API_BASE_URL}/library-items/${testItemId}/download-url`);
        console.log('✓ GET download URL request successful');
      } else {
        console.log('✗ Skipping test 4: No test item ID available');
      }
    } catch (error) {
      console.error('✗ Error in test 4:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testApi();