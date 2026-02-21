# API Client Error Handling

This document describes the comprehensive error handling system implemented in the OpenAI-compatible API client.

## Overview

The error handling system provides:

1. **Structured Error Types**: Specific error classes for different failure scenarios
2. **Automatic Retry Logic**: Exponential backoff for retryable errors
3. **Recovery Suggestions**: Actionable guidance for resolving errors
4. **Detailed Logging**: Request/response logging for debugging
5. **Input Validation**: Pre-flight validation of request parameters

## Error Types

### Base Error Class

All errors extend [`ApiClientError`](errors.ts:9), which provides:
- `code`: Unique error identifier
- `statusCode`: HTTP status code (if applicable)
- `retryable`: Whether the error can be retried
- `recoverySuggestions`: Array of recovery suggestions
- `toJSON()`: Method for serializing error data

### Specific Error Types

| Error Class | Code | HTTP Status | Retryable | Use Case |
|------------|------|-------------|-----------|----------|
| [`AuthenticationError`](errors.ts:43) | `AUTHENTICATION_ERROR` | 401 | No | Invalid or expired API key |
| [`RateLimitError`](errors.ts:59) | `RATE_LIMIT_ERROR` | 429 | Yes | Too many requests |
| [`TimeoutError`](errors.ts:83) | `TIMEOUT_ERROR` | - | Yes | Request timeout |
| [`NetworkError`](errors.ts:98) | `NETWORK_ERROR` | - | Yes | Connection issues |
| [`ValidationError`](errors.ts:120) | `VALIDATION_ERROR` | 400 | No | Invalid request parameters |
| [`ServiceUnavailableError`](errors.ts:139) | `SERVICE_UNAVAILABLE` | 503 | Yes | API service down |
| [`QuotaExceededError`](errors.ts:156) | `QUOTA_EXCEEDED` | 429 | No | Usage quota exceeded |
| [`ContentPolicyError`](errors.ts:175) | `CONTENT_POLICY_VIOLATION` | 400 | No | Content policy violation |
| [`ResponseParsingError`](errors.ts:190) | `RESPONSE_PARSING_ERROR` | - | No | Invalid response format |
| [`ConfigurationError`](errors.ts:205) | `CONFIGURATION_ERROR` | - | No | Invalid configuration |
| [`UnknownApiError`](errors.ts:220) | `UNKNOWN_ERROR` | - | No | Unexpected errors |

## Retry Logic

The client implements automatic retry logic with exponential backoff:

### Retry Configuration

```typescript
const client = new OpenaiCompatibleApiClient({
    apiKey: 'your-key',
    model: 'gpt-4',
    maxRetries: 3,        // Maximum retry attempts (default: 3)
    retryDelay: 1000,     // Initial delay in ms (default: 1000)
    enableLogging: true,  // Enable request logging (default: true)
});
```

### Retry Behavior

1. **Exponential Backoff**: Delay increases exponentially with each retry
2. **Jitter**: Random jitter added to prevent thundering herd
3. **Rate Limit Handling**: Respects `retry-after` header when available
4. **Capped Delay**: Maximum delay of 30 seconds

### Retry Calculation

```
delay = min(baseDelay * 2^(attempt-1) + jitter, 30000)
```

## Input Validation

The client validates all inputs before making requests:

### System Prompt
- Must be a string
- Cannot be empty (optional validation)

### Workspace Context
- Must be a string
- Can be empty for new workspaces

### Memory Context
- Must be an array
- Each item must be a string

### Tools
- Must be an array (if provided)
- Each tool must have a valid `type` ('function' or 'custom')
- Function tools must have a `function.name`

## Configuration Validation

The client validates configuration on initialization:

| Parameter | Validation |
|-----------|------------|
| `apiKey` | Required, non-empty string |
| `model` | Required, non-empty string |
| `temperature` | Must be between 0 and 2 (if provided) |
| `maxTokens` | Must be greater than 0 (if provided) |

## Response Validation

The client validates API responses:

1. **Completion Structure**: Ensures response has valid structure
2. **Tool Calls**: Validates tool call format and JSON arguments
3. **Token Usage**: Validates non-negative token counts
4. **Empty Responses**: Handles missing or empty responses

## Logging

The client provides detailed logging for debugging:

### Log Levels

- `info`: Successful requests and general information
- `warn`: Warnings (e.g., rate limits, missing data)
- `error`: Error details with context

### Log Content

Each log entry includes:
- Timestamp
- Request ID
- Model used
- Request duration
- Token usage
- Error details (if applicable)

### Example Log Output

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-1-1705319400000",
  "model": "gpt-4",
  "timeout": 40000,
  "messageCount": 3,
  "hasTools": true,
  "toolCount": 2
}
```

## Usage Examples

### Basic Error Handling

```typescript
import { 
    OpenaiCompatibleApiClient, 
    ApiClientError,
    isRetryableError 
} from './api-client/index.js';

const client = new OpenaiCompatibleApiClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4',
});

try {
    const response = await client.makeRequest(
        systemPrompt,
        workspaceContext,
        memoryContext
    );
    console.log(response.toolCalls);
} catch (error) {
    if (error instanceof ApiClientError) {
        console.error(`Error: ${error.message}`);
        console.error(`Code: ${error.code}`);
        
        if (error.recoverySuggestions) {
            console.error('Suggestions:');
            error.recoverySuggestions.forEach((s, i) => {
                console.error(`  ${i + 1}. ${s}`);
            });
        }
        
        if (isRetryableError(error)) {
            console.log('This error can be retried');
        }
    }
}
```

### Handling Specific Errors

```typescript
import { 
    AuthenticationError,
    RateLimitError,
    TimeoutError,
    ValidationError 
} from './api-client/index.js';

try {
    const response = await client.makeRequest(...);
} catch (error) {
    if (error instanceof AuthenticationError) {
        // Handle authentication issues
        console.error('Invalid API key');
    } else if (error instanceof RateLimitError) {
        // Handle rate limiting
        if (error.retryAfter) {
            console.log(`Wait ${error.retryAfter}s before retrying`);
        }
    } else if (error instanceof TimeoutError) {
        // Handle timeouts
        console.log(`Request timed out after ${error.timeoutMs}ms`);
    } else if (error instanceof ValidationError) {
        // Handle validation errors
        console.error(`Invalid field: ${error.field}`);
    }
}
```

### Getting Error Statistics

```typescript
// Get the last error that occurred
const lastError = client.getLastError();
if (lastError) {
    console.error('Last error:', lastError.toJSON());
}

// Get overall statistics
const stats = client.getStats();
console.log(`Total requests: ${stats.requestCount}`);
console.log(`Last error: ${stats.lastError?.message ?? 'None'}`);
```

### Custom Error Parsing

```typescript
import { parseError, getErrorMessageWithSuggestions } from './api-client/index.js';

try {
    await someOperation();
} catch (error) {
    const apiError = parseError(error);
    console.error(getErrorMessageWithSuggestions(apiError));
}
```

## Best Practices

1. **Always handle errors**: Wrap API calls in try-catch blocks
2. **Check retryability**: Use `isRetryableError()` before implementing custom retry logic
3. **Log errors**: Enable logging for debugging in development
4. **Validate inputs**: Pre-validate inputs to catch errors early
5. **Handle rate limits**: Implement proper backoff for rate limit errors
6. **Monitor quotas**: Track usage to avoid quota exceeded errors
7. **Set appropriate timeouts**: Adjust timeouts based on expected response times

## Error Recovery

### Automatic Recovery

The following errors are automatically retried:
- Network errors
- Timeout errors
- Rate limit errors (with respect to retry-after)
- Service unavailable errors

### Manual Recovery

For non-retryable errors:
1. **Authentication errors**: Verify and update API key
2. **Validation errors**: Fix request parameters
3. **Quota exceeded**: Upgrade plan or wait for quota reset
4. **Content policy**: Modify prompt content
5. **Configuration errors**: Fix client configuration

## Testing

The error handling system can be tested using the error utilities:

```typescript
import { 
    parseError,
    isRetryableError,
    getErrorMessageWithSuggestions 
} from './api-client/index.js';

// Test error parsing
const error = new Error('Request timed out after 30000ms');
const parsed = parseError(error);
console.log(parsed instanceof TimeoutError); // true
console.log(parsed.retryable); // true

// Test retryability
console.log(isRetryableError(parsed)); // true

// Test error message formatting
const message = getErrorMessageWithSuggestions(parsed);
console.log(message);
```

## See Also

- [`OpenaiCompatibleApiClient`](OpenaiCompatibleApiClient.ts) - Main client implementation
- [`ApiClient.interface`](ApiClient.interface.ts) - API client interface
- [`errors.ts`](errors.ts) - Error type definitions
