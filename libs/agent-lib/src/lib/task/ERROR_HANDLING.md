# Task Error Handling

This document describes the improved error handling mechanism implemented in the `Task` class for the `recursivelyMakeClineRequests` method.

## Overview

The error handling system provides:

1. **Custom Error Types**: Specific error classes for different failure scenarios
2. **Error Collection**: Collects all errors during retry attempts
3. **Smart Retry Logic**: Only retries retryable errors
4. **Error Aggregation**: Provides comprehensive error information when retries are exhausted

## Error Types

### Base Class: `TaskError`

All task-related errors extend from this base class:

```typescript
abstract class TaskError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
  constructor(message: string, public readonly cause?: Error)
}
```

### Specific Error Types

| Error Type                | Code                        | Retryable | Description                     |
| ------------------------- | --------------------------- | --------- | ------------------------------- |
| `TaskAbortedError`        | `TASK_ABORTED`              | No        | Task was manually aborted       |
| `ConsecutiveMistakeError` | `CONSECUTIVE_MISTAKE_LIMIT` | No        | Too many consecutive mistakes   |
| `ApiTimeoutError`         | `API_TIMEOUT`               | Yes       | API request timed out           |
| `ApiRequestError`         | `API_REQUEST_FAILED`        | Yes       | API request failed              |
| `NoApiResponseError`      | `NO_API_RESPONSE`           | Yes       | No response received from API   |
| `NoToolsUsedError`        | `NO_TOOLS_USED`             | Yes       | LLM didn't use any tools        |
| `StreamingError`          | `STREAMING_FAILED`          | Yes       | Stream processing failed        |
| `MaxRetryExceededError`   | `MAX_RETRY_EXCEEDED`        | No        | Maximum retry attempts exceeded |

## Error Collection

The Task class collects errors during retry attempts:

```typescript
// Get all collected errors
const errors = task.getCollectedErrors();

// Reset collected errors (useful for new operations)
task.resetCollectedErrors();
```

## Retry Logic

The retry mechanism follows these rules:

1. **Retryable Errors**: Only errors with `retryable: true` are retried
2. **Non-retryable Errors**: Immediately thrown without retry
3. **Max Attempts**: After `maxRetryAttempts` (default: 3), a `MaxRetryExceededError` is thrown
4. **Error Aggregation**: All collected errors are included in the final error

## Usage Examples

### Basic Error Handling

```typescript
import { Task, TaskError, MaxRetryExceededError } from './task.entity';

const task = new Task('my-task', apiConfig);

try {
  await task.recursivelyMakeClineRequests(userContent);
} catch (error) {
  if (error instanceof MaxRetryExceededError) {
    console.error('All retries failed:', error.message);

    // Access all collected errors
    error.errors.forEach((err, index) => {
      console.log(`Error ${index + 1}: ${err.code} - ${err.message}`);
    });
  } else if (error instanceof TaskError) {
    console.error(`Task error: ${error.code} - ${error.message}`);
    console.error(`Retryable: ${error.retryable}`);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Advanced Error Management

```typescript
class TaskManager {
  constructor(private task: Task) {}

  async executeWithFallback(userContent: any[]): Promise<boolean> {
    try {
      // Reset errors before new operation
      this.task.resetCollectedErrors();

      return await this.task.recursivelyMakeClineRequests(userContent);
    } catch (error) {
      if (error instanceof MaxRetryExceededError) {
        // Analyze error patterns
        const errorCounts = this.analyzeErrors(error.errors);

        // Implement fallback strategy
        return await this.implementFallback(errorCounts);
      }

      throw error; // Re-throw other errors
    }
  }

  private analyzeErrors(errors: TaskError[]): Record<string, number> {
    return errors.reduce(
      (counts, error) => {
        counts[error.code] = (counts[error.code] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );
  }

  private async implementFallback(
    errorCounts: Record<string, number>,
  ): Promise<boolean> {
    // Implement custom fallback logic based on error patterns
    if (errorCounts['API_TIMEOUT'] > 0) {
      // Handle timeout issues
      return await this.handleTimeoutFallback();
    } else if (errorCounts['NO_TOOLS_USED'] > 0) {
      // Handle tool usage issues
      return await this.handleNoToolsFallback();
    }

    return false;
  }
}
```

## Error Recovery Strategies

### For Timeout Errors

- Increase timeout duration
- Use smaller requests
- Check network connectivity

### For API Request Errors

- Verify API credentials
- Check rate limits
- Try different endpoint

### For No Tools Used

- Adjust system prompt
- Provide clearer instructions
- Simplify the request

### For Streaming Errors

- Restart the stream
- Use different protocol (XML vs Native)
- Fall back to non-streaming mode

## Best Practices

1. **Always check error type** before implementing recovery logic
2. **Use `getCollectedErrors()`** to understand failure patterns
3. **Reset errors** before starting new operations
4. **Handle non-retryable errors** immediately
5. **Log error details** for debugging and monitoring
6. **Implement appropriate fallbacks** based on error types

## Configuration

```typescript
// Configure retry behavior
const task = new Task('my-task', apiConfig, consecutiveMistakeLimit);

// Access retry configuration
const maxRetries = (task as any).maxRetryAttempts; // 3 (default)
const timeout = (task as any).apiRequestTimeout; // 60000ms (default)
```

## Testing

The error handling mechanism is thoroughly tested in `task.error-handling.test.ts`:

- Custom error type creation
- Error collection and reset
- Retry logic with different error types
- Error aggregation in MaxRetryExceededError

Run tests with:

```bash
nx test agent-lib --testNamePattern="Task Error Handling"
```
