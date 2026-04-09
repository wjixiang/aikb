import { MemoryModule } from '../MemoryModule';
import { ApiClient, ApiResponse, ApiTimeoutConfig, ChatCompletionTool } from 'llm-api-client';
import { Logger } from 'pino';
import { vi } from 'vitest';

class MockApiClient implements ApiClient {
  async makeRequest(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: string[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: ChatCompletionTool[],
  ): Promise<ApiResponse> {
    return {
      toolCalls: [
        {
          id: 'call_123',
          call_id: 'call_123',
          type: 'function_call',
          name: 'continue_thinking',
          arguments: JSON.stringify({
            continueThinking: false,
            thoughtNumber: 1,
            totalThoughts: 1,
          }),
        },
      ],
      textResponse: 'This is a mock response.',
      requestTime: 100,
      tokenUsage: {
        promptTokens: 50,
        completionTokens: 20,
        totalTokens: 70,
      },
    };
  }
}

const mockClient = new MockApiClient();

const mockLogger: Logger = {
  level: 'info',
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(() => mockLogger as any),
} as any;

describe('MemoryModule - Workspace Context Diff', () => {
  let memoryModule: MemoryModule;

  beforeEach(() => {
    memoryModule = new MemoryModule(mockLogger, {}, mockClient);
  });

  it('should record workspace context on first call', async () => {
    await memoryModule.recordWorkspaceContext('initial context', 1);
    const contexts = memoryModule.getWorkspaceContexts();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].content).toBe('initial context');
    expect(contexts[0].iteration).toBe(1);
  });

  it('should skip unchanged workspace context', async () => {
    await memoryModule.recordWorkspaceContext('context A', 1);
    await memoryModule.recordWorkspaceContext('context A', 2);

    const contexts = memoryModule.getWorkspaceContexts();
    expect(contexts).toHaveLength(1);
  });

  it('should record changed workspace context', async () => {
    await memoryModule.recordWorkspaceContext('context A', 1);
    await memoryModule.recordWorkspaceContext('context B', 2);

    const contexts = memoryModule.getWorkspaceContexts();
    expect(contexts).toHaveLength(2);
    expect(contexts[1].content).toBe('context B');
  });

  it('should ignore changes in Recent Tool Calls section', async () => {
    await memoryModule.recordWorkspaceContext('context A\n**Recent Tool Calls**\n- tool1', 1);
    await memoryModule.recordWorkspaceContext('context A\n**Recent Tool Calls**\n- tool2', 2);

    const contexts = memoryModule.getWorkspaceContexts();
    expect(contexts).toHaveLength(1);
  });
});
