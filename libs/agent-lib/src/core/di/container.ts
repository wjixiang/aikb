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
import { HookModule } from '../hooks/HookModule.js';
import { HookType } from '../hooks/types.js';
import type { ApiClient } from 'llm-api-client';
import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { IToolManager } from '../tools/index.js';
import type { IPersistenceService } from '../persistence/types.js';
import { getLogger } from '@shared/logger';
import type { Logger } from '@shared/logger';
import {
  type UnifiedAgentConfig,
  type AgentCreationOptions,
  type AgentConfigBundle,
  type AgentDependencies,
  mergeWithDefaults,
} from './UnifiedAgentConfig.js';
import type { TestOverrides } from './types.js';
import { ToolComponent } from '../../components/core/toolComponent.js';

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
  private configBundle: AgentConfigBundle;
  private dependencies: AgentDependencies;
  private agentInstance: Agent | null = null;
  private isRestoring = false;
  private initPromise: Promise<void> | null = null;
  private lazySleepControl = new LazySleepControl();

  get agent(): Agent | null {
    return this.agentInstance;
  }

  constructor(
    options: AgentCreationOptions,
    instanceId?: string,
  ) {
    this.container = new Container({
      defaultScope: 'Singleton',
    });

    const unified = mergeWithDefaults(options);
    this.configBundle = {
      agent: unified.agent,
      workspace: unified.workspace,
      memory: unified.memory,
      persistence: unified.persistence,
    };
    this.dependencies = {
      apiClient: unified.apiClient,
      persistenceService: unified.persistenceService,
      components: unified.components,
      hooks: unified.hooks,
    };

    if (instanceId) {
      this.instanceId = instanceId;
      this.isRestoring = true;
      this.setupBindings();
      this.initPromise = this.restoreInstanceMetadata();
    } else {
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
        if (metadata.config) {
          const stored = metadata.config as Partial<AgentConfigBundle>;
          this.configBundle = {
            agent: { ...this.configBundle.agent, ...stored.agent },
            workspace: { ...this.configBundle.workspace, ...stored.workspace },
            memory: { ...this.configBundle.memory, ...stored.memory },
            persistence: stored.persistence ?? this.configBundle.persistence,
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
      getLogger('AgentContainer').warn(
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
      await persistenceService.saveInstanceMetadata(this.instanceId, {
        status: AgentStatus.Sleeping,
        config: this.configBundle,
        name: this.configBundle.agent.name,
        agentType: this.configBundle.agent.type,
      });
    } catch (error) {
      getLogger('AgentContainer').warn(
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

  private get logger(): Logger | undefined {
    try {
      return this.container.get<Logger>(TYPES.Logger);
    } catch {
      return undefined;
    }
  }

  private setupBindings(): void {
    this.container.bind(TYPES.AgentInstanceId).toConstantValue(this.instanceId);

    // Logger - use shared logger singleton
    this.container.bind<Logger>(TYPES.Logger).toDynamicValue(() =>
      getLogger('AgentContainer'),
    );

    // Agent configuration
    this.container
      .bind(TYPES.AgentConfig)
      .toConstantValue(this.configBundle.agent.config);
    this.container
      .bind(TYPES.AgentPrompt)
      .toConstantValue(this.configBundle.agent.sop);
    this.container
      .bind(TYPES.VirtualWorkspaceConfig)
      .toConstantValue(this.configBundle.workspace);
    this.container
      .bind(TYPES.MemoryModuleConfig)
      .toConstantValue(this.configBundle.memory);

    if (this.configBundle.agent.taskId) {
      this.container
        .bind<string>(TYPES.TaskId)
        .toConstantValue(this.configBundle.agent.taskId);
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

    // HookModule - bind config first, then module
    this.container
      .bind(TYPES.HookConfig)
      .toConstantValue(this.dependencies.hooks ?? {});
    this.container.bind(TYPES.HookModule).to(HookModule).inSingletonScope();

    if (!this.dependencies.apiClient) {
      throw new Error(
        'apiClient is required to create agents. Provide apiClient in AgentRuntimeConfig.',
      );
    }
    this.container
      .bind<ApiClient>(TYPES.ApiClient)
      .toConstantValue(this.dependencies.apiClient);

    if (!this.dependencies.persistenceService) {
      throw new Error(
        'persistenceService is required to create agents. Provide persistenceService in AgentRuntimeConfig.',
      );
    }
    this.container
      .bind<IPersistenceService>(TYPES.IPersistenceService)
      .toConstantValue(this.dependencies.persistenceService);

    // Container reference
    this.container
      .bind<Container>(TYPES.Container)
      .toConstantValue(this.container);

    // Bind AgentSleepControl - lazy proxy to avoid circular dependency
    // (Agent → ToolManager → A2ATaskComponent → AgentSleepControl → Agent)
    this.container
      .bind<IAgentSleepControl>(TYPES.AgentSleepControl)
      .toConstantValue(this.lazySleepControl);

    // Bind custom component classes if provided
    if (this.dependencies.components && this.dependencies.components.length > 0) {
      for (const reg of this.dependencies.components) {
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
      if (!this.dependencies.components || this.dependencies.components.length === 0) {
        return [];
      }

      return this.dependencies.components.map((reg) =>
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
          name: this.configBundle.agent.name,
          agentType: this.configBundle.agent.type,
        });
      }
    }
    return this.agentInstance;
  }

  getConfig(): AgentConfigBundle {
    return this.configBundle;
  }

  getDependencies(): AgentDependencies {
    return this.dependencies;
  }

  getContainer(): Container {
    return this.container;
  }

  /**
   * Unload the agent instance and release all DI container resources.
   * Called when the agent enters sleeping state to free memory.
   *
   * Steps:
   * 1. Clear lazy sleep control
   * 2. Unbind all DI bindings
   * 3. Null out agent reference and init promise
   */
  unload(): void {
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
   * @returns A fully restored AgentContainer with agent instance ready
   */
  static async restore(
    instanceId: string,
    options: AgentCreationOptions,
  ): Promise<AgentContainer> {
    const container = new AgentContainer(options, instanceId);
    await container.getAgent();
    return container;
  }
}

// Re-export types from UnifiedAgentConfig
export type {
  AgentCreationOptions,
  UnifiedAgentConfig,
  AgentConfigBundle,
  AgentDependencies,
} from './UnifiedAgentConfig.js';
export {
  mergeWithDefaults,
  mergeConfigBundle,
} from './UnifiedAgentConfig.js';
