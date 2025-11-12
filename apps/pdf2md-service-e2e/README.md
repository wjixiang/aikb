# PDF2MD Service E2E Tests

This directory contains end-to-end tests for the PDF2MD microservice, which uses RabbitMQ for message communication.

## Overview

Unlike traditional HTTP services, RabbitMQ microservices don't listen on HTTP ports. Instead, they communicate through message queues. This requires a different approach for testing:

1. **Service Startup**: We need to ensure RabbitMQ is running before tests
2. **Connection Testing**: We test RabbitMQ connectivity instead of HTTP port availability
3. **Message Communication**: Tests use NestJS ClientProxy to send/receive messages
4. **Queue Cleanup**: We clean up test queues after tests complete

## Prerequisites

- Docker and Docker Compose installed
- RabbitMQ service defined in `.devcontainer/docker-compose.yml`
- Environment variables configured in `.env`

## Running Tests

### Automatic Service Startup

The easiest way to run tests is to use the automatic service startup:

```bash
nx run pdf2md-service-e2e:e2e
```

This will:
1. Automatically start RabbitMQ service using Docker Compose
2. Wait for RabbitMQ to be healthy
3. Run the e2e tests
4. Clean up test queues

### Manual Service Management

If you prefer to manage services manually:

1. Start RabbitMQ manually:
```bash
cd .devcontainer
docker-compose up -d rabbitmq
```

2. Wait for RabbitMQ to be healthy:
```bash
docker-compose ps rabbitmq
```

3. Run tests without automatic startup:
```bash
nx run pdf2md-service-e2e:e2e --skipPreCommands
```

## Configuration

### Environment Variables

The tests use the following environment variables (configured in `.env`):

```bash
RABBITMQ_HOSTNAME=rabbitmq
RABBITMQ_AMQP_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin123
RABBITMQ_VHOST=my_vhost
```

### Docker Compose Service

The RabbitMQ service is defined in `.devcontainer/docker-compose.yml`:

```yaml
rabbitmq:
  image: rabbitmq:3.13.6-management
  ports:
    - "5672:5672"
    - "8080:15672"
  environment:
    - RABBITMQ_DEFAULT_USER=admin
    - RABBITMQ_DEFAULT_PASS=admin123
    - RABBITMQ_DEFAULT_VHOST=my_vhost
```

## Test Structure

### Global Setup (`src/support/global-setup.ts`)

- Waits for RabbitMQ port to be open
- Establishes test connection to RabbitMQ
- Provides detailed logging for troubleshooting

### Global Teardown (`src/support/global-teardown.ts`)

- Cleans up test queues and exchanges
- Closes connections properly

### Test Setup (`src/support/test-setup.ts`)

- Creates NestJS microservice client for RabbitMQ
- Makes client available to all tests via global scope

### Example Test (`src/pdf2md-service/pdf2md-service.e2e.test.ts`)

Demonstrates how to:
- Send messages to the microservice
- Receive responses
- Handle errors
- Test different scenarios

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('PDF2MD Service', () => {
  let client: ClientProxy;

  beforeEach(async () => {
    // Get the client from global setup
    client = globalThis.rabbitmqClient;
  });

  it('should process PDF correctly', async () => {
    const message = {
      pdfUrl: 'https://example.com/document.pdf',
      options: { format: 'markdown' }
    };

    const response = await client.send({ cmd: 'process_pdf' }, message).toPromise();
    
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.markdown).toContain('# Document Title');
  });
});
```

### Testing Error Scenarios

```typescript
it('should handle invalid PDF URL', async () => {
  const message = {
    pdfUrl: 'invalid-url',
    options: { format: 'markdown' }
  };

  try {
    await client.send({ cmd: 'process_pdf' }, message).toPromise();
    // Should not reach here
    expect(true).toBe(false);
  } catch (error) {
    expect(error.message).toContain('Invalid PDF URL');
  }
});
```

## Troubleshooting

### RabbitMQ Connection Issues

1. **Check if RabbitMQ is running**:
```bash
docker ps | grep rabbitmq
```

2. **Check RabbitMQ logs**:
```bash
docker logs <rabbitmq-container-id>
```

3. **Test RabbitMQ connectivity**:
```bash
docker exec -it <rabbitmq-container-id> rabbitmq-diagnostics -q ping
```

4. **Check if port is accessible**:
```bash
telnet localhost 5672
```

### Environment Variable Issues

1. **Verify environment variables are loaded**:
The global setup logs all RabbitMQ environment variables.

2. **Check .env file**:
Ensure `.env` file contains the correct RabbitMQ configuration.

3. **Verify Docker Compose configuration**:
Ensure the RabbitMQ service in `docker-compose.yml` matches the environment variables.

### Test Failures

1. **Check test logs**:
The global setup provides detailed logging for connection issues.

2. **Verify microservice is running**:
Ensure the `pdf2md-service` is started and connected to RabbitMQ.

3. **Check queue configuration**:
Verify the microservice is listening on the expected queues.

## CI/CD Configuration

For CI/CD environments, use the `ci` configuration:

```bash
nx run pdf2md-service-e2e:e2e --configuration=ci
```

This uses predefined environment variables suitable for CI environments.

## Best Practices

1. **Always clean up test queues** to avoid interference between tests
2. **Use descriptive test names** that explain the scenario being tested
3. **Test both success and error scenarios**
4. **Mock external dependencies** when possible
5. **Use appropriate timeouts** for message operations
6. **Log relevant information** for debugging failed tests

## Additional Resources

- [NestJS Microservices Documentation](https://docs.nestjs.com/microservices)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Vitest Testing Framework](https://vitest.dev/)