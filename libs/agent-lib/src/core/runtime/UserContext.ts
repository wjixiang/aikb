/**
 * UserContext - Lightweight wrapper for user interaction with AgentRuntime
 *
 * Treats the external user as a lightweight client that can:
 * - Manage agents (create, list, destroy) via RuntimeControlClient
 * - Send A2A tasks/queries/events to agents
 *
 * This is a lightweight alternative to AgentContainer - no Agent instance,
 * no Workspace, no Memory. Just A2A communication and runtime control.
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import {
  createA2AClient,
  type A2AClient,
  type IA2AClient,
} from '../a2a/index.js';
import type { IAgentCardRegistry } from '../a2a/index.js';
import type { IMessageBus } from './topology/messaging/MessageBus.js';
import type { IRuntimeControlClient } from './types.js';
import type { A2ATaskResult } from '../a2a/types.js';

/**
 * Service identifiers for UserContext DI
 */
export const UserContextTypes = {
  MessageBus: Symbol('MessageBus'),
  AgentCardRegistry: Symbol('AgentCardRegistry'),
  RuntimeControlClientFactory: Symbol('RuntimeControlClientFactory'),
  A2AClient: Symbol('A2AClient'),
  InstanceId: Symbol('InstanceId'),
  DefaultTimeout: Symbol('DefaultTimeout'),
};

/**
 * User task options - simplified task publishing
 */
export interface UserTaskOptions {
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  taskId?: string;
  timeout?: number;
}

/**
 * IUserContext - Public interface for UserContext
 */
export interface IUserContext {
  instanceId: string;
  getRuntimeClient(): IRuntimeControlClient;
  getA2AClient(): IA2AClient;
  publishTask(
    targetAgentId: string,
    description: string,
    input: Record<string, unknown>,
    options?: UserTaskOptions,
  ): Promise<A2ATaskResult>;
}

/**
 * UserContextOptions - Configuration for creating UserContext
 */
export interface UserContextOptions {
  userId?: string;
  defaultTimeout?: number;
}

/**
 * Dependencies required from AgentRuntime
 */
export interface UserContextRuntimeDeps {
  getMessageBus(): IMessageBus;
  getRegistry(): IAgentCardRegistry;
  createControlClient(callerInstanceId: string): IRuntimeControlClient;
}

/**
 * UserContextContainer - Lightweight DI container for user context
 *
 * Similar to AgentContainer but without Agent/Workspace/Memory.
 * Only contains services needed for A2A communication and runtime control.
 */
class UserContextContainer {
  private container: Container;
  private _instanceId: string;
  private _a2aClient: IA2AClient | null = null;
  private _runtimeClient: IRuntimeControlClient | null = null;

  constructor(
    private runtime: UserContextRuntimeDeps,
    options: UserContextOptions = {},
  ) {
    this.container = new Container({ defaultScope: 'Singleton' });
    this._instanceId =
      options.userId ?? `user-${crypto.randomUUID().slice(0, 8)}`;
    const defaultTimeout = options.defaultTimeout ?? 60000;

    this.setupBindings(runtime, defaultTimeout);
  }

  private setupBindings(
    runtime: UserContextRuntimeDeps,
    defaultTimeout: number,
  ): void {
    this.container
      .bind(UserContextTypes.InstanceId)
      .toConstantValue(this._instanceId);
    this.container
      .bind(UserContextTypes.DefaultTimeout)
      .toConstantValue(defaultTimeout);
    this.container
      .bind(UserContextTypes.MessageBus)
      .toConstantValue(runtime.getMessageBus());
    this.container
      .bind(UserContextTypes.AgentCardRegistry)
      .toConstantValue(runtime.getRegistry());

    this.container
      .bind<IA2AClient>(UserContextTypes.A2AClient)
      .toDynamicValue(() => {
        return createA2AClient(
          this.container.get<IMessageBus>(UserContextTypes.MessageBus),
          this.container.get<IAgentCardRegistry>(
            UserContextTypes.AgentCardRegistry,
          ),
          {
            instanceId: this._instanceId,
          },
        );
      });
  }

  get instanceId(): string {
    return this._instanceId;
  }

  getA2AClient(): IA2AClient {
    if (!this._a2aClient) {
      this._a2aClient = this.container.get<IA2AClient>(
        UserContextTypes.A2AClient,
      );
    }
    return this._a2aClient;
  }

  getRuntimeClient(runtime: UserContextRuntimeDeps): IRuntimeControlClient {
    if (!this._runtimeClient) {
      this._runtimeClient = runtime.createControlClient(this._instanceId);
    }
    return this._runtimeClient;
  }

  getMessageBus(): IMessageBus {
    return this.container.get<IMessageBus>(UserContextTypes.MessageBus);
  }

  getRegistry(): IAgentCardRegistry {
    return this.container.get<IAgentCardRegistry>(
      UserContextTypes.AgentCardRegistry,
    );
  }

  getDefaultTimeout(): number {
    return this.container.get<number>(UserContextTypes.DefaultTimeout);
  }

  getContainer(): Container {
    return this.container;
  }
}

/**
 * UserContext - Wrapper around UserContextContainer
 *
 * Implements IUserContext by delegating to UserContextContainer.
 */
export class UserContext implements IUserContext {
  private container: UserContextContainer;

  constructor(
    private runtime: UserContextRuntimeDeps,
    options: UserContextOptions = {},
  ) {
    this.container = new UserContextContainer(runtime, options);
  }

  get instanceId(): string {
    return this.container.instanceId;
  }

  getRuntimeClient(): IRuntimeControlClient {
    return this.container.getRuntimeClient(this.runtime);
  }

  getA2AClient(): IA2AClient {
    return this.container.getA2AClient();
  }

  async publishTask(
    targetAgentId: string,
    description: string,
    input: Record<string, unknown>,
    options?: UserTaskOptions,
  ): Promise<A2ATaskResult> {
    const taskId =
      options?.taskId ??
      `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timeout = options?.timeout ?? this.container.getDefaultTimeout();

    const client =
      timeout !== this.container.getDefaultTimeout()
        ? createA2AClient(
            this.container.getMessageBus(),
            this.container.getRegistry(),
            { instanceId: this.instanceId },
          )
        : this.getA2AClient();

    return client.sendTask(
      targetAgentId,
      taskId,
      description,
      input,
      options?.priority ? { priority: options.priority } : undefined,
    );
  }

  getContainer(): UserContextContainer {
    return this.container;
  }
}

/**
 * Create a UserContext - factory function
 *
 * @example
 * ```typescript
 * const runtime = createAgentRuntime({ maxAgents: 10 });
 *
 * const user = runtime.createUserContext();
 *
 * // Manage agents
 * const agentId = await user.getRuntimeClient().createAgent({
 *   agent: { name: 'Research Agent', type: 'researcher' }
 * });
 *
 * // Send A2A tasks
 * const result = await user.publishTask(
 *   agentId,
 *   '检索椎间盘突出文献',
 *   { query: 'lumbar disc herniation' }
 * );
 * ```
 */
export function createUserContext(
  runtime: UserContextRuntimeDeps,
  options: UserContextOptions = {},
): IUserContext {
  return new UserContext(runtime, options);
}
