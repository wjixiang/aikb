/**
 * EventDispatcher - Simple publish/subscribe event system
 *
 * Provides event-driven communication for the Agent Runtime.
 */

import type { RuntimeEvent, RuntimeEventType, EventHandler } from './types.js';
import { generateEventId } from './types.js';

/**
 * IEventDispatcher - Interface for event dispatcher
 */
export interface IEventDispatcher {
  /**
   * Subscribe to an event type
   * Returns an unsubscribe function
   */
  subscribe(eventType: RuntimeEventType, handler: EventHandler): () => void;

  /**
   * Subscribe to multiple event types
   * Returns an unsubscribe function
   */
  subscribeAll(eventTypes: RuntimeEventType[], handler: EventHandler): () => void;

  /**
   * Emit an event
   */
  emit(event: RuntimeEvent): void;

  /**
   * Emit an event with auto-generated ID and timestamp
   */
  emitEvent(type: RuntimeEventType, payload: unknown): void;

  /**
   * Get subscriber count for an event type
   */
  getSubscriberCount(eventType: RuntimeEventType): number;

  /**
   * Remove all subscribers for an event type
   */
  clear(eventType: RuntimeEventType): void;

  /**
   * Remove all subscribers for all event types
   */
  clearAll(): void;
}

/**
 * EventDispatcher - Implementation of IEventDispatcher
 *
 * Uses Map to store handlers for each event type.
 */
export class EventDispatcher implements IEventDispatcher {
  private handlers: Map<RuntimeEventType, Set<EventHandler>> = new Map();

  subscribe(eventType: RuntimeEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  subscribeAll(eventTypes: RuntimeEventType[], handler: EventHandler): () => void {
    const unsubscribers = eventTypes.map((type) => this.subscribe(type, handler));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  emit(event: RuntimeEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Call all handlers (async handlers are not awaited)
    handlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[EventDispatcher] Error in handler for ${event.type}:`, error);
      }
    });
  }

  emitEvent(type: RuntimeEventType, payload: unknown): void {
    this.emit({
      id: generateEventId(),
      type,
      timestamp: new Date(),
      payload,
    });
  }

  getSubscriberCount(eventType: RuntimeEventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  clear(eventType: RuntimeEventType): void {
    this.handlers.delete(eventType);
  }

  clearAll(): void {
    this.handlers.clear();
  }
}

/**
 * Create an EventDispatcher instance
 */
export function createEventDispatcher(): IEventDispatcher {
  return new EventDispatcher();
}
