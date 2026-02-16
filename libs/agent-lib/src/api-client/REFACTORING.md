# API Client Refactoring Guide

## Overview

This document describes the refactoring of the API Client layer completed on 2026-02-16.

## Changes Made

### 1. Unified ToolCall Interface

**Before:**
```typescript
interface AttemptCompletion {
    toolName: "attempt_completion";
    toolParams: string;
}

interface ToolCall {
    toolName: string;
    toolParams: string;
}

type ApiResponse = AttemptCompletion | ToolCall;
```

**After:**
```typescript
interface ToolCall {
    id: string;           // e.g., "fc_12345xyz"
    call_id: string;      // e.g., "call_12345xyz"
    type: "function_call";
    name: string;         // Function/tool name
    arguments: string;    // JSON string of arguments
}

type ApiResponse = ToolCall[];
```

### 2. Multiple Tool Calls Support

The new interface supports returning multiple tool calls in a single response, enabling:
- Parallel tool execution
- More efficient API usage
- Better alignment with OpenAI's tool calling format

### 3. OpenAI Compatibility

The new `ToolCall` interface matches OpenAI's format exactly, providing:
- Interoperability with OpenAI-compatible APIs
- No direct SDK dependencies
- Easy integration with existing OpenAI tools

## Migration Guide

### For API Client Implementations

**Old Code:**
```typescript
async makeRequest(...): Promise<ApiResponse> {
    const response = await someApiCall();
    return {
        toolName: response.name,
        toolParams: JSON.stringify(response.params)
    };
}
```

**New Code:**
```typescript
async makeRequest(...): Promise<ApiResponse> {
    const response = await someApiCall();
    return [{
        id: `fc_${generateId()}`,
        call_id: `call_${generateId()}`,
        type: 'function_call',
        name: response.name,
        arguments: JSON.stringify(response.params)
    }];
}
```

### For Agent Code

**Old Code:**
```typescript
const response = await apiClient.makeRequest(...);
if (response.toolName === 'attempt_completion') {
    // Handle completion
} else {
    // Execute single tool
    await executeToolCall(response);
}
```

**New Code:**
```typescript
const response = await apiClient.makeRequest(...);
for (const toolCall of response) {
    if (toolCall.name === 'attempt_completion') {
        didAttemptCompletion = true;
    }
    await executeToolCall(toolCall);
}
```

## Backward Compatibility

### BamlApiClient

The `BamlApiClient` includes automatic conversion from legacy formats:

```typescript
private convertBamlResponse(bamlResponse: any): ApiResponse {
    // Handle array format (new)
    if (Array.isArray(bamlResponse)) {
        return bamlResponse.map(item => this.normalizeToolCall(item));
    }

    // Handle legacy format (old)
    if (this.isLegacyFormat(bamlResponse)) {
        return [this.convertLegacyToolCall(bamlResponse)];
    }

    throw new Error('Invalid BAML response format');
}
```

### BAML Schema Update

The BAML schema was updated to return arrays:

**Before:**
```baml
function ApiRequest(...) -> AttemptCompletion | ToolCall {
    ...
}
```

**After:**
```baml
class ToolCall {
    id string
    call_id string
    type "function_call"
    name string
    arguments string
}

function ApiRequest(...) -> ToolCall[] {
    ...
}
```

## Testing

New test suite added at `src/api-client/__tests__/ApiClient.refactor.test.ts`:

```bash
npm test src/api-client/__tests__/ApiClient.refactor.test.ts
```

Tests cover:
- ToolCall interface structure
- Multiple tool calls support
- Backward compatibility
- Legacy format conversion

## Files Modified

1. `src/api-client/ApiClient.interface.ts` - Updated interfaces
2. `src/api-client/BamlApiClient.ts` - Added legacy format conversion
3. `src/api-client/OpenaiCompatibleApiClient.ts` - Implemented full client
4. `src/api-client/index.ts` - Updated exports
5. `src/agent/agent.ts` - Updated to handle multiple tool calls
6. `baml_src/apiRequest.baml` - Updated BAML schema

## Benefits

1. **Standardization**: Unified interface across all providers
2. **Scalability**: Support for multiple tool calls per request
3. **Compatibility**: Direct OpenAI format compatibility
4. **Maintainability**: Cleaner code with less special cases
5. **Flexibility**: Easy to add new API providers

## Future Enhancements

- [ ] Streaming support for tool calls
- [ ] Parallel tool execution
- [ ] Tool call batching
- [ ] Retry logic with exponential backoff
- [ ] Metrics and monitoring
