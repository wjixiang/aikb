/**
 * Unit tests for A2A Handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2AHandler } from '../A2AHandler';
import type { IMessageBus } from '../../runtime/topology/messaging/MessageBus';
import type { A2AMessage } from '../types';
import {
  createA2AMessage,
  createA2AQueryMessage,
} from '../types';

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
      maxRetries: 3,
      defaultTtl: 10,
    })),
  };
};

describe('A2AHandler', () => {
  let handler: A2AHandler;
  let messageBus: IMessageBus;

  const createQueryMessage = (from: string, to: string, query = 'What is the status?'): A2AMessage => {
    return createA2AQueryMessage(from, to, query);
  };

  beforeEach(() => {
    messageBus = createMockMessageBus();
    handler = new A2AHandler(messageBus, {
      instanceId: 'test-agent-001',
      supportedTypes: ['query', 'event', 'cancel', 'response'],
      handlerTimeout: 5000,
    });
  });

  describe('constructor', () => {
    it('should create handler with correct instanceId', () => {
      expect(handler).toBeDefined();
    });
  });

  describe('handleMessage', () => {
    it('should ignore messages not addressed to this agent', async () => {
      const message = createQueryMessage('agent-002', 'agent-003');

      await handler.handleMessage(message);
    });

    it('should process query message with registered handler', async () => {
      const message = createQueryMessage('agent-002', 'test-agent-001');

      handler.onQuery(async (payload, ctx) => ({
        messageId: 'resp-001',
        content: { output: 'Query result', status: 'completed' },
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
        { eventType: 'query:completed', data: { queryId: 'q-001' } },
      );

      const eventHandler = vi.fn();
      handler.onEvent(eventHandler);

      await handler.handleMessage(eventMessage);

      expect(eventHandler).toHaveBeenCalled();
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

  describe('setQueryCompletionCallback / completeQuery', () => {
    it('should invoke callback when completeQuery is called', () => {
      const callback = vi.fn();
      handler.setQueryCompletionCallback(callback);

      handler.completeQuery('conv-001', { result: 'done' }, 'completed');

      expect(callback).toHaveBeenCalledWith('conv-001', { result: 'done' }, 'completed');
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
