/**
 * Conversation - Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConversationManager,
  createConversationManager,
  type IConversationManager,
} from '../messaging/Conversation.js';
import type { TopologyMessage } from '../types.js';
import { createMessage } from '../types.js';

describe('ConversationManager', () => {
  let manager: IConversationManager;

  beforeEach(() => {
    manager = createConversationManager();
  });

  describe('create / get', () => {
    it('should create and retrieve a conversation', () => {
      const request = createMessage('from', 'to', { task: 'test' }, 'request');

      const conversation = manager.create(request);

      expect(conversation.conversationId).toBe(request.conversationId);
      expect(conversation.status).toBe('pending');
      expect(manager.get(conversation.conversationId)).toEqual(conversation);
    });

    it('should create conversation with custom config', () => {
      const request = createMessage('from', 'to', {}, 'request');

      const conversation = manager.create(request, {
        ackTimeout: 10000,
        maxRetries: 5,
      });

      expect(conversation.ackTimeout).toBe(10000);
      expect(conversation.maxRetries).toBe(5);
    });
  });

  describe('setAck / setResult', () => {
    it('should update conversation on ACK', () => {
      const request = createMessage('from', 'to', {}, 'request');
      const conversation = manager.create(request);
      const ack = createMessage('to', 'from', { status: 'ok' }, 'ack');

      manager.setAck(conversation.conversationId, ack);

      const updated = manager.get(conversation.conversationId);
      expect(updated?.status).toBe('acknowledged');
      expect(updated?.ack).toEqual(ack);
    });

    it('should update conversation on result', () => {
      const request = createMessage('from', 'to', {}, 'request');
      const conversation = manager.create(request);
      const result = createMessage('to', 'from', { data: 'result' }, 'result');

      manager.setResult(conversation.conversationId, result);

      const updated = manager.get(conversation.conversationId);
      expect(updated?.status).toBe('completed');
      expect(updated?.result).toEqual(result);
    });
  });

  describe('updateStatus', () => {
    it('should update conversation status', () => {
      const request = createMessage('from', 'to', {}, 'request');
      const conversation = manager.create(request);

      manager.updateStatus(conversation.conversationId, 'failed');

      const updated = manager.get(conversation.conversationId);
      expect(updated?.status).toBe('failed');
    });
  });

  describe('incrementRetry', () => {
    it('should increment retry count', () => {
      const request = createMessage('from', 'to', {}, 'request');
      const conversation = manager.create(request);

      const count1 = manager.incrementRetry(conversation.conversationId);
      const count2 = manager.incrementRetry(conversation.conversationId);

      expect(count1).toBe(1);
      expect(count2).toBe(2);
    });
  });

  describe('getPending / getActive', () => {
    it('should return pending conversations', () => {
      const req1 = createMessage('from', 'to', {}, 'request');
      const req2 = createMessage('from', 'to', {}, 'request');

      manager.create(req1);
      manager.create(req2);

      const pending = manager.getPending();

      expect(pending).toHaveLength(2);
    });

    it('should return active conversations', () => {
      const request = createMessage('from', 'to', {}, 'request');
      const conversation = manager.create(request);

      manager.updateStatus(conversation.conversationId, 'acknowledged');

      const active = manager.getActive();

      expect(active).toHaveLength(1);
    });
  });

  describe('onConversationUpdate', () => {
    it('should notify on update', () => {
      const request = createMessage('from', 'to', {}, 'request');
      const conversation = manager.create(request);

      let updateCalled = false;
      manager.onConversationUpdate(() => {
        updateCalled = true;
      });

      manager.updateStatus(conversation.conversationId, 'failed');

      expect(updateCalled).toBe(true);
    });
  });
});
