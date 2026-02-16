/**
 * Examples demonstrating the new unified ToolCall interface
 */

import { ToolCall, ApiResponse } from './ApiClient.interface';
import { BamlApiClient } from './BamlApiClient';
import { OpenaiCompatibleApiClient } from './OpenaiCompatibleApiClient';

// ============================================================================
// Example 1: Single Tool Call
// ============================================================================

const singleToolCallResponse: ApiResponse = {
  toolCalls: [
    {
      id: 'fc_abc123',
      call_id: 'call_abc123',
      type: 'function_call',
      name: 'search_database',
      arguments: JSON.stringify({
        query: 'diabetes treatment',
        limit: 10,
      }),
    },
  ],
  textResponse: '',
  requestTime: 1200,
  tokenUsage: {
    promptTokens: 80,
    completionTokens: 30,
    totalTokens: 110,
  },
};

// ============================================================================
// Example 2: Multiple Tool Calls (Parallel Execution)
// ============================================================================

const multipleToolCallsResponse: ApiResponse = {
  toolCalls: [
    {
      id: 'fc_1',
      call_id: 'call_1',
      type: 'function_call',
      name: 'search_database',
      arguments: JSON.stringify({ query: 'diabetes' }),
    },
    {
      id: 'fc_2',
      call_id: 'call_2',
      type: 'function_call',
      name: 'get_patient_records',
      arguments: JSON.stringify({ patient_id: '12345' }),
    },
    {
      id: 'fc_3',
      call_id: 'call_3',
      type: 'function_call',
      name: 'analyze_symptoms',
      arguments: JSON.stringify({ symptoms: ['fever', 'cough'] }),
    },
  ],
  textResponse: 'Processing multiple requests...',
  requestTime: 2500,
  tokenUsage: {
    promptTokens: 150,
    completionTokens: 80,
    totalTokens: 230,
  },
};

// ============================================================================
// Example 3: Attempt Completion (Now a Regular Tool Call)
// ============================================================================

const completionResponse: ApiResponse = {
  toolCalls: [
    {
      id: 'fc_completion',
      call_id: 'call_completion',
      type: 'function_call',
      name: 'attempt_completion',
      arguments: JSON.stringify({
        result: 'Research completed successfully. Found 15 relevant studies.',
      }),
    },
  ],
  textResponse: 'Task completed',
  requestTime: 800,
  tokenUsage: {
    promptTokens: 50,
    completionTokens: 25,
    totalTokens: 75,
  },
};

// ============================================================================
// Example 4: Using BamlApiClient
// ============================================================================

async function exampleBamlClient() {
  const client = new BamlApiClient();

  const response = await client.makeRequest(
    'You are a medical research assistant',
    'Current workspace: Medical Database',
    ['User: Search for diabetes treatments'],
    { timeout: 40000 }
  );

  // Process response
  console.log(`Request took ${response.requestTime}ms`);
  console.log(`Tokens used: ${response.tokenUsage.totalTokens}`);

  for (const toolCall of response.toolCalls) {
    console.log(`Tool: ${toolCall.name}`);
    console.log(`Arguments: ${toolCall.arguments}`);

    if (toolCall.name === 'attempt_completion') {
      console.log('Task completed!');
      break;
    }
  }
}

// ============================================================================
// Example 5: Using OpenaiCompatibleApiClient
// ============================================================================

async function exampleOpenAIClient() {
  const client = new OpenaiCompatibleApiClient({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    model: 'gpt-4',
    baseURL: 'https://api.openai.com/v1',
    temperature: 0.7,
    maxTokens: 2000,
  });

  const response = await client.makeRequest(
    'You are a helpful assistant',
    'Current context',
    ['User: Hello'],
    { timeout: 30000 }
  );

  // Handle multiple tool calls
  console.log(`Request took ${response.requestTime}ms`);
  console.log(`Tokens used: ${response.tokenUsage.totalTokens}`);

  const results = await Promise.all(
    response.toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.arguments);
      // Execute tool and return result
      return {
        tool_call_id: toolCall.id,
        result: `Executed ${toolCall.name} with args: ${JSON.stringify(args)}`,
      };
    })
  );

  console.log('All tools executed:', results);
}

// ============================================================================
// Example 6: Processing Tool Calls in Agent
// ============================================================================

async function processToolCalls(response: ApiResponse) {
  let didComplete = false;

  console.log(`Request time: ${response.requestTime}ms`);
  console.log(`Token usage: ${JSON.stringify(response.tokenUsage)}`);

  for (const toolCall of response.toolCalls) {
    console.log(`\nProcessing tool: ${toolCall.name}`);

    // Parse arguments
    let args: any = {};
    try {
      args = JSON.parse(toolCall.arguments);
    } catch (e) {
      console.error('Failed to parse arguments:', e);
      continue;
    }

    // Check for completion
    if (toolCall.name === 'attempt_completion') {
      console.log('Completion result:', args.result);
      didComplete = true;
      break;
    }

    // Execute tool (pseudo-code)
    // const result = await executeToolOnWorkspace(toolCall.name, args);
    // console.log('Tool result:', result);
  }

  return didComplete;
}

// ============================================================================
// Example 7: Backward Compatibility - Legacy Format Conversion
// ============================================================================

// The BamlApiClient automatically converts legacy formats:
//
// Legacy format:
// {
//   toolName: "search_database",
//   toolParams: '{"query": "diabetes"}'
// }
//
// Automatically converted to:
// {
//   toolCalls: [{
//     id: "fc_generated123",
//     call_id: "call_generated123",
//     type: "function_call",
//     name: "search_database",
//     arguments: '{"query": "diabetes"}'
//   }],
//   textResponse: '',
//   requestTime: 1000,
//   tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
// }

// ============================================================================
// Example 8: Error Handling
// ============================================================================

async function exampleWithErrorHandling() {
  const client = new BamlApiClient();

  try {
    const response = await client.makeRequest(
      'System prompt',
      'Workspace context',
      ['Memory context'],
      { timeout: 5000 } // Short timeout for demo
    );

    console.log(`Request took ${response.requestTime}ms`);
    console.log(`Tokens used: ${response.tokenUsage.totalTokens}`);

    for (const toolCall of response.toolCalls) {
      try {
        const args = JSON.parse(toolCall.arguments);
        // Process tool call
      } catch (parseError) {
        console.error(`Failed to parse arguments for ${toolCall.name}:`, parseError);
        // Handle parse error
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('timed out')) {
      console.error('Request timed out');
    } else {
      console.error('Request failed:', error);
    }
  }
}

// ============================================================================
// Example 9: Custom Tool Call Creation
// ============================================================================

function createToolCall(
  name: string,
  args: Record<string, any>,
  idPrefix: string = 'fc'
): ToolCall {
  const id = `${idPrefix}_${Math.random().toString(36).substring(2, 15)}`;
  return {
    id,
    call_id: `call_${id.substring(3)}`,
    type: 'function_call',
    name,
    arguments: JSON.stringify(args),
  };
}

// Usage:
const customToolCall = createToolCall('my_custom_tool', {
  param1: 'value1',
  param2: 42,
});

console.log(customToolCall);
// Output:
// {
//   id: "fc_abc123xyz",
//   call_id: "call_abc123xyz",
//   type: "function_call",
//   name: "my_custom_tool",
//   arguments: '{"param1":"value1","param2":42}'
// }

// ============================================================================
// Export examples for testing
// ============================================================================

export {
  singleToolCallResponse,
  multipleToolCallsResponse,
  completionResponse,
  exampleBamlClient,
  exampleOpenAIClient,
  processToolCalls,
  exampleWithErrorHandling,
  createToolCall,
};
