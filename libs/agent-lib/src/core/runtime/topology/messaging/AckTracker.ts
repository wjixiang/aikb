/**
 * AckTracker - ACK tracking and timeout management for conversations
 *
 * Tracks pending ACKs and triggers callbacks when timeouts occur,
 * enabling retry logic for lost acknowledgments.
 */

import pino from 'pino';
import type { TopologyMessage } from '../types.js';

const logger = pino({
  level: 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
});

export interface AckCallback {
  onTimeout: () => void;
  onAck: (ack: TopologyMessage) => void;
}

export interface IAckTracker {
  track(conversationId: string, callback: AckCallback, timeout: number): void;
  untrack(conversationId: string): void;
  acknowledge(conversationId: string, ack: TopologyMessage): void;
  isTracking(conversationId: string): boolean;
  getTrackedCount(): number;
  getTrackedIds(): string[];
  clear(): void;
}

export class AckTracker implements IAckTracker {
  private tracking: Map<
    string,
    {
      callback: AckCallback;
      timeoutId: ReturnType<typeof setTimeout>;
      startTime: number;
    }
  > = new Map();

  track(conversationId: string, callback: AckCallback, timeout: number): void {
    this.untrack(conversationId);

    logger.debug(
      { conversationId, timeoutMs: timeout },
      '[AckTracker] Waiting for ACK',
    );

    const timeoutId = setTimeout(() => {
      this.handleTimeout(conversationId);
    }, timeout);

    this.tracking.set(conversationId, {
      callback,
      timeoutId,
      startTime: Date.now(),
    });
  }

  untrack(conversationId: string): void {
    const tracked = this.tracking.get(conversationId);
    if (tracked) {
      clearTimeout(tracked.timeoutId);
      this.tracking.delete(conversationId);
    }
  }

  acknowledge(conversationId: string, ack: TopologyMessage): void {
    const tracked = this.tracking.get(conversationId);
    if (tracked) {
      const elapsed = Date.now() - tracked.startTime;
      logger.info(
        { conversationId, ackMessageId: ack.messageId, elapsedMs: elapsed },
        '[AckTracker] ACK received',
      );
      clearTimeout(tracked.timeoutId);
      this.tracking.delete(conversationId);
      try {
        tracked.callback.onAck(ack);
      } catch (error) {
        console.error('[AckTracker] ACK callback error:', error);
      }
    }
  }

  isTracking(conversationId: string): boolean {
    return this.tracking.has(conversationId);
  }

  private handleTimeout(conversationId: string): void {
    const tracked = this.tracking.get(conversationId);
    if (tracked) {
      const elapsed = Date.now() - tracked.startTime;
      logger.warn(
        { conversationId, elapsedMs: elapsed },
        '[AckTracker] ACK timeout',
      );
      this.tracking.delete(conversationId);
      try {
        tracked.callback.onTimeout();
      } catch (error) {
        console.error('[AckTracker] Timeout callback error:', error);
      }
    }
  }

  getTrackedCount(): number {
    return this.tracking.size;
  }

  getTrackedIds(): string[] {
    return Array.from(this.tracking.keys());
  }

  clear(): void {
    for (const tracked of this.tracking.values()) {
      clearTimeout(tracked.timeoutId);
    }
    this.tracking.clear();
  }
}

export function createAckTracker(): IAckTracker {
  return new AckTracker();
}
