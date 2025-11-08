#!/usr/bin/env node
require('ts-node/register');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');
const dotenv = require('dotenv');

dotenv.config();

// Verify required environment variables
if (!process.env.MILVUS_URI) {
  console.error('MILVUS_URI environment variable is required');
  process.exit(1);
}

// Initialize Milvus client with same config as milvusCollectionOperator
const milvusClient = new MilvusClient({
  address: '127.0.0.1:19530', // Force IPv4 gRPC connection
  timeout: 30000,
  username: process.env.MILVUS_USERNAME,
  password: process.env.MILVUS_PASSWORD,
  token: process.env.TOKEN,
  secure: false, // Disable TLS
});

// Test collection name
const TEST_COLLECTION = 'test_collection_cli';

async function testConnection() {
  try {
    const res = await milvusClient.hasCollection({
      collection_name: 'non_existent_collection',
    });
    console.log('✓ Successfully connected to Milvus server');
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('✗ Failed to connect to Milvus server:', err.message);
    console.error('Milvus Configuration:', {
      address: process.env.MILVUS_URI,
      username: process.env.MILVUS_USERNAME,
      // password: process.env.MILVUS_PASSWORD, // Omit password for security
      token: process.env.TOKEN,
    });
    return false;
  }
}

async function testCollectionOperations() {
  try {
    // Create collection
    const createRes = await milvusClient.createCollection({
      collection_name: TEST_COLLECTION,
      fields: [
        {
          name: 'id',
          data_type: 'Int64',
          is_primary_key: true,
        },
        {
          name: 'vector',
          data_type: 'FloatVector',
          type_params: {
            dim: '128',
          },
        },
      ],
    });

    if (createRes.error_code !== 'Success') {
      throw new Error(`Create collection failed: ${createRes.reason}`);
    }
    console.log('✓ Successfully created test collection');

    // Check collection exists
    const hasRes = await milvusClient.hasCollection({
      collection_name: TEST_COLLECTION,
    });

    if (!hasRes.value) {
      throw new Error('Collection existence check failed');
    }
    console.log('✓ Collection existence verified');

    // Drop collection
    const dropRes = await milvusClient.dropCollection({
      collection_name: TEST_COLLECTION,
    });

    if (dropRes.error_code !== 'Success') {
      throw new Error(`Drop collection failed: ${dropRes.reason}`);
    }
    console.log('✓ Successfully dropped test collection');

    return true;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('✗ Collection operations test failed:', err.message);
    console.error('Milvus Configuration:', {
      address: process.env.MILVUS_URI,
      username: process.env.MILVUS_USERNAME,
      // password: process.env.MILVUS_PASSWORD, // Omit password for security
      token: process.env.TOKEN,
    });

    // Attempt to clean up if collection creation succeeded but later steps failed
    try {
      await milvusClient.dropCollection({
        collection_name: TEST_COLLECTION,
      });
    } catch (cleanupError: unknown) {
      const cleanupErr = cleanupError as Error;
      console.warn('Cleanup failed:', cleanupErr.message);
    }

    return false;
  }
}

async function testDocumentOperations() {
  try {
    // Recreate test collection
    await milvusClient.createCollection({
      collection_name: TEST_COLLECTION,
      fields: [
        {
          name: 'id',
          data_type: 'Int64',
          is_primary_key: true,
        },
        {
          name: 'vector',
          data_type: 'FloatVector',
          type_params: {
            dim: '128',
          },
        },
        {
          name: 'content',
          data_type: 'VarChar',
          type_params: {
            max_length: '256',
          },
        },
      ],
    });

    // Insert test document
    const insertRes = await milvusClient.insert({
      collection_name: TEST_COLLECTION,
      data: [
        {
          id: 1,
          vector: Array(128).fill(0.5),
          content: 'test document',
        },
      ],
    });

    if (insertRes.status.error_code !== 'Success') {
      throw new Error(`Insert failed: ${insertRes.status.reason}`);
    }
    console.log('✓ Successfully inserted test document');

    // Query document
    const queryRes = await milvusClient.query({
      collection_name: TEST_COLLECTION,
      filter: 'id == 1',
      output_fields: ['content'],
    });

    if (
      queryRes.status.error_code !== 'Success' ||
      queryRes.data.length === 0
    ) {
      throw new Error('Query failed or no results returned');
    }
    console.log('✓ Successfully queried test document:', queryRes.data[0]);

    // Clean up
    await milvusClient.dropCollection({
      collection_name: TEST_COLLECTION,
    });

    return true;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('✗ Document operations test failed:', err.message);
    console.error('Milvus Configuration:', {
      address: process.env.MILVUS_URI,
      username: process.env.MILVUS_USERNAME,
      // password: process.env.MILVUS_PASSWORD, // Omit password for security
      token: process.env.TOKEN,
    });

    // Clean up
    try {
      await milvusClient.dropCollection({
        collection_name: TEST_COLLECTION,
      });
    } catch (cleanupError: unknown) {
      const cleanupErr = cleanupError as Error;
      console.warn('Cleanup failed:', cleanupErr.message);
    }

    return false;
  }
}

// CLI commands
yargs(hideBin(process.argv))
  .command('connection', 'Test Milvus server connection', {}, async () => {
    const success = await testConnection();
    process.exit(success ? 0 : 1);
  })
  .command('collection', 'Test collection operations', {}, async () => {
    const success = await testCollectionOperations();
    process.exit(success ? 0 : 1);
  })
  .command('document', 'Test document operations', {}, async () => {
    const success = await testDocumentOperations();
    process.exit(success ? 0 : 1);
  })
  .command('full', 'Run all tests', {}, async () => {
    const tests = [
      testConnection,
      testCollectionOperations,
      testDocumentOperations,
    ];

    let allPassed = true;

    for (const test of tests) {
      console.log(`\nRunning test: ${test.name}`);
      const success = await test();
      if (!success) {
        allPassed = false;
      }
    }

    console.log(allPassed ? '\n✓ All tests passed' : '\n✗ Some tests failed');
    process.exit(allPassed ? 0 : 1);
  })
  .demandCommand()
  .help().argv;
