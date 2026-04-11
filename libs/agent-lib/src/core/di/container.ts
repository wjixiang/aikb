import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import { Agent } from '../agent/agent.js';
import { AgentStatus } from '../common/types.js';
import type { IAgentSleepControl } from '../runtime/AgentSleepControl.js';
import { LazySleepControl } from '../runtime/AgentSleepControl.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { MemoryModule } from '../memory/MemoryModule.js';
import { ToolManager } from '../tools/ToolManager.js';
import { PostgresPersistenceService } from '../persistence/PostgresPersistenceService.js';
import { GlobalToolProvider } from '../tools/providers/GlobalToolProvider.js';
import { HookModule } from '../hooks/HookModule.js';
import { HookType } from '../hooks/types.js';
import { AgentSessionManager } from '../session/AgentSessionManager.js';
import type { ApiClient, ClientPool } from 'llm-api-client';
import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { IToolManager } from '../tools/index.js';
import type { IPersistenceService } from '../persistence/types.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import pino from 'pino';
import {
  type UnifiedAgentConfig,
  type AgentCreationOptions,
  defaultUnifiedConfig,
  mergeWithDefaults,
} from './UnifiedAgentConfig.js';
import type { TestOverrides } from './types.js';
import { ToolComponent } from '../../components/core/toolComponent.js';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
import { createA2AHandler, createA2AClient } from '../a2a/index.js';
import type { IA2AHandler, A2AHandlerConfig } from '../a2a/index.js';
import type { IA2AClient } from '../a2a/index.js';
import { getGlobalAgentRegistry } from '../a2a/index.js';
import { RuntimeControlState } from '../runtime/RuntimeControlState.js';


type Logger = ReturnType<typeof pino>;

/**
 * AgentContainer - 1:1 relationship with Agent
 *
 * Each AgentContainer manages a single Agent instance and its dependencies.
 * This ensures complete isolation between agents.
 *
 * @example
 * ```typescript
 * const container = new AgentContainer({
 *   agent: { sop: 'My SOP' },
 *   api: { apiKey: '...' }
 * });
 * const agent = container.getAgent();
 * ```
 */
export class AgentContainer {
  private container: Container;
  public instanceId: string;
  private config: UnifiedAgentConfig;
  private agentInstance: Agent | null = null;
  private isRestoring = false;
  private initPromise: Promise<void> | null = null;
  private lazySleepControl = new LazySleepControl();

  get agent(): Agent | null {
    return this.agentInstance;
  }

  constructor(
    options: AgentCreationOptions = {},
    messageBus: IMessageBus,
    instanceId?: string,
  ) {
    this.container = new Container({
      defaultScope: 'Singleton',
    });

    // Bind messageBus immediately as required dependency
    this.container
      .bind<IMessageBus>(TYPES.IMessageBus)
      .toConstantValue(messageBus);

    if (instanceId) {
      // Restore agent: setup bindings first to get persistence service
      this.instanceId = instanceId;
      this.config = mergeWithDefaults(options); // Use provided options as base
      this.isRestoring = true;
      this.setupBindings();
      this.initPromise = this.restoreInstanceMetadata();
    } else {
      // Create new agent
      this.config = mergeWithDefaults(options);
      this.instanceId = crypto.randomUUID();
      this.setupBindings();
      this.initPromise = this.persistInstanceMetadata();
    }
  }

  private async restoreInstanceMetadata(): Promise<void> {
    // if (this.config.persistence?.enabled === false) {
    //     return;
    // }

    try {
      const persistenceService = this.container.get<IPersistenceService>(
        TYPES.IPersistenceService,
      );
      const metadata = await persistenceService.getInstanceMetadata(
        this.instanceId,
      );
      if (metadata) {
        // Restore config from stored metadata (merge with current options to preserve components)
        if (metadata.config) {
          // Deep merge to ensure all required fields are present
          const storedConfig = metadata.config as Partial<UnifiedAgentConfig>;
          this.config = {
            agent: { ...this.config.agent, ...storedConfig.agent },
            api: { ...this.config.api, ...storedConfig.api },
            workspace: { ...this.config.workspace, ...storedConfig.workspace },
            memory: { ...this.config.memory, ...storedConfig.memory },
            persistence: storedConfig.persistence ?? this.config.persistence,
            components: this.config.components,
          };
        }
        this.logger?.info(
          { instanceId: this.instanceId, status: metadata.status },
          '[AgentContainer] Instance metadata restored',
        );
      } else {
        this.logger?.warn(
          { instanceId: this.instanceId },
          '[AgentContainer] Instance not found, will create new',
        );
        // Instance doesn't exist, persist it
        await this.persistInstanceMetadata();
      }
    } catch (error) {
      const logger = pino({ level: 'warn' });
      logger.warn(
        {
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          instanceId: this.instanceId,
        },
        '[AgentContainer] Failed to restore instance metadata',
      );
    }
  }

  private async persistInstanceMetadata(): Promise<void> {
    // if (this.config.persistence?.enabled === false) {
    //     return;
    // }

    try {
      const persistenceService = this.container.get<IPersistenceService>(
        TYPES.IPersistenceService,
      );
      // Exclude non-serializable fields from config
      const { components, clientPool, ...serializableConfig } = this.config;
      await persistenceService.saveInstanceMetadata(this.instanceId, {
        status: AgentStatus.Sleeping,
        config: serializableConfig,
        name: this.config.agent.name,
        agentType: this.config.agent.type,
      });
    } catch (error) {
      const logger = pino({ level: 'warn' });
      logger.warn(
        {
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack }
              : error,
          instanceId: this.instanceId,
        },
        '[AgentContainer] Failed to persist instance metadata',
      );
      throw error; // Re-throw to see full error in demo
    }
  }

  private get logger(): pino.Logger | undefined {
    try {
      return this.container.get<pino.Logger>(TYPES.Logger);
    } catch {
      return undefined;
    }
  }

  private setupBindings(): void {
    this.container.bind(TYPES.AgentInstanceId).toConstantValue(this.instanceId);

    // Logger
    this.container.bind<Logger>(TYPES.Logger).toDynamicValue(() =>
      pino({
        level: process.env['LOG_LEVEL'] || 'debug',
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
    );

    // Agent configuration
    this.container
      .bind(TYPES.AgentConfig)
      .toConstantValue(this.config.agent.config);
    this.container
      .bind(TYPES.ProviderSettings)
      .toConstantValue(this.config.api);
    this.container
      .bind(TYPES.AgentPrompt)
      .toConstantValue(this.config.agent.sop);
    this.container
      .bind(TYPES.VirtualWorkspaceConfig)
      .toConstantValue(this.config.workspace);
    this.container
      .bind(TYPES.MemoryModuleConfig)
      .toConstantValue(this.config.memory);

    if (this.config.agent.taskId) {
      this.container
        .bind<string>(TYPES.TaskId)
        .toConstantValue(this.config.agent.taskId);
    }

    // Memory instance ID for persistence
    this.container
      .bind<string>(TYPES.MemoryInstanceId)
      .toConstantValue(this.instanceId);

    // Services (all singleton within this container)
    this.container.bind(TYPES.Agent).to(Agent).inSingletonScope();
    this.container
      .bind(TYPES.IVirtualWorkspace)
      .to(VirtualWorkspace)
      .inSingletonScope();
    this.container
      .bind(TYPES.IMemoryModule)
      .to(MemoryModule)
      .inSingletonScope();
    this.container.bind(TYPES.IToolManager).to(ToolManager).inSingletonScope();
    this.container
      .bind(GlobalToolProvider)
      .toDynamicValue(() => new GlobalToolProvider())
      .inSingletonScope();

    // HookModule - bind config first, then module
    this.container
      .bind(TYPES.HookConfig)
      .toConstantValue(this.config.hooks ?? {});
    this.container.bind(TYPES.HookModule).to(HookModule).inSingletonScope();

    // A2A Handler configuration
    const a2aHandlerConfig: A2AHandlerConfig = {
      instanceId: this.instanceId,
      supportedTypes: ['query', 'event'],
      handlerTimeout: Math.max(
        300000,
        (this.config.agent.config.apiRequestTimeout || 120000) * 5,
      ),
    };
    this.container
      .bind<A2AHandlerConfig>(TYPES.A2AHandlerConfig)
      .toConstantValue(a2aHandlerConfig);

    // A2A Handler (singleton within container)
    const messageBus = this.container.get<IMessageBus>(TYPES.IMessageBus);
    this.container
      .bind<IA2AHandler>(TYPES.IA2AHandler)
      .toConstantValue(createA2AHandler(messageBus, a2aHandlerConfig));

    // A2A Client (singleton within container)
    this.container
      .bind<IA2AClient>(TYPES.IA2AClient)
      .toDynamicValue(() => {
        const agentRegistry = getGlobalAgentRegistry();
        return createA2AClient(messageBus, agentRegistry, {
          instanceId: this.instanceId,
        });
      })
      .inSingletonScope();

    // API Client — use ClientPool directly as a unified ApiClient
    // The pool implements round-robin selection and cross-client fallback,
    // so agents automatically benefit from load balancing and failover.
    if (!this.config.clientPool) {
      throw new Error(
        'ClientPool is required to create agents. Provide clientPool in AgentRuntimeConfig.',
      );
    }
    this.container
      .bind<ApiClient>(TYPES.ApiClient)
      .toConstantValue(this.config.clientPool);

    // ClientPool
    this.container
      .bind<ClientPool>(TYPES.ClientPool)
      .toConstantValue(this.config.clientPool);

    // // Persistence Service (if enabled)
    // if (this.config.persistence?.enabled !== false) {
    const databaseUrl =
      this.config.persistence?.databaseUrl || process.env['AGENT_DATABASE_URL'];

    if (databaseUrl) {
      // Prisma Client
      this.container
        .bind<PrismaClient>(TYPES.PrismaClient)
        .toDynamicValue(() => {
          const connectionString =
            databaseUrl || process.env['AGENT_DATABASE_URL'];
          if (!connectionString) {
            throw new Error('Database URL not configured');
          }
          const pool = new pg.Pool({ connectionString });
          const adapter = new PrismaPg({ connectionString });
          return new PrismaClient({ adapter });
        })
        .inSingletonScope();

      // Persistence Config
      this.container.bind(TYPES.PersistenceConfig).toConstantValue({
        enabled: true,
        databaseUrl,
        autoCommit: this.config.persistence?.autoCommit ?? true,
      });

      // Persistence Service
      this.container
        .bind<IPersistenceService>(TYPES.IPersistenceService)
        .to(PostgresPersistenceService)
        .inSingletonScope();

      // Session Manager
      this.container
        .bind(TYPES.ISessionManager)
        .to(AgentSessionManager)
        .inSingletonScope();
    } else {
      throw new Error('binding persistenceService error: no databaseurl found');
    }
    // }

    // Container reference
    this.container
      .bind<Container>(TYPES.Container)
      .toConstantValue(this.container);

    // Bind RuntimeControlState for DI (used by RuntimeControlComponent when injected)
    this.container
      .bind<RuntimeControlState>(TYPES.RuntimeControlState)
      .toConstantValue(new RuntimeControlState());

    // Bind RuntimeControlRESTConfig if provided (used by RuntimeControlComponent for topology ops)
    if (this.config.runtimeControl?.restBaseUrl) {
      this.container
        .bind(TYPES.RuntimeControlRESTConfig)
        .toConstantValue(this.config.runtimeControl);
    }

    // Bind AgentSleepControl - lazy proxy to avoid circular dependency
    // (Agent → ToolManager → A2ATaskComponent → AgentSleepControl → Agent)
    this.container
      .bind<IAgentSleepControl>(TYPES.AgentSleepControl)
      .toConstantValue(this.lazySleepControl);

    // Bind custom component classes if provided
    if (this.config.components && this.config.components.length > 0) {
      for (const reg of this.config.components) {
        if (reg.componentInstance) {
          this.container
            .bind<ToolComponent>(reg.componentInstance.constructor as any)
            .toConstantValue(reg.componentInstance);
        } else if (reg.componentClass) {
          this.container.bind(reg.componentClass).toSelf().inSingletonScope();
        }
      }
    }

    // Build the ToolComponents array by resolving component instances
    // This uses toDynamicValue to ensure components are created after all dependencies are bound
    const buildToolComponents = (): ToolComponent[] => {
      if (!this.config.components || this.config.components.length === 0) {
        return [];
      }

      return this.config.components.map((reg) =>
        reg.componentInstance
          ? reg.componentInstance
          : (this.container.get(
              reg.componentClass!,
            ) as unknown as ToolComponent),
      );
    };

    this.container
      .bind<ToolComponent[]>(TYPES.ToolComponents)
      .toDynamicValue(buildToolComponents)
      .inSingletonScope();
  }

  /**
   * Inject dependencies into components
   * Called after container is fully set up
   * Note: Components now use constructor injection, so this is a no-op
   */
  private injectComponentDependencies(): void {
    // No-op: Components now use @inject() in constructor
  }

  async getAgent(): Promise<Agent> {
    // Wait for initialization (AgentInstance creation) to complete
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }

    // Inject dependencies into components before getting the agent
    this.injectComponentDependencies();

    if (!this.agentInstance) {
      this.agentInstance = this.container.get<Agent>(TYPES.Agent);

      // Wire up lazy sleep control now that Agent is resolved
      this.lazySleepControl.setResolver(() => this.agentInstance!);

      // Note: Components are now injected via DI constructor
      // No need to manually register here

      // Restore state if this is a restored instance
      if (this.isRestoring) {
        await this.agentInstance.restoreMemory();
        await this.agentInstance.restoreSessionState();
        await this.agentInstance.restoreComponentStates();
        this.isRestoring = false;
      }

      // Trigger agent:created hook
      const hookModule = this.container.get<HookModule>(TYPES.HookModule);
      if (hookModule) {
        await hookModule.executeHooks(HookType.AGENT_CREATED, {
          type: HookType.AGENT_CREATED,
          timestamp: new Date(),
          instanceId: this.instanceId,
          name: this.config.agent.name,
          agentType: this.config.agent.type,
        });
      }
    }
    return this.agentInstance;
  }

  getConfig(): UnifiedAgentConfig {
    return this.config;
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Unload the agent instance and release all DI container resources.
   * Called when the agent enters sleeping state to free memory.
   *
   * Steps:
   * 1. Stop A2A handler listening
   * 2. Clear lazy sleep control
   * 3. Unbind all DI bindings
   * 4. Null out agent reference and init promise
   */
  unload(): void {
    try {
      // Stop A2A handler listening if bound
      if (this.container.isBound(TYPES.IA2AHandler)) {
        const handler = this.container.get<IA2AHandler>(TYPES.IA2AHandler);
        handler.stopListening();
      }
    } catch {
      // Container may already be partially disposed
    }

    // Clear lazy sleep control resolver
    this.lazySleepControl = new LazySleepControl();

    // Unbind all DI bindings to release resources
    this.container.unbindAll();

    // Null out references
    this.agentInstance = null;
    this.initPromise = null;
  }

  /**
   * Restore an agent container from a previously unloaded instance.
   * Creates a new container that restores config from DB, rebuilds DI bindings,
   * and resolves the agent instance with full state restoration.
   *
   * @param instanceId - The instance ID of the agent to restore
   * @param options - Agent creation options (used as base, merged with stored config)
   * @param messageBus - The shared message bus
   * @returns A fully restored AgentContainer with agent instance ready
   */
  static async restore(
    instanceId: string,
    options: AgentCreationOptions,
    messageBus: IMessageBus,
  ): Promise<AgentContainer> {
    const container = new AgentContainer(options, messageBus, instanceId);
    await container.getAgent();
    return container;
  }
}

// Re-export types from UnifiedAgentConfig
export type {
  AgentCreationOptions,
  UnifiedAgentConfig,
} from './UnifiedAgentConfig.js';
export {
  defaultUnifiedConfig,
  mergeWithDefaults,
} from './UnifiedAgentConfig.js';
