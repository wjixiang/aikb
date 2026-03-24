/**
 * UserContext - User as Agent
 *
 * Treats the external user as a special Agent with the same capabilities.
 * The user can:
 * - Manage agents (create, list, destroy)
 * - Send A2A tasks/queries/events to agents
 * - Receive A2A responses (optional)
 */

import { createA2AClient, type A2AClient } from '../a2a/index.js';
import type { IAgentCardRegistry } from '../a2a/index.js';
import type { IMessageBus } from './topology/messaging/MessageBus.js';
import type { IRuntimeControlClient } from './types.js';
import type { A2ATaskResult } from '../a2a/types.js';
import { RuntimeControlClientImpl } from './RuntimeControlClient.js';

/**
 * User task options - simplified task publishing
 */
export interface UserTaskOptions {
  /** Task priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Custom task ID. If not provided, generates a random one */
  taskId?: string;
  /** Timeout in milliseconds. Defaults to 60000 */
  timeout?: number;
}

export interface UserContext {
  /** Unique identifier for this user */
  instanceId: string;
  /** Runtime control client for agent management */
  getRuntimeClient(): IRuntimeControlClient;
  /** A2A client for sending tasks/queries/events to agents */
  getA2AClient(): A2AClient;
  /**
   * Publish a task to an agent (wrapped as Agent).
   * This is a convenience method that wraps the complexity of A2A task sending.
   */
  publishTask(
    targetAgentId: string,
    description: string,
    input: Record<string, unknown>,
    options?: UserTaskOptions,
  ): Promise<A2ATaskResult>;
}

export interface UserContextOptions {
  /** Custom user ID. If not provided, generates a random one */
  userId?: string;
  /** Default timeout for A2A operations */
  defaultTimeout?: number;
}

/**
 * Create a UserContext - treats external user as an Agent
 *
 * @example
 * ```typescript
 * const runtime = createAgentRuntime({ maxAgents: 10 });
 *
 * // User connects to the runtime
 * const user = runtime.createUserContext();
 *
 * // User can manage agents
 * const agentId = await user.getRuntimeClient().createAgent({
 *   agent: { name: 'Research Agent', type: 'researcher' }
 * });
 *
 * // User can send A2A tasks to agents
 * const result = await user.getA2AClient().sendTask(
 *   agentId,
 *   'task-001',
 *   '检索椎间盘突出文献',
 *   { query: 'lumbar disc herniation' }
 * );
 * ```
 */
export function createUserContext(
  runtime: {
    getMessageBus(): IMessageBus;
    getRegistry(): IAgentCardRegistry;
    createControlClient(callerInstanceId: string): IRuntimeControlClient;
  },
  options: UserContextOptions = {},
): UserContext {
  const instanceId = options.userId ?? `user-${crypto.randomUUID().slice(0, 8)}`;
  const defaultTimeout = options.defaultTimeout ?? 60000;

  // Get dependencies from runtime
  const messageBus = runtime.getMessageBus();
  const registry = runtime.getRegistry();

  // Create RuntimeControlClient for this user
  const runtimeClient = runtime.createControlClient(instanceId);

  // Create A2A Client for sending messages to agents
  const a2aClient = createA2AClient(messageBus, registry, {
    instanceId,
    defaultTimeout,
  });

  return {
    instanceId,
    getRuntimeClient: () => runtimeClient,
    getA2AClient: () => a2aClient,
    publishTask: async (
      targetAgentId: string,
      description: string,
      input: Record<string, unknown>,
      options?: UserTaskOptions,
    ): Promise<A2ATaskResult> => {
      const taskId = options?.taskId ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timeout = options?.timeout ?? defaultTimeout;

      // Create a temporary client with custom timeout if needed
      const client = timeout !== defaultTimeout
        ? createA2AClient(messageBus, registry, { instanceId, defaultTimeout: timeout })
        : a2aClient;

      return client.sendTask(
        targetAgentId,
        taskId,
        description,
        input,
        options?.priority ? { priority: options.priority } : undefined,
      );
    },
  };
}
