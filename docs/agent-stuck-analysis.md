# AgentV2 Stuck Analysis

## Problem Description

The agent gets stuck after the following output:

```
Step 10: Demo - Start Agent (Commented out)
To actually start the agent with real AI, uncomment the following code:

[Status Changed] Task: demo-task-id -> Status: running

[Message Added] Task: demo-task-id
  Role: user
  Content Blocks: 1
Starting API request attempt 1
API request attempt 1 successful
[cache.diff]: `canonizeResults` is deprecated and will be removed in Apollo Client 4.0. Please remove this option.
```

## Debug Logging Added

Comprehensive debug logging has been added to the following files to help identify where the issue occurs:

### 1. [`libs/agent-lib/src/agent/agentV2.ts`](../libs/agent-lib/src/agent/agentV2.ts)

Added logging to:

- `requestLoop()` - Tracks API request processing flow
- `collectCompleteResponse()` - Tracks stream iteration and chunk collection
- `attemptApiRequest()` - Tracks API request creation and stream yielding

Expected logs:

```
[DEBUG] Starting API request processing...
[DEBUG] Model cached: glm-4.7
[DEBUG] Calling collectCompleteResponse...
[DEBUG] collectCompleteResponse - START
[DEBUG] attemptApiRequest - START
[DEBUG] Starting API request attempt 1
[DEBUG] System prompt obtained, length: XXX
[DEBUG] Workspace context obtained, length: XXX
[DEBUG] Clean conversation history built, messages: X
[DEBUG] Calling api.createMessage...
[DEBUG] Waiting for stream (with timeout)...
[DEBUG] API request attempt 1 successful, starting yield*
[DEBUG] About to yield* stream...
[DEBUG] BaseOpenAiCompatibleProvider.createMessage - START
[DEBUG] System prompt length: XXX
[DEBUG] Messages count: X
[DEBUG] Stream created successfully
[DEBUG] Starting to iterate stream...
```

### 2. [`libs/agent-lib/src/api/providers/base-openai-compatible-provider.ts`](../libs/agent-lib/src/api/providers/base-openai-compatible-provider.ts)

Added logging to:

- `createStream()` - Tracks stream creation from OpenAI client
- `createMessage()` - Tracks stream iteration and chunk processing

Expected logs:

```
[DEBUG] createStream - START
[DEBUG] Model: glm-4.7
[DEBUG] max_tokens: XXX
[DEBUG] temperature: X
[DEBUG] Params constructed, messages count: X
[DEBUG] Calling this.client.chat.completions.create...
[DEBUG] Stream created successfully from OpenAI client
[DEBUG] BaseOpenAiCompatibleProvider.createMessage - START
[DEBUG] System prompt length: XXX
[DEBUG] Messages count: X
[DEBUG] Stream created successfully
[DEBUG] Starting to iterate stream...
[DEBUG] Received chunk #1: {...}
```

### 3. [`libs/agent-lib/src/task/response/ResponseProcessor.ts`](../libs/agent-lib/src/task/response/ResponseProcessor.ts)

Added logging to:

- `processXmlCompleteResponse()` - Tracks XML response processing
- `processCompleteResponse()` - Tracks native response processing

Expected logs:

```
[DEBUG] ResponseProcessor.processXmlCompleteResponse - START
[DEBUG] Total chunks to process: X
[DEBUG] Chunk breakdown - usage: X, reasoning: X, text: X, other: X
[DEBUG] Assistant message length: X
[DEBUG] Reasoning message length: X
[DEBUG] Assistant message (first 200 chars): ...
[DEBUG] Calling xmlToolCallingParser.processMessage...
[DEBUG] Final blocks count: X
```

## How to Use Debug Logs

Run the demo script and observe where the logs stop:

```bash
npx tsx scripts/demo-agent.ts
```

The logs will help identify:

1. Whether the stream is being created from the OpenAI client
2. Whether the stream is being iterated
3. What types of chunks are being received
4. Where exactly the execution stops

## Root Cause Analysis

### 1. Stream Processing Issue in `collectCompleteResponse`

Looking at [`libs/agent-lib/src/agent/agentV2.ts:707-734`](../libs/agent-lib/src/agent/agentV2.ts:707), the `collectCompleteResponse` method:

```typescript
private async collectCompleteResponse(status: TaskStatus): Promise<ApiStreamChunk[]> {
    const stream = this.attemptApiRequest();
    const chunks: ApiStreamChunk[] = [];

    try {
        const iterator = stream[Symbol.asyncIterator]();
        let item = await iterator.next();
        console.log(item)  // Line 714 - This logs the first chunk
        while (!item.done) {
            // Check for abort status during stream processing
            if (status === 'aborted') {
                return chunks;
            }

            const chunk = item.value;
            if (chunk) {
                chunks.push(chunk);
            }
            item = await iterator.next();
        }

        console.log(`Collected ${chunks.length} chunks from stream`);
        return chunks;
    } catch (error) {
        console.error('Error collecting complete response:', error);
        throw error;
    }
}
```

**The Issue**: The `console.log(item)` at line 714 is only executed once for the **first chunk**, but the code shows "API request attempt 1 successful" which means the stream was successfully created. However, the while loop is not progressing because the stream is not emitting chunks.

### 2. API Stream Generator Issue

The stream is created in [`attemptApiRequest`](../libs/agent-lib/src/agent/agentV2.ts:739-775):

```typescript
private async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
    try {
        console.debug(`Starting API request attempt ${retryAttempt + 1}`);

        const systemPrompt = await this.getSystemPrompt();
        const workspaceContext = await this.workspace.render();

        const cleanConversationHistory = this.buildCleanConversationHistory(
            this._conversationHistory,
        );

        const streamPromise = this.api.createMessage(
            systemPrompt + "\n" + workspaceContext,
            cleanConversationHistory,
        );

        try {
            const stream = await Promise.race([
                streamPromise,
                this.createTimeoutPromise(this.config.apiRequestTimeout),
            ]);

            console.log(`API request attempt ${retryAttempt + 1} successful`);
            yield* stream;  // This should yield chunks
        } catch (error) {
            if (error instanceof Error && error.message.includes('timed out')) {
                throw new Error(`API request timed out after ${this.config.apiRequestTimeout}ms`);
            }
            throw error;
        }
    } catch (error) {
        console.error(`API request attempt ${retryAttempt + 1} failed:`, error);
        throw error;
    }
}
```

**The Issue**: The `yield* stream` statement should be yielding chunks from the API stream. The message "API request attempt 1 successful" indicates that the stream was created, but the stream itself is not producing any chunks.

### 3. ZAi Handler Stream Generation

Looking at [`BaseOpenAiCompatibleProvider.createMessage`](../libs/agent-lib/src/api/providers/base-openai-compatible-provider.ts:127-204):

```typescript
override async *createMessage(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    metadata?: ApiHandlerCreateMessageMetadata,
): ApiStream {
    const stream = await this.createStream(systemPrompt, messages, metadata);

    const matcher = new XmlMatcher(
        'think',
        (chunk) =>
        ({
            type: chunk.matched ? 'reasoning' : 'text',
            text: chunk.data,
        }) as const,
    );

    let lastUsage: OpenAI.CompletionUsage | undefined;

    for await (const chunk of stream) {
        // Check for provider-specific error responses
        const chunkAny = chunk as any;
        if (
            chunkAny.base_resp?.status_code &&
            chunkAny.base_resp.status_code !== 0
        ) {
            throw new Error(
                `${this.providerName} API Error (${chunkAny.base_resp.status_code}): ${chunkAny.base_resp.status_msg || 'Unknown error'}`,
            );
        }

        const delta = chunk.choices?.[0]?.delta;

        if (delta?.content) {
            for (const processedChunk of matcher.update(delta.content)) {
                yield processedChunk;
            }
        }

        if (delta) {
            for (const key of ['reasoning_content', 'reasoning'] as const) {
                if (key in delta) {
                    const reasoning_content =
                        ((delta as any)[key] as string | undefined) || '';
                    if (reasoning_content?.trim()) {
                        yield { type: 'reasoning', text: reasoning_content };
                    }
                    break;
                }
            }
        }

        // Emit raw tool call chunks
        if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
                yield {
                    type: 'tool_call_partial',
                    index: toolCall.index,
                    id: toolCall.id,
                    name: toolCall.function?.name,
                    arguments: toolCall.function?.arguments,
                };
            }
        }

        if (chunk.usage) {
            lastUsage = chunk.usage;
        }
    }

    if (lastUsage) {
        yield this.processUsageMetrics(lastUsage, this.getModel().info);
    }

    // Process any remaining content
    for (const processedChunk of matcher.final()) {
        yield processedChunk;
    }
}
```

**The Issue**: This generator only yields chunks when:

1. `delta?.content` exists (text content)
2. `delta?.reasoning_content` or `delta?.reasoning` exists (reasoning)
3. `delta?.tool_calls` exists (tool calls)
4. `chunk.usage` exists (usage metrics)

If the LLM response doesn't contain any of these, **no chunks are yielded**, and the stream hangs waiting for more data.

### 4. Possible Root Causes

1. **Empty or Invalid LLM Response**: The LLM might be returning an empty response or a response that doesn't contain any of the expected fields (content, reasoning, tool_calls, usage).

2. **Protocol Mismatch**: The default configuration uses `toolProtocol: 'xml'` (line 52 of agentV2.ts), but the ZAi handler is an OpenAI-compatible provider that uses native tool calling. The LLM might not be generating XML-formatted tool calls.

3. **Model Configuration**: The model `glm-4.7` might not support the requested features or might require different parameters.

4. **System Prompt Issue**: The system prompt combined with workspace context might be too long or malformed, causing the LLM to not respond properly.

5. **API Key Issue**: While the stream was created successfully, the API might be rejecting the request silently or returning an error that's not being caught.

## Detailed Flow Analysis

### Execution Flow:

1. [`agent.start('Search for information about medical terminology')`](../libs/agent-lib/src/agent/agentV2.ts:319) is called
2. Status changes to 'running' → **Status Changed logged**
3. User message added to history → **Message Added logged**
4. [`requestLoop()`](../libs/agent-lib/src/agent/agentV2.ts:374) is called
5. [`attemptApiRequest()`](../libs/agent-lib/src/agent/agentV2.ts:739) is called
6. [`this.api.createMessage()`](../libs/agent-lib/src/api/providers/base-openai-compatible-provider.ts:127) is called
7. **"Starting API request attempt 1"** is logged
8. Stream is created and race with timeout completes successfully
9. **"API request attempt 1 successful"** is logged
10. [`collectCompleteResponse()`](../libs/agent-lib/src/agent/agentV2.ts:707) starts iterating the stream
11. First chunk is awaited → **console.log(item)** should execute (but we don't see this in the output)
12. **HANGS HERE** - The stream is not yielding any chunks

### Why the Hang Occurs:

The `for await (const chunk of stream)` loop in [`createMessage`](../libs/agent-lib/src/api/providers/base-openai-compatible-provider.ts:145) is waiting for chunks from the OpenAI API stream. If:

- The API is not sending any data
- The API response doesn't contain the expected fields
- The connection is hanging without timeout

Then the loop will wait indefinitely, and the `collectCompleteResponse` method will never receive any chunks.

## Recommendations

### Immediate Fixes:

1. **Add More Logging**: Add logging before and after the `for await` loop in `createMessage` to see if the stream is being entered.

2. **Add Timeout to Stream Iteration**: Add a timeout to the stream iteration in `collectCompleteResponse` to prevent indefinite hanging.

3. **Check API Response**: Log the raw chunk data to see what the API is actually returning.

4. **Verify Tool Protocol**: Ensure the tool protocol matches the provider's capabilities. ZAi uses OpenAI-compatible API, so it should use native tool calling, not XML.

5. **Add Error Handling**: Add error handling for empty or invalid API responses.

### Code Changes Needed:

#### 1. Add logging in `createMessage`:

```typescript
override async *createMessage(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    metadata?: ApiHandlerCreateMessageMetadata,
): ApiStream {
    const stream = await this.createStream(systemPrompt, messages, metadata);
    console.log('[DEBUG] Stream created, starting iteration');

    // ... existing code ...

    let chunkCount = 0;
    for await (const chunk of stream) {
        chunkCount++;
        console.log(`[DEBUG] Received chunk ${chunkCount}:`, JSON.stringify(chunk).substring(0, 200));

        // ... existing processing ...
    }

    console.log(`[DEBUG] Stream iteration complete, total chunks: ${chunkCount}`);

    // ... rest of the method ...
}
```

#### 2. Add timeout to stream collection:

```typescript
private async collectCompleteResponse(status: TaskStatus): Promise<ApiStreamChunk[]> {
    const stream = this.attemptApiRequest();
    const chunks: ApiStreamChunk[] = [];

    try {
        const iterator = stream[Symbol.asyncIterator]();

        // Add timeout for the entire stream collection
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Stream collection timed out after ${this.config.apiRequestTimeout}ms`));
            }, this.config.apiRequestTimeout);
        });

        let item = await Promise.race([iterator.next(), timeoutPromise]);
        console.log('[DEBUG] First chunk received:', item);

        while (!item.done) {
            if (status === 'aborted') {
                console.log('[DEBUG] Stream collection aborted');
                return chunks;
            }

            const chunk = item.value;
            if (chunk) {
                console.log(`[DEBUG] Adding chunk type: ${chunk.type}`);
                chunks.push(chunk);
            }

            item = await Promise.race([iterator.next(), timeoutPromise]);
        }

        console.log(`[DEBUG] Stream collection complete, ${chunks.length} chunks collected`);
        return chunks;
    } catch (error) {
        console.error('Error collecting complete response:', error);
        throw error;
    }
}
```

#### 3. Fix tool protocol configuration:

The default configuration uses `toolProtocol: 'xml'` but ZAi is an OpenAI-compatible provider. Consider changing the default:

```typescript
export const defaultApiConfig: ProviderSettings = {
  apiProvider: 'zai',
  apiKey: process.env['GLM_API_KEY'],
  apiModelId: 'glm-4.7',
  toolProtocol: 'native', // Changed from 'xml' to 'native'
  zaiApiLine: 'china_coding',
};
```

Or verify that the ZAi provider actually supports XML tool calling.

## Next Steps

1. Add the logging changes above to see what's actually happening
2. Test with a simpler query to see if the issue is query-specific
3. Try with a different model or provider to isolate the issue
4. Check the ZAi API documentation to ensure correct configuration
5. Verify the API key is valid and has sufficient quota
