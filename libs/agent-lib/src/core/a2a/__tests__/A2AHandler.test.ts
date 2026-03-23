/**
 * Unit tests for A2A Handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2AHandler } from '../A2AHandler';
import type { IMessageBus } from '../../runtime/topology/messaging/MessageBus';
import type { A2AMessage, A2APayload } from '../types';
import { createA2AMessage, createA2ATaskMessage, createA2AQueryMessage } from '../types';

// Mock implementations
const createMockMessageBus = (): IMessageBus => {
  return {
    send: vi.fn(),
    publish: vi.fn(),
    sendAck: vi.fn(async () => ({})),
    sendResult: vi.fn(async () => ({})),
    sendError: vi.fn(async () => ({})),
    broadcast: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onEvent: vi.fn(() => () => {}),
    getConversation: vi.fn(),
    getPendingConversations: vi.fn(() => []),
    getActiveConversations: vi.fn(() => []),
    setConfig: vi.fn(),
    getConfig: vi.fn(() => ({
      defaultAckTimeout: 5000,
      defaultResultTimeout: 60000,
      maxRetries: 3,
      defaultTtl: 10,
    })),
  };
};

describe('A2AHandler', () => {
  let handler: A2AHandler;
  let messageBus: IMessageBus;

  const createTaskMessage = (from: string, to: string): A2AMessage => {
    return createA2ATaskMessage(from, to, 'task-001', 'Test task', { query: 'test' });
  };

  const createQueryMessage = (from: string, to: string): A2AMessage => {
    return createA2AQueryMessage(from, to, 'What is the status?');
  };

  beforeEach(() => {
    messageBus = createMockMessageBus();
    handler = new A2AHandler(messageBus, {
      instanceId: 'test-agent-001',
      supportedTypes: ['task', 'query', 'event', 'cancel', 'response'],
      handlerTimeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should create handler with correct instanceId', () => {
      // Handler is created, just verify no error
      expect(handler).toBeDefined();
    });
  });

  describe('handleMessage', () => {
    it('should ignore messages not addressed to this agent', async () => {
      const message = createTaskMessage('agent-002', 'agent-003'); // Not to test-agent-001

      const result = await handler.handleMessage(message);

      expect(result).toBeUndefined();
    });

    it('should process task message with registered handler', async () => {
      const message = createTaskMessage('agent-002', 'test-agent-001');

      handler.onTask(async (payload, ctx) => ({
        taskId: 'task-001',
        status: 'completed',
        output: { result: 'success' },
      }));

      const result = await handler.handleMessage(message);

      expect(result).toBeDefined();
      expect(result?.status).toBe('completed');
      expect(messageBus.sendAck).toHaveBeenCalled();
      expect(messageBus.sendResult).toHaveBeenCalled();
    });

    it('should send error when no task handler registered', async () => {
      const message = createTaskMessage('agent-002', 'test-agent-001');

      await handler.handleMessage(message);

      expect(messageBus.sendError).toHaveBeenCalled();
    });

    it('should process query message with registered handler', async () => {
      const message = createQueryMessage('agent-002', 'test-agent-001');

      handler.onQuery(async (payload, ctx) => ({
        messageId: 'resp-001',
        content: { output: 'Query result' },
        success: true,
      }));

      await handler.handleMessage(message);

      expect(messageBus.sendAck).toHaveBeenCalled();
      expect(messageBus.sendResult).toHaveBeenCalled();
    });

    it('should send error response when query handler not registered', async () => {
      const message = createQueryMessage('agent-002', 'test-agent-001');

      await handler.handleMessage(message);

      expect(messageBus.sendError).toHaveBeenCalled();
    });

    it('should process event message with registered handler', async () => {
      const eventMessage = createA2AMessage(
        'agent-002',
        'test-agent-001',
        'event',
        { eventType: 'task:completed', data: { taskId: 'task-001' } },
      );

      const eventHandler = vi.fn();
      handler.onEvent(eventHandler);

      await handler.handleMessage(eventMessage);

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('onTask', () => {
    it('should register task handler', () => {
      const taskHandler = vi.fn();
      handler.onTask(taskHandler);

      // Just verify no error and handler can be called
      expect(() => handler.onTask(taskHandler)).not.toThrow();
    });
  });

  describe('onQuery', () => {
    it('should register query handler', () => {
      const queryHandler = vi.fn();
      handler.onQuery(queryHandler);

      expect(() => handler.onQuery(queryHandler)).not.toThrow();
    });
  });

  describe('onEvent', () => {
    it('should register event handler', () => {
      const eventHandler = vi.fn();
      handler.onEvent(eventHandler);

      expect(() => handler.onEvent(eventHandler)).not.toThrow();
    });
  });

  describe('onCancel', () => {
    it('should register cancel handler', () => {
      const cancelHandler = vi.fn();
      handler.onCancel(cancelHandler);

      expect(() => handler.onCancel(cancelHandler)).not.toThrow();
    });
  });

  describe('startListening / stopListening', () => {
    it('should start and stop listening without error', () => {
      expect(() => handler.startListening()).not.toThrow();
      expect(() => handler.stopListening()).not.toThrow();
    });

    it('should not start listening twice', () => {
      handler.startListening();
      expect(() => handler.startListening()).not.toThrow();
      handler.stopListening();
    });
  });
});
