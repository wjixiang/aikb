import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentFactory } from '../AgentFactory.js';
import type { ApiClient } from 'llm-api-client';
import { AgentStatus } from '../../common/types.js';
import { MessageBus } from '../../runtime/topology/messaging/MessageBus.js';

// Create a mock messageBus for testing
function createMockMessageBus() {
  return new MessageBus();
}

/**
 * Quick unit test for Agent with mocked ApiClient
 * Uses the new AgentFactory API
 */
describe('Agent - Quick Integration Test', () => {
  let mockApiClient: ApiClient;

  beforeEach(() => {
    mockApiClient = {
      makeRequest: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create agent with mocked ApiClient', async () => {
    const messageBus = createMockMessageBus();
    const container = AgentFactory.create(
      {
        agent: { sop: 'Test SOP' },
        api: {
          apiProvider: 'zai',
          apiKey: 'test-key',
          apiModelId: 'test-model',
        },
      },
      messageBus,
    );

    const agent = await container.getAgent();
    expect(agent).toBeDefined();
    expect(agent.status).toBe(AgentStatus.Sleeping);
  });

  it('should run agent with mocked ApiClient', async () => {
    const mockMakeRequest = vi.fn().mockResolvedValueOnce({
      textResponse: 'Task completed',
      toolCalls: [
        {
          id: 'call-1',
          call_id: 'call-1',
          type: 'function_call',
          name: 'attempt_completion',
          arguments: JSON.stringify({ result: 'Done' }),
        },
      ],
      requestTime: 100,
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const mockClient = {
      makeRequest: mockMakeRequest,
    } as unknown as ApiClient;

    const messageBus = createMockMessageBus();
    const container = AgentFactory.create(
      {
        agent: { sop: 'Test SOP' },
        api: {
          apiProvider: 'zai',
          apiKey: 'test-key',
          apiModelId: 'test-model',
        },
      },
      messageBus,
    );

    const agent = await container.getAgent();

    vi.spyOn(agent as any, 'apiClient', 'get').mockReturnValue(mockClient);

    const startPromise = agent.start();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Agent start timed out')), 3000),
    );

    await Promise.race([startPromise, timeout]);

    expect(mockMakeRequest).toHaveBeenCalled();
  }, 10000);
});
