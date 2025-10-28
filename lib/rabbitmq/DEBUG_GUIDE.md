# RabbitMQ Debug Guide

This guide explains how to use the `IRabbitMQService` interface and debug tools to debug RabbitMQ operations.

## Using the IRabbitMQService Interface

The `IRabbitMQService` interface defines the public API for RabbitMQ operations. You can use it for type annotations and dependency injection:

```typescript
import { IRabbitMQService, getRabbitMQService } from './rabbitmq';

class MyService {
  constructor(private rabbitMQService: IRabbitMQService) {}

  async sendMessage() {
    await this.rabbitMQService.publishPdfConversionRequest({
      messageId: 'test-id',
      timestamp: Date.now(),
      eventType: 'PDF_CONVERSION_REQUEST',
      itemId: 'test-item',
      // ... other properties
    });
  }
}

// Usage
const rabbitMQService = getRabbitMQService();
const myService = new MyService(rabbitMQService);
```

## Using Debug Tools

The `RabbitMQDebugTools` class provides utilities to help debug RabbitMQ operations:

### 1. Debug Wrapper

Wrap any RabbitMQ service instance to log all method calls:

```typescript
import { RabbitMQDebugTools, getRabbitMQService } from './rabbitmq';

const rabbitMQService = getRabbitMQService();
const debugService = RabbitMQDebugTools.createDebugWrapper(rabbitMQService);

// All method calls will now be logged to console
await debugService.publishPdfConversionRequest(request);
```

### 2. Mock Service for Testing

Get a mock service with debug capabilities:

```typescript
import { getDebugMockRabbitMQService } from './rabbitmq';

const mockService = getDebugMockRabbitMQService();

// Use the mock service in your tests
await mockService.publishPdfConversionRequest(request);
```

### 3. Inspect Mock Service

Inspect the internal state of the mock service:

```typescript
import { RabbitMQDebugTools } from './rabbitmq';

const mockInternals = RabbitMQDebugTools.inspectMockService();
console.log('Mock initialization state:', mockInternals.isInitialized);
console.log('Mock protocol:', mockInternals.protocol);
```

### 4. Spy on Methods

Create a spy on a specific method to track calls:

```typescript
import { RabbitMQDebugTools, getRabbitMQService } from './rabbitmq';

const rabbitMQService = getRabbitMQService();
const spy = RabbitMQDebugTools.spyOnMethod(rabbitMQService, 'publishMessage');

// Use the service
await rabbitMQService.publishMessage('test.routing.key', message);

// Check the spy
console.log('Method called', spy.calls.length, 'times');
console.log('First call arguments:', spy.calls[0].args);

// Reset the spy
spy.reset();

// Restore the original method
spy.restore();
```

## Common Debugging Scenarios

### Checking Connection Status

```typescript
import { getRabbitMQService } from './rabbitmq';

const service = getRabbitMQService();

// Check if the service is connected
if (service.isConnected()) {
  console.log('RabbitMQ service is connected');
} else {
  console.log('RabbitMQ service is not connected');
}

// Perform a health check
const health = await service.healthCheck();
console.log('Health status:', health.status);
console.log('Health details:', health.details);
```

### Debugging Message Publishing

```typescript
import { RabbitMQDebugTools } from './rabbitmq';

const debugService = RabbitMQDebugTools.getDebugMockService();

// This will log the method call and its arguments
await debugService.publishPdfConversionRequest({
  messageId: 'debug-test',
  timestamp: Date.now(),
  eventType: 'PDF_CONVERSION_REQUEST',
  itemId: 'debug-item',
  // ... other properties
});
```

### Debugging Message Consumption

```typescript
import { RabbitMQDebugTools } from './rabbitmq';

const debugService = RabbitMQDebugTools.getDebugMockService();

// This will log the consumeMessages call
const consumerTag = await debugService.consumeMessages(
  'test-queue',
  (message, originalMessage) => {
    console.log('Received message:', message);
  }
);
```

## Mock Service Behavior

The mock service provided by `mockRabbitMQService` has the following default behavior:

- All async methods return resolved promises with appropriate default values
- `isConnected()` returns `true`
- `healthCheck()` returns a healthy status
- All publish methods return `true` (success)
- All consume methods return a mock consumer tag

You can inspect and modify the mock implementation using `getMockRabbitMQServiceImpl()`:

```typescript
import { getMockRabbitMQServiceImpl } from './rabbitmq';

const mockImpl = getMockRabbitMQServiceImpl();

// Modify mock behavior
mockImpl.isConnected.mockReturnValue(false);
mockImpl.publishMessage.mockResolvedValue(false);
```

## Type Safety

Using the `IRabbitMQService` interface provides full type safety:

```typescript
import { IRabbitMQService } from './rabbitmq';

function processMessages(service: IRabbitMQService) {
  // TypeScript will provide autocompletion and type checking
  // for all RabbitMQ methods
  service.publishPdfConversionRequest(/* ... */);
  service.consumeMessages(/* ... */);
  // service.nonExistentMethod(); // TypeScript error!
}
```

This makes it easier to debug and maintain your RabbitMQ-related code.