/**
 * AckTracker - Unit Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  AckTracker,
  createAckTracker,
  type IAckTracker,
} from '../messaging/AckTracker.js';
import type { TopologyMessage } from '../types.js';
import { createMessage } from '../types.js';

describe('AckTracker', () => {
  let tracker: IAckTracker;

  beforeEach(() => {
    tracker = createAckTracker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('track / untrack / isTracking', () => {
    it('should track and untrack conversations', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback, 5000);

      expect(tracker.isTracking('conv-1')).toBe(true);

      tracker.untrack('conv-1');

      expect(tracker.isTracking('conv-1')).toBe(false);
    });

    it('should replace existing tracking', () => {
      const callback1 = { onTimeout: vi.fn(), onAck: vi.fn() };
      const callback2 = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback1, 5000);
      tracker.track('conv-1', callback2, 5000);

      const ack = createMessage('to', 'from', {}, 'ack');
      tracker.acknowledge('conv-1', ack);

      expect(callback1.onAck).not.toHaveBeenCalled();
      expect(callback2.onAck).toHaveBeenCalled();
    });
  });

  describe('acknowledge', () => {
    it('should call onAck callback', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };
      const ack = createMessage('to', 'from', {}, 'ack');

      tracker.track('conv-1', callback, 5000);
      tracker.acknowledge('conv-1', ack);

      expect(callback.onAck).toHaveBeenCalledWith(ack);
    });

    it('should untrack after acknowledge', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };
      const ack = createMessage('to', 'from', {}, 'ack');

      tracker.track('conv-1', callback, 5000);
      tracker.acknowledge('conv-1', ack);

      expect(tracker.isTracking('conv-1')).toBe(false);
    });
  });

  describe('timeout', () => {
    it('should call onTimeout after specified time', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback, 5000);

      vi.advanceTimersByTime(5000);

      expect(callback.onTimeout).toHaveBeenCalled();
    });

    it('should untrack after timeout', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback, 5000);

      vi.advanceTimersByTime(5000);

      expect(tracker.isTracking('conv-1')).toBe(false);
    });

    it('should not call onAck after timeout', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback, 5000);

      vi.advanceTimersByTime(5000);

      const ack = createMessage('to', 'from', {}, 'ack');
      tracker.acknowledge('conv-1', ack);

      expect(callback.onAck).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all tracking', () => {
      const callback1 = { onTimeout: vi.fn(), onAck: vi.fn() };
      const callback2 = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback1, 5000);
      tracker.track('conv-2', callback2, 5000);

      tracker.clear();

      expect(tracker.isTracking('conv-1')).toBe(false);
      expect(tracker.isTracking('conv-2')).toBe(false);
    });
  });

  describe('getTrackedCount / getTrackedIds', () => {
    it('should return tracked count and ids', () => {
      const callback = { onTimeout: vi.fn(), onAck: vi.fn() };

      tracker.track('conv-1', callback, 5000);
      tracker.track('conv-2', callback, 5000);

      expect(tracker.getTrackedCount()).toBe(2);
      expect(tracker.getTrackedIds()).toEqual(['conv-1', 'conv-2']);
    });
  });
});
