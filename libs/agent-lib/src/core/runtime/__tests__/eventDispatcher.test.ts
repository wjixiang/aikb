import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventDispatcher } from '../EventDispatcher.js';
import type { RuntimeEvent, RuntimeEventType } from '../types.js';

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    dispatcher = new EventDispatcher();
  });

  describe('subscribe and unsubscribe', () => {
    it('should subscribe to an event and receive events', () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.subscribe('agent:created', handler);

      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent:created',
          payload: { instanceId: 'agent-1' },
        }),
      );

      unsubscribe();
    });

    it('should return working unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.subscribe('agent:created', handler);

      unsubscribe();
      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      dispatcher.subscribe('agent:created', handler1);
      dispatcher.subscribe('agent:created', handler2);

      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should clean up empty handler sets', () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.subscribe('agent:created', handler);

      expect(dispatcher.getSubscriberCount('agent:created')).toBe(1);

      unsubscribe();

      expect(dispatcher.getSubscriberCount('agent:created')).toBe(0);
    });
  });

  describe('subscribeAll', () => {
    it('should subscribe to multiple event types', () => {
      const handler = vi.fn();
      const unsubscribe = dispatcher.subscribeAll(
        ['agent:created', 'agent:started', 'agent:stopped'],
        handler,
      );

      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });
      dispatcher.emitEvent('agent:started', { instanceId: 'agent-1' });

      expect(handler).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it('should unsubscribe from all events', () => {
      const handler = vi.fn();
      dispatcher.subscribeAll(
        ['agent:created', 'agent:started'],
        handler,
      );

      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });
      dispatcher.emitEvent('agent:started', { instanceId: 'agent-1' });

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('emit', () => {
    it('should emit a RuntimeEvent object', () => {
      const handler = vi.fn();
      dispatcher.subscribe('task:completed', handler);

      const event: RuntimeEvent = {
        id: 'evt_123',
        type: 'task:completed',
        timestamp: new Date(),
        payload: { taskId: 'task-1', result: 'success' },
      };

      dispatcher.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not throw if no handlers subscribed', () => {
      expect(() => {
        dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });
      }).not.toThrow();
    });
  });

  describe('emitEvent', () => {
    it('should auto-generate event id and timestamp', () => {
      const handler = vi.fn();
      dispatcher.subscribe('agent:created', handler);

      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent:created',
          id: expect.stringContaining('evt_'),
          timestamp: expect.any(Date),
          payload: { instanceId: 'agent-1' },
        }),
      );
    });
  });

  describe('getSubscriberCount', () => {
    it('should return 0 for non-subscribed event', () => {
      expect(dispatcher.getSubscriberCount('agent:created')).toBe(0);
    });

    it('should return correct count after subscriptions', () => {
      dispatcher.subscribe('agent:created', vi.fn());
      dispatcher.subscribe('agent:created', vi.fn());
      dispatcher.subscribe('agent:started', vi.fn());

      expect(dispatcher.getSubscriberCount('agent:created')).toBe(2);
      expect(dispatcher.getSubscriberCount('agent:started')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all handlers for a specific event type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      dispatcher.subscribe('agent:created', handler1);
      dispatcher.subscribe('agent:created', handler2);
      dispatcher.subscribe('agent:started', vi.fn());

      dispatcher.clear('agent:created');

      expect(dispatcher.getSubscriberCount('agent:created')).toBe(0);
      expect(dispatcher.getSubscriberCount('agent:started')).toBe(1);

      dispatcher.emitEvent('agent:created', {});
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should remove all handlers for all event types', () => {
      dispatcher.subscribe('agent:created', vi.fn());
      dispatcher.subscribe('agent:started', vi.fn());
      dispatcher.subscribe('task:submitted', vi.fn());

      dispatcher.clearAll();

      expect(dispatcher.getSubscriberCount('agent:created')).toBe(0);
      expect(dispatcher.getSubscriberCount('agent:started')).toBe(0);
      expect(dispatcher.getSubscriberCount('task:submitted')).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should catch and log handler errors without propagating', () => {
      const errorHandler = vi.fn();
      vi.spyOn(console, 'error').mockImplementation(errorHandler);

      const failingHandler = vi.fn(() => {
        throw new Error('Handler failed');
      });
      const normalHandler = vi.fn();

      dispatcher.subscribe('agent:created', failingHandler);
      dispatcher.subscribe('agent:created', normalHandler);

      dispatcher.emitEvent('agent:created', { instanceId: 'agent-1' });

      expect(failingHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledWith(
        '[EventDispatcher] Error in handler for agent:created:',
        expect.any(Error),
      );

      vi.restoreAllMocks();
    });
  });

  describe('event types', () => {
    it('should handle all standard runtime event types', () => {
      const handler = vi.fn();
      const eventTypes: RuntimeEventType[] = [
        'agent:created',
        'agent:started',
        'agent:stopped',
        'agent:destroyed',
        'agent:error',
        'agent:idle',
        'task:submitted',
        'task:assigned',
        'task:started',
        'task:completed',
        'task:failed',
      ];

      eventTypes.forEach((type) => {
        dispatcher.subscribe(type, handler);
      });

      eventTypes.forEach((type) => {
        dispatcher.emitEvent(type, { type });
      });

      expect(handler).toHaveBeenCalledTimes(eventTypes.length);
    });
  });
});
