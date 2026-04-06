/**
 * AgentEventStream — Unified real-time event push interface
 *
 * Bridges the internal HookModule event system to external consumers (SSE, WebSocket, etc.)
 * by converting hook contexts into typed, serializable AgentEvent objects.
 *
 * Usage:
 * ```typescript
 * // Subscribe to events for a specific agent
 * const unsubscribe = eventStream.subscribe(agentId, (event) => {
 *   console.log(event.type, event.data);
 * });
 *
 * // Use as async iterable (for SSE adapters)
 * for await (const event of eventStream.createIterable(agentId, { signal })) {
 *   reply.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
 * }
 * ```
 */

import type { HookModule } from '../hooks/HookModule.js';
import { HookType } from '../hooks/types.js';
import type { HookContext } from '../hooks/types.js';
import type {
  AgentEvent,
  AgentEventType,
  AgentEventDataMap,
} from './types.js';
import { createAgentEvent } from './types.js';

// =============================================================================
// Interface
// =============================================================================

export interface IAgentEventStream {
  /** Subscribe to events for a specific agent. Returns unsubscribe function. */
  subscribe(
    instanceId: string,
    handler: (event: AgentEvent) => void,
  ): () => void;

  /** Subscribe to events across all agents. Returns unsubscribe function. */
  subscribeAll(handler: (event: AgentEvent) => void): () => void;

  /**
   * Create an async iterable of events for a specific agent.
   * Yields events as they arrive until the signal is aborted.
   */
  createIterable(
    instanceId: string,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<AgentEvent>;

  /** Release all subscriptions and clean up. */
  dispose(): void;
}

// =============================================================================
// Implementation
// =============================================================================

/** Hook types that we map to external events */
const MAPPED_HOOK_TYPES: HookType[] = [
  HookType.MESSAGE_ADDED,
  HookType.TOOL_BEFORE_EXECUTE,
  HookType.TOOL_AFTER_EXECUTE,
  HookType.AGENT_STARTED,
  HookType.AGENT_COMPLETED,
  HookType.AGENT_ABORTED,
  HookType.AGENT_ERROR,
  HookType.LLM_CALL_COMPLETED,
];

/**
 * AgentEventStream implementation.
 *
 * Wires into each agent's HookModule and converts hook contexts into
 * a unified event stream. Supports both callback subscriptions and
 * async iteration for streaming protocols.
 */
export class AgentEventStream implements IAgentEventStream {
  private perAgentSubscribers: Map<
    string,
    Set<(event: AgentEvent) => void>
  > = new Map();
  private globalSubscribers: Set<(event: AgentEvent) => void> = new Set();

  /** Hook IDs registered per agent, for cleanup */
  private hookRegistrations: Map<string, HookType[]> = new Map();

  /** Pending consumers for createIterable */
  private iterableQueues: Map<
    string,
    { resolve: (value: AgentEvent) => void; reject: (reason?: unknown) => void }[]
  > = new Map();

  private disposed = false;

  // ==========================================================================
  // Public API
  // ==========================================================================

  subscribe(
    instanceId: string,
    handler: (event: AgentEvent) => void,
  ): () => void {
    if (this.disposed) return () => {};

    let subscribers = this.perAgentSubscribers.get(instanceId);
    if (!subscribers) {
      subscribers = new Set();
      this.perAgentSubscribers.set(instanceId, subscribers);
    }
    subscribers.add(handler);

    return () => {
      subscribers?.delete(handler);
    };
  }

  subscribeAll(handler: (event: AgentEvent) => void): () => void {
    if (this.disposed) return () => {};

    this.globalSubscribers.add(handler);

    return () => {
      this.globalSubscribers.delete(handler);
    };
  }

  createIterable(
    instanceId: string,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<AgentEvent> {
    const queue: { resolve: (value: AgentEvent) => void; reject: (reason?: unknown) => void }[] = [];
    this.iterableQueues.set(instanceId, queue);

    const abortController = new AbortController();

    const cleanup = () => {
      abortController.abort();
      this.iterableQueues.delete(instanceId);
      queue.length = 0;
    };

    const onAbort = () => {
      for (const item of queue) {
        item.reject(new DOMException('Aborted', 'AbortError'));
      }
      cleanup();
    };
    options?.signal?.addEventListener('abort', onAbort, { once: true });

    const nextEvent = (): Promise<AgentEvent> => {
      return new Promise<AgentEvent>((resolve, reject) => {
        const wrappedReject = (reason?: unknown) => {
          reject(reason);
          cleanup();
        };
        queue.push({ resolve, reject: wrappedReject });
      });
    };

    const iterator: AsyncIterator<AgentEvent> = {
      next(): Promise<IteratorResult<AgentEvent>> {
        if (abortController.signal.aborted) {
          return Promise.resolve({ value: undefined as unknown as AgentEvent, done: true });
        }
        return nextEvent().then(
          (value) => ({ value, done: false }),
          () => ({ value: undefined as unknown as AgentEvent, done: true }),
        );
      },
      return(): Promise<IteratorResult<AgentEvent>> {
        cleanup();
        return Promise.resolve({ value: undefined as unknown as AgentEvent, done: true });
      },
    };

    return {
      [Symbol.asyncIterator]() {
        return iterator;
      },
    };
  }

  dispose(): void {
    this.disposed = true;
    this.perAgentSubscribers.clear();
    this.globalSubscribers.clear();
    this.iterableQueues.clear();
  }

  // ==========================================================================
  // Wiring (called by AgentRuntime)
  // ==========================================================================

  /**
   * Wire into an agent's HookModule to start receiving events.
   * Called by AgentRuntime when an agent is created.
   */
  wireAgent(hookModule: HookModule, instanceId: string): void {
    const hookIds: HookType[] = [];

    for (const hookType of MAPPED_HOOK_TYPES) {
      const id = `event-stream:${hookType}:${instanceId}`;
      hookModule.on(hookType, (ctx: HookContext) => {
        const event = this.mapHookToEvent(ctx, instanceId);
        if (event) this.dispatch(event);
      }, { id, parallel: true });
      hookIds.push(hookType);
    }

    this.hookRegistrations.set(instanceId, hookIds);
  }

  /**
   * Unwire from an agent's HookModule.
   * Called by AgentRuntime when an agent is destroyed.
   */
  unwireAgent(hookModule: HookModule, instanceId: string): void {
    const hookTypes = this.hookRegistrations.get(instanceId);
    if (!hookTypes) return;

    for (const hookType of hookTypes) {
      const id = `event-stream:${hookType}:${instanceId}`;
      hookModule.off(hookType, id);
    }

    this.hookRegistrations.delete(instanceId);
    this.perAgentSubscribers.delete(instanceId);
    this.iterableQueues.delete(instanceId);
  }

  // ==========================================================================
  // Internal
  // ==========================================================================

  private dispatch(event: AgentEvent): void {
    if (this.disposed) return;

    // Per-agent subscribers
    const subscribers = this.perAgentSubscribers.get(event.instanceId);
    if (subscribers) {
      for (const handler of subscribers) {
        try {
          handler(event);
        } catch {
          // Subscriber errors must not break the stream
        }
      }
    }

    // Global subscribers
    for (const handler of this.globalSubscribers) {
      try {
        handler(event);
      } catch {
        // Subscriber errors must not break the stream
      }
    }

    // Iterable consumers
    const queue = this.iterableQueues.get(event.instanceId);
    if (queue && queue.length > 0) {
      const item = queue.shift()!;
      item.resolve(event);
    }
  }

  /**
   * Map a HookModule context to a wire-format AgentEvent.
   * Returns null for unmapped hook types.
   */
  private mapHookToEvent(
    ctx: HookContext,
    instanceId: string,
  ): AgentEvent | null {
    switch (ctx.type) {
      case HookType.MESSAGE_ADDED: {
        const msg = ctx.message;
        return createAgentEvent('message.added', instanceId, {
          role: msg.role,
          content: msg.content as unknown as Array<Record<string, unknown>>,
          ts: msg.ts,
        });
      }

      case HookType.TOOL_BEFORE_EXECUTE:
        return createAgentEvent('tool.started', instanceId, {
          toolName: ctx.toolName,
          params: ctx.params,
          componentId: ctx.componentId,
        });

      case HookType.TOOL_AFTER_EXECUTE:
        return createAgentEvent('tool.completed', instanceId, {
          toolName: ctx.toolName,
          params: ctx.params,
          result: ctx.result,
          success: ctx.success,
          error: ctx.error?.message,
          duration: ctx.duration,
          componentId: ctx.componentId,
        });

      case HookType.AGENT_STARTED:
        return createAgentEvent('agent.status', instanceId, {
          status: 'running',
        });

      case HookType.AGENT_COMPLETED:
        return createAgentEvent('agent.status', instanceId, {
          status: 'completed',
        });

      case HookType.AGENT_ABORTED:
        return createAgentEvent('agent.status', instanceId, {
          status: 'aborted',
          reason: ctx.reason,
        });

      case HookType.AGENT_ERROR:
        return createAgentEvent('error', instanceId, {
          message: ctx.error.message,
          phase: ctx.phase,
        });

      case HookType.LLM_CALL_COMPLETED:
        return createAgentEvent('llm.completed', instanceId, {
          promptTokens: ctx.tokenUsage.promptTokens,
          completionTokens: ctx.tokenUsage.completionTokens,
        });

      default:
        return null;
    }
  }
}

/**
 * Create a new AgentEventStream instance.
 */
export function createAgentEventStream(): AgentEventStream {
  return new AgentEventStream();
}
