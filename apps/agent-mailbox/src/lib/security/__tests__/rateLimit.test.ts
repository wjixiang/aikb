/**
 * Rate Limiting Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimitConfig,
  WebSocketConnectionTracker,
  generateConnectionId,
} from '../rateLimit.js';

describe('Rate Limiting Module', () => {
  describe('rateLimitConfig', () => {
    it('should have sendMail config', () => {
      expect(rateLimitConfig.sendMail.max).toBe(100);
      expect(rateLimitConfig.sendMail.timeWindow).toBe(60000);
      expect(rateLimitConfig.sendMail.errorResponseBuilder).toBeDefined();
    });

    it('should have getInbox config', () => {
      expect(rateLimitConfig.getInbox.max).toBe(300);
      expect(rateLimitConfig.getInbox.timeWindow).toBe(60000);
    });

    it('should have search config', () => {
      expect(rateLimitConfig.search.max).toBe(50);
      expect(rateLimitConfig.search.timeWindow).toBe(60000);
    });

    it('should have registerAddress config', () => {
      expect(rateLimitConfig.registerAddress.max).toBe(10);
      expect(rateLimitConfig.registerAddress.timeWindow).toBe(60000);
    });

    it('should have default config', () => {
      expect(rateLimitConfig.default.max).toBe(60);
      expect(rateLimitConfig.default.timeWindow).toBe(60000);
    });

    it('should generate proper error responses', () => {
      const errorResponse = rateLimitConfig.sendMail.errorResponseBuilder?.(
        {},
        { max: 100, after: '60000' }
      );
      expect(errorResponse).toBeDefined();
      expect(errorResponse?.statusCode).toBe(429);
      expect(errorResponse?.error).toBe('Too Many Requests');
      expect(errorResponse?.retryAfter).toBe(60);
    });
  });

  describe('WebSocketConnectionTracker', () => {
    let tracker: WebSocketConnectionTracker;

    beforeEach(() => {
      tracker = new WebSocketConnectionTracker(5);
      tracker.clear();
    });

    describe('canConnect', () => {
      it('should allow connection when no connections exist', () => {
        expect(tracker.canConnect('192.168.1.1')).toBe(true);
      });

      it('should allow connection when under limit', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.1', 'conn2');
        expect(tracker.canConnect('192.168.1.1')).toBe(true);
      });

      it('should deny connection when at limit', () => {
        for (let i = 0; i < 5; i++) {
          tracker.addConnection('192.168.1.1', `conn${i}`);
        }
        expect(tracker.canConnect('192.168.1.1')).toBe(false);
      });

      it('should track different IPs separately', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.2', 'conn2');
        expect(tracker.canConnect('192.168.1.1')).toBe(true);
        expect(tracker.canConnect('192.168.1.2')).toBe(true);
      });
    });

    describe('addConnection', () => {
      it('should add connection successfully', () => {
        expect(tracker.addConnection('192.168.1.1', 'conn1')).toBe(true);
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(1);
      });

      it('should deny adding connection when at limit', () => {
        for (let i = 0; i < 5; i++) {
          tracker.addConnection('192.168.1.1', `conn${i}`);
        }
        expect(tracker.addConnection('192.168.1.1', 'conn6')).toBe(false);
      });

      it('should allow multiple connections from different IPs', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.2', 'conn2');
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(1);
        expect(tracker.getConnectionCount('192.168.1.2')).toBe(1);
      });
    });

    describe('removeConnection', () => {
      it('should remove connection', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.removeConnection('192.168.1.1', 'conn1');
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(0);
      });

      it('should handle removing non-existent connection', () => {
        tracker.removeConnection('192.168.1.1', 'nonexistent');
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(0);
      });

      it('should clean up empty IP entries', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.removeConnection('192.168.1.1', 'conn1');
        expect(tracker.getTrackedIps()).not.toContain('192.168.1.1');
      });

      it('should only remove specified connection', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.1', 'conn2');
        tracker.removeConnection('192.168.1.1', 'conn1');
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(1);
      });
    });

    describe('getConnectionCount', () => {
      it('should return 0 for untracked IP', () => {
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(0);
      });

      it('should return correct count', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.1', 'conn2');
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(2);
      });
    });

    describe('getTrackedIps', () => {
      it('should return empty array when no connections', () => {
        expect(tracker.getTrackedIps()).toEqual([]);
      });

      it('should return tracked IPs', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.2', 'conn2');
        const ips = tracker.getTrackedIps();
        expect(ips).toContain('192.168.1.1');
        expect(ips).toContain('192.168.1.2');
      });
    });

    describe('clear', () => {
      it('should clear all connections', () => {
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.2', 'conn2');
        tracker.clear();
        expect(tracker.getTrackedIps()).toEqual([]);
        expect(tracker.getConnectionCount('192.168.1.1')).toBe(0);
      });
    });

    describe('setMaxConnections', () => {
      it('should update max connections', () => {
        tracker.setMaxConnections(3);
        tracker.addConnection('192.168.1.1', 'conn1');
        tracker.addConnection('192.168.1.1', 'conn2');
        tracker.addConnection('192.168.1.1', 'conn3');
        expect(tracker.canConnect('192.168.1.1')).toBe(false);
      });
    });
  });

  describe('generateConnectionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateConnectionId();
      const id2 = generateConnectionId();
      expect(id1).not.toBe(id2);
    });

    it('should start with conn_', () => {
      const id = generateConnectionId();
      expect(id.startsWith('conn_')).toBe(true);
    });

    it('should be a string', () => {
      const id = generateConnectionId();
      expect(typeof id).toBe('string');
    });
  });
});
