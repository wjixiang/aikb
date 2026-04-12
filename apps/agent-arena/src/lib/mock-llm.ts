import type {
  ApiClient,
  ApiResponse,
  ApiTimeoutConfig,
  ChatCompletionTool,
  ToolCall,
} from 'llm-api-client';
import type { Message } from 'llm-api-client';
import type { MockResponseDef } from '../types.js';

let globalCallCounter = 0;

/**
 * Default mock response: calls attempt_completion to terminate the agent loop.
 */
export const DEFAULT_MOCK_RESPONSE: MockResponseDef = {
  toolCalls: [
    { name: 'attempt_completion', arguments: { result: 'Mock completed' } },
  ],
};

/**
 * MockApiClient — deterministic LLM mock for testing.
 *
 * Uses a response queue: each makeRequest pops the next response.
 * When the queue is empty, falls back to the default response.
 */
export class MockApiClient implements ApiClient {
  private responseQueue: MockResponseDef[];
  private defaultResponse: MockResponseDef;
  public callCount = 0;
  public lastRequest: {
    systemPrompt: string;
    workspaceContext: string;
    memoryContext: Message[];
    tools?: ChatCompletionTool[];
  } = {
    systemPrompt: '',
    workspaceContext: '',
    memoryContext: [],
  };

  constructor(
    defaultResponse: MockResponseDef = DEFAULT_MOCK_RESPONSE,
    responseQueue?: MockResponseDef[],
  ) {
    this.defaultResponse = defaultResponse;
    this.responseQueue = responseQueue ?? [];
  }

  async makeRequest(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: Message[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: ChatCompletionTool[],
  ): Promise<ApiResponse> {
    this.callCount++;
    globalCallCounter++;

    this.lastRequest = {
      systemPrompt,
      workspaceContext,
      memoryContext,
      ...(tools && { tools }),
    };

    const response =
      this.responseQueue.length > 0
        ? this.responseQueue.shift()!
        : this.defaultResponse;

    const toolCalls: ToolCall[] = (response.toolCalls ?? []).map((tc, i) => ({
      id: `mock_fc_${globalCallCounter}_${i}`,
      call_id: `mock_call_${globalCallCounter}_${i}`,
      type: 'function_call' as const,
      name: tc.name,
      arguments: JSON.stringify(tc.arguments ?? {}),
    }));

    return {
      toolCalls,
      textResponse: response.textResponse ?? '',
      requestTime: 10,
      tokenUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  /** Reset call counter and queue (for test isolation). */
  reset(): void {
    this.callCount = 0;
    this.responseQueue = [];
    this.lastRequest = {
      systemPrompt: '',
      workspaceContext: '',
      memoryContext: [],
    };
  }
}

export function resetGlobalCallCounter(): void {
  globalCallCounter = 0;
}
