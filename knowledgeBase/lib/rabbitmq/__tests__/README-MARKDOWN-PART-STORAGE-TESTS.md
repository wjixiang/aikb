# Markdown Part Storage Integration Tests

This directory contains comprehensive integration tests for the Markdown Part Storage system, which handles PDF document processing in parts and merges them back together.

## Overview

The Markdown Part Storage system is designed to:
- Process PDF documents in parts for better scalability
- Store each part's markdown content in a cache
- Track the status of each part
- Automatically merge all parts when they're completed
- Handle failures and retry mechanisms
- Support concurrent processing of multiple parts

## Test Files

### 1. `markdown-part-storage.integration.test.ts`

This is the main integration test file that covers all aspects of the markdown part storage system:

#### Test Scenarios:

1. **Normal PDF part conversion and storage flow**
   - Tests successful processing of all parts
   - Verifies correct merging of parts
   - Validates handling of parts in random order

2. **Retry mechanism for failed part conversion**
   - Tests retry logic for failed parts
   - Verifies maximum retry limits
   - Tests successful retry after initial failure

3. **Automatic merging after all parts complete**
   - Tests that merging is triggered only when all parts are completed
   - Verifies that merging doesn't happen if some parts fail

4. **Concurrent processing of multiple PDF parts**
   - Tests concurrent processing of multiple parts
   - Verifies handling of concurrent failures

5. **Error handling and recovery**
   - Tests graceful handling of cache errors
   - Tests graceful handling of tracker errors
   - Tests graceful handling of RabbitMQ errors

6. **Merger service integration**
   - Tests merging of parts from cache
   - Tests fallback to storage when cache is empty

### 2. `run-markdown-part-storage-tests.sh`

A shell script that sets up the test environment and runs the integration tests:

#### Features:
- Checks for required services (MongoDB, RabbitMQ)
- Sets up test environment variables
- Cleans up test data before and after tests
- Runs both unit and integration tests
- Generates a test report

#### Usage:
```bash
# Make the script executable
chmod +x run-markdown-part-storage-tests.sh

# Run the tests
./run-markdown-part-storage-tests.sh
```

### 3. `../demo-markdown-part-storage.ts`

A demonstration script that shows how to use the markdown part storage system:

#### Features:
- Demonstrates normal processing flow
- Shows retry mechanism in action
- Demonstrates concurrent processing
- Shows error handling
- Includes sample markdown content for testing

#### Usage:
```bash
# Run the demo
npx tsx knowledgeBase/lib/rabbitmq/demo-markdown-part-storage.ts
```

## Test Data

The tests use sample markdown content representing sections of a machine learning document:
- Introduction to Machine Learning
- Types of Machine Learning
- Deep Learning Fundamentals
- Practical Applications
- Conclusion

## Prerequisites

### Required Services:
1. **MongoDB** - Required for caching markdown parts and tracking status
   - Default: `mongodb://localhost:27017`
   - Test database: `markdown-part-storage-test`

2. **RabbitMQ** - Optional (tests will use mocks if not available)
   - Default: `amqp://localhost:5672`

### Required Tools:
- Node.js (v16 or higher)
- pnpm or npm
- tsx (for running TypeScript files)

## Running Tests

### Quick Start:
```bash
# Run all tests with the test script
./run-markdown-part-storage-tests.sh
```

### Manual Testing:
```bash
# Set environment variables
export NODE_ENV=test
export MONGODB_URL="mongodb://localhost:27017/markdown-part-storage-test"

# Run unit tests
pnpm test knowledgeBase/lib/rabbitmq/__tests__/markdown-part-cache-mongodb.test.ts

# Run integration tests
pnpm test knowledgeBase/lib/rabbitmq/__tests__/markdown-part-storage.integration.test.ts

# Run demo
npx tsx knowledgeBase/lib/rabbitmq/demo-markdown-part-storage.ts
```

## Test Reports

After running the test script, a test report will be generated in the current directory:
`markdown-part-storage-test-report-YYYYMMDD-HHMMSS.md`

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ PDF Document    │───▶│ PDF Parts        │───▶│ Markdown Parts  │
│ (Split)         │    │ (Processing)     │    │ (Storage)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Merged Document │◀───│ Merger Service   │◀───│ Part Cache      │
│ (Output)        │    │ (Coordination)   │    │ (MongoDB)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Key Components

1. **MarkdownPartCache** - Caches markdown parts in MongoDB
2. **MarkdownPartStorageWorker** - Processes storage requests
3. **PdfPartTracker** - Tracks status of each part
4. **PdfMergerService** - Merges completed parts
5. **RabbitMQService** - Handles message queuing

## Error Handling

The system includes comprehensive error handling:
- Automatic retry for failed parts (configurable max retries)
- Graceful degradation when services are unavailable
- Detailed error logging and status tracking
- Recovery mechanisms for transient failures

## Performance Considerations

- Parts are processed concurrently for better throughput
- MongoDB indexes optimize query performance
- RabbitMQ provides reliable message delivery
- Caching reduces database load

## Troubleshooting

### Common Issues:

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running on localhost:27017
   - Check connection string in environment variables

2. **Test Failures**
   - Ensure test database is clean before running tests
   - Check for leftover test data from previous runs

3. **RabbitMQ Connection Issues**
   - RabbitMQ is optional for tests (mocks will be used)
   - If using RabbitMQ, ensure it's running on localhost:5672

### Cleanup:
```bash
# Clean up test database
node -e "
const { MongoClient } = require('mongodb');
MongoClient.connect('mongodb://localhost:27017/markdown-part-storage-test')
  .then(client => {
    const db = client.db();
    return db.dropDatabase().then(() => client.close());
  })
  .catch(console.error);
"
```

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Include proper cleanup in afterEach blocks
3. Use descriptive test names
4. Mock external dependencies
5. Update this README if needed