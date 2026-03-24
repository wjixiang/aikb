/**
 * Unit tests for A2A Client
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2AClient } from '../A2AClient';
import { AgentCardRegistry } from '../AgentCard';
import type { IMessageBus } from '../../runtime/topology/messaging/MessageBus';
import type { TopologyMessage, Conversation } from '../../runtime/topology/types';

// Mock implementations
const createMockMessageBus = (): IMessageBus => {
  const conversations = new Map<string, Conversation>();

  return {
    send: vi.fn(async (message: TopologyMessage) => {
      // Simulate ACK
      return {
        messageId: `ack_${Date.now()}`,
        conversationId: message.conversationId,
        from: message.to,
        to: message.from,
        content: { status: 'acknowledged' },
        messageType: 'ack',
        ttl: 10,
        timestamp: Date.now(),
      };
    }),
    publish: vi.fn(),
    sendAck: vi.fn(),
    sendResult: vi.fn(),
    sendError: vi.fn(),
    broadcast: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onEvent: vi.fn(() => () => {}),
    getConversation: (id: string) => {
      const conv = conversations.get(id);
      // If conversation exists and is completed/has result, return it
      // Otherwise create a mock completed conversation for testing
      if (conv) return conv;
      // Return a completed conversation for the test to pass
      return {
        conversationId: id,
        status: 'completed',
        result: {
          messageId: `result_${Date.now()}`,
          conversationId: id,
          from: 'agent-002',
          to: 'test-agent-001',
          content: {
            messageType: 'response',
            content: { status: 'completed', output: { result: 'success' } },
          },
          messageType: 'response' as const,
          ttl: 10,
          timestamp: Date.now(),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ttl: 10,
      };
    },
    getPendingConversations: () => Array.from(conversations.values()),
    getActiveConversations: () => Array.from(conversations.values()),
    setConfig: vi.fn(),
    getConfig: vi.fn(() => ({
      defaultAckTimeout: 5000,
      defaultResultTimeout: 60000,
      maxRetries: 3,
      defaultTtl: 10,
    })),
  };
};

describe('A2AClient', () => {
  let client: A2AClient;
  let messageBus: IMessageBus;
  let registry: AgentCardRegistry;

  beforeEach(() => {
    messageBus = createMockMessageBus();
    registry = new AgentCardRegistry();
    client = new A2AClient(messageBus, registry, {
      instanceId: 'test-agent-001',
      defaultTimeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should create client with correct instanceId', () => {
      expect(client.getInstanceId()).toBe('test-agent-001');
    });
  });

  describe('sendTask', () => {
    it('should send task message via messageBus', async () => {
      const taskId = 'task-001';
      const description = 'Search PubMed for papers';
      const input = { query: 'cancer treatment' };

      await client.sendTask('agent-002', taskId, description, input);

      expect(messageBus.send).toHaveBeenCalled();
      const sentMessage = (messageBus.send as any).mock.calls[0][0];
      expect(sentMessage.from).toBe('test-agent-001');
      expect(sentMessage.to).toBe('agent-002');
      expect(sentMessage.content.content.taskId).toBe(taskId);
      expect(sentMessage.content.content.description).toBe(description);
      expect(sentMessage.content.content.input).toEqual(input);
    });

    it('should include priority when specified', async () => {
      await client.sendTask('agent-002', 'task-001', 'test', {}, { priority: 'high' });

      const sentMessage = (messageBus.send as any).mock.calls[0][0];
      expect(sentMessage.content.content.priority).toBe('high');
    });
  });

  describe('sendQuery', () => {
    it('should send query message via messageBus', async () => {
      const query = 'What is the status of task-001?';

      await client.sendQuery('agent-002', query);

      expect(messageBus.send).toHaveBeenCalled();
      const sentMessage = (messageBus.send as any).mock.calls[0][0];
      expect(sentMessage.from).toBe('test-agent-001');
      expect(sentMessage.to).toBe('agent-002');
      expect(sentMessage.content.messageType).toBe('query');
      expect(sentMessage.content.content.query).toBe(query);
    });

    it('should include expectedFormat when specified', async () => {
      await client.sendQuery('agent-002', 'test', { expectedFormat: 'json' });

      const sentMessage = (messageBus.send as any).mock.calls[0][0];
      expect(sentMessage.content.content.expectedFormat).toBe('json');
    });
  });

  describe('sendResponse', () => {
    it('should send response via publish (fire-and-forget)', async () => {
      const output = { result: 'success' };
      const status = 'completed';

      await client.sendResponse('agent-002', output, status, {
        conversationId: 'conv-001',
        taskId: 'task-001',
      });

      expect(messageBus.publish).toHaveBeenCalled();
      const publishedMessage = (messageBus.publish as any).mock.calls[0][0];
      expect(publishedMessage.content.messageType).toBe('response');
      expect(publishedMessage.content.content.output).toEqual(output);
      expect(publishedMessage.content.content.status).toBe(status);
    });
  });

  describe('sendEvent', () => {
    it('should send event via publish', async () => {
      const eventType = 'task:completed';
      const data = { taskId: 'task-001' };

      await client.sendEvent('agent-002', eventType, data);

      expect(messageBus.publish).toHaveBeenCalled();
      const publishedMessage = (messageBus.publish as any).mock.calls[0][0];
      expect(publishedMessage.content.messageType).toBe('event');
      expect(publishedMessage.content.content.eventType).toBe(eventType);
      expect(publishedMessage.content.content.data).toEqual(data);
    });
  });

  describe('sendCancel', () => {
    it('should send cancel message', async () => {
      await client.sendCancel('agent-002', 'task-001', 'conv-001');

      expect(messageBus.publish).toHaveBeenCalled();
      const publishedMessage = (messageBus.publish as any).mock.calls[0][0];
      expect(publishedMessage.content.messageType).toBe('cancel');
      expect(publishedMessage.content.content.taskId).toBe('task-001');
    });
  });
});
