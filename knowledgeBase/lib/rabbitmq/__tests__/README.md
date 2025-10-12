# RabbitMQ Connection Tests

This directory contains Vitest test scripts to verify RabbitMQ connectivity and functionality.

## Files

- `rabbitmq-connection.test.ts` - Main test file with comprehensive RabbitMQ connection tests
- `run-rabbitmq-connection-test.ts` - Simple test runner script

## Test Coverage

The test suite covers:

1. **Configuration Validation**
   - Validates RabbitMQ configuration parameters
   - Checks test environment configuration

2. **Connection Initialization**
   - Tests successful connection establishment
   - Handles multiple initialization attempts
   - Validates error handling for invalid configurations

3. **Health Check**
   - Performs connection health checks
   - Validates health status responses

4. **Queue Management**
   - Tests queue information retrieval
   - Validates queue purging functionality

5. **Message Publishing and Consuming**
   - Tests basic message publishing
   - Validates message consumption
   - Tests exchange-based message routing

6. **Connection Resilience**
   - Tests connection recovery after disconnection
   - Validates graceful shutdown and restart

7. **Error Handling**
   - Tests error scenarios for uninitialized service
   - Validates handling of non-existent queues

8. **PDF-specific Message Types**
   - Tests PDF conversion request messages
   - Tests PDF conversion progress messages

## Prerequisites

1. RabbitMQ server must be running and accessible
2. Environment variables should be configured (see `.env.example`)
3. Required dependencies must be installed (`pnpm install`)

## Running Tests

### Option 1: Using pnpm test command (Recommended)

```bash
# Run the RabbitMQ connection tests
pnpm test knowledgeBase/lib/rabbitmq/__tests__/rabbitmq-connection.test.ts

# Run with verbose output
pnpm test knowledgeBase/lib/rabbitmq/__tests__/rabbitmq-connection.test.ts --reporter=verbose

# Run in watch mode
pnpm test knowledgeBase/lib/rabbitmq/__tests__/rabbitmq-connection.test.ts --watch
```

### Option 2: Using the test runner script

```bash
# Make the script executable
chmod +x knowledgeBase/lib/rabbitmq/__tests__/run-rabbitmq-connection-test.ts

# Run the test
npx tsx knowledgeBase/lib/rabbitmq/__tests__/run-rabbitmq-connection-test.ts
```

### Option 3: Running all tests

```bash
# Run all tests including RabbitMQ tests
pnpm test
```

## Environment Configuration

The tests use the test environment configuration. Ensure the following environment variables are set:

```bash
# RabbitMQ Configuration
RABBITMQ_URL_TEST=amqp://admin:admin123@rabbitmq:5672/my_vhost
RABBITMQ_HOSTNAME=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin123
RABBITMQ_VHOST=my_vhost

# Test Environment
NODE_ENV=test
```

## Troubleshooting

### Connection Issues

1. **Check RabbitMQ server status**
   ```bash
   docker ps | grep rabbitmq
   ```

2. **Verify network connectivity**
   ```bash
   telnet rabbitmq 5672
   ```

3. **Check environment variables**
   ```bash
   env | grep RABBITMQ
   ```

### Test Failures

1. **Permission errors**: Ensure RabbitMQ user has necessary permissions
2. **Queue cleanup**: Tests automatically clean up created queues
3. **Time-sensitive tests**: Some tests use timeouts; ensure adequate time for operations

### Debug Mode

Run tests with additional logging:

```bash
# Enable debug logging
SYSTEM_LOG_LEVEL=debug pnpm test knowledgeBase/lib/rabbitmq/__tests__/rabbitmq-connection.test.ts

# Run with Node.js inspector
node --inspect-brk node_modules/.bin/vitest run knowledgeBase/lib/rabbitmq/__tests__/rabbitmq-connection.test.ts
```

## Test Output

Successful test run output:

```
 ✓ Configuration Validation (2)
 ✓ Connection Initialization (3)
 ✓ Health Check (2)
 ✓ Queue Management (2)
 ✓ Message Publishing and Consuming (2)
 ✓ Connection Resilience (1)
 ✓ Error Handling (2)
 ✓ PDF-specific Message Types (2)

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  ...
   Duration  ...
```

## Integration with CI/CD

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run RabbitMQ Tests
  run: |
    docker-compose up -d rabbitmq
    sleep 10
    pnpm test knowledgeBase/lib/rabbitmq/__tests__/rabbitmq-connection.test.ts
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Clean up resources in `afterEach` hooks
4. Handle both success and error scenarios
5. Add appropriate assertions