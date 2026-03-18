/**
 * Expert Executor
 *
 * Responsible for creating, managing, and executing Expert instances
 */

import { randomUUID } from 'crypto';
import type {
  IExpertExecutor,
  IExpertInstance,
  ExpertConfig,
  ExpertComponentDefinition,
  ExpertExecutorOptions,
} from './types.js';
import { ExpertRegistry } from './ExpertRegistry.js';
import { ExpertInstance } from './ExpertInstance.js';
import type { Agent, AgentPrompt } from '../agent/agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import { AgentContainer } from '../di/container.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { ToolComponent, createMailComponent } from '../../components/index.js';
import type { IExpertPersistenceStore, ExpertInstanceState } from './persistence/index.js';

/**
 * Generate composite key for expert instance
 */
function getCompositeKey(expertClassId: string, instanceId: string): string {
  return `${expertClassId}/${instanceId}`;
}

export class ExpertExecutor implements IExpertExecutor {
  private expertInstances: Map<string, IExpertInstance> = new Map();
  private expertConfigs: Map<string, ExpertConfig> = new Map();
  private agentContainer: AgentContainer;
  private options: ExpertExecutorOptions;
  private persistenceStore?: IExpertPersistenceStore;

  constructor(
    private registry: ExpertRegistry,
    container?: AgentContainer,
    options?: ExpertExecutorOptions,
    persistenceStore?: IExpertPersistenceStore,
  ) {
    this.agentContainer = container || new AgentContainer();
    this.options = options || {};
    this.persistenceStore = persistenceStore;
  }

  /**
   * Register Expert configuration
   */
  registerExpert(config: ExpertConfig): void {
    this.expertConfigs.set(config.expertId, config);
    this.registry.register(config);
  }

  /**
   * Get Expert instance by composite key
   * If instanceId is not provided, returns the first matching expertClassId
   */
  getExpert(expertClassId: string, instanceId?: string): IExpertInstance | undefined {
    if (instanceId) {
      // Exact match by composite key
      return this.expertInstances.get(getCompositeKey(expertClassId, instanceId));
    }

    // Find first matching expertClassId prefix
    for (const [key, instance] of this.expertInstances) {
      if (key.startsWith(`${expertClassId}/`)) {
        return instance;
      }
    }
    return undefined;
  }

  /**
   * Release Expert instance by composite key
   * If instanceId is not provided, releases all instances of that expertClassId
   */
  releaseExpert(expertClassId: string, instanceId?: string): void {
    if (instanceId) {
      // Release specific instance
      const key = getCompositeKey(expertClassId, instanceId);
      const expert = this.expertInstances.get(key);
      if (expert) {
        expert.dispose();
        this.expertInstances.delete(key);
        // Remove from persistence
        this.deleteInstanceState(expertClassId, instanceId);
      }
    } else {
      // Release all instances of this expertClassId
      for (const [key, expert] of this.expertInstances) {
        if (key.startsWith(`${expertClassId}/`)) {
          const [, instId] = key.split('/');
          expert.dispose();
          this.expertInstances.delete(key);
          // Remove from persistence
          this.deleteInstanceState(expertClassId, instId);
        }
      }
    }
  }

  /**
   * Start Expert in message-driven mode
   * Expert will poll its inbox for tasks instead of receiving explicit task data
   *
   * @param expertClassId - Expert class ID to start
   * @param instanceId - Optional instance ID
   * @param autoStart - If true, automatically start run loop after activation
   */
  async startExpert(
    expertClassId: string,
    instanceId?: string,
    autoStart = true,
  ): Promise<IExpertInstance> {
    const expert = await this.createExpert(expertClassId, instanceId);

    // Update status to running in persistence
    await this.saveInstanceState(expert);

    // Start message-driven loop if enabled
    if (autoStart && this.options.autoStartExperts) {
      // Start in background - don't await
      expert.start().catch((err) => {
        console.error(
          `[ExpertExecutor] Expert ${expertClassId}/${instanceId} start error:`,
          err,
        );
      });
    }

    return expert;
  }

  /**
   * Stop all running experts
   */
  async stopAll(): Promise<void> {
    for (const [key, expert] of this.expertInstances) {
      try {
        await expert.stop();
        // Update status in persistence
        const [expertClassId, instanceId] = key.split('/');
        await this.saveInstanceState(expert);
      } catch (err) {
        console.error(
          `[ExpertExecutor] Error stopping expert ${key}:`,
          err,
        );
      }
    }
  }

  /**
   * Create Expert instance
   * @param expertClassId - The Expert class ID (config.expertId)
   * @param instanceId - Optional instance ID. If not provided, a unique ID is auto-generated
   */
  async createExpert(expertClassId: string, instanceId?: string): Promise<IExpertInstance> {
    const config = this.expertConfigs.get(expertClassId);
    if (!config) {
      throw new Error(`Expert "${expertClassId}" not found in registry`);
    }

    // Use provided instanceId or auto-generate one
    const resolvedInstanceId = instanceId || config.instanceId || randomUUID();

    // Check if instance already exists with this composite key
    const compositeKey = getCompositeKey(expertClassId, resolvedInstanceId);
    const existing = this.expertInstances.get(compositeKey);
    if (existing) {
      return existing;
    }

    // Create agent with Expert's prompt configuration
    const agentPrompt: AgentPrompt = {
      capability: config.prompt?.capability || config.responsibilities,
      direction: config.prompt?.direction || '',
    };

    // Configure workspace for this Expert
    const workspaceConfig: VirtualWorkspaceConfig = {
      renderMode: 'markdown',
      ...config.virtualWorkspaceConfig,
      id: `expert-${expertClassId}-${resolvedInstanceId}-workspace`,
      name: `${config.displayName} Workspace`,
      expertMode: true,
      alwaysRenderAllComponents: true,
    };

    // Create agent using AgentContainer
    const agent = this.agentContainer.createAgent({
      agentPrompt,
      virtualWorkspaceConfig: workspaceConfig,
      taskId: `expert-${expertClassId}-${resolvedInstanceId}`,
      // Pass API and agent configuration from ExpertConfig
      apiConfiguration: config.apiConfiguration,
      config: config.agentConfig,
    });

    // Register Expert's components to VirtualWorkspace (async, must await)
    await this.registerExpertComponents(agent, config.components);

    // Register built-in components (MailComponent, etc.)
    await this.registerBuiltinComponent(agent, config, resolvedInstanceId);

    // Create ExpertInstance wrapping the Agent
    const expertInstance = new ExpertInstance(config, agent, resolvedInstanceId, this.persistenceStore);
    this.expertInstances.set(compositeKey, expertInstance);

    // Save instance state to persistence
    await this.saveInstanceState(expertInstance);

    console.log(
      `[ExpertExecutor] Created Expert instance for: ${expertClassId}/${resolvedInstanceId}`,
    );
    return expertInstance;
  }

  /**
   * Register Expert's components to VirtualWorkspace
   *
   * Components are resolved from:
   * - Direct ToolComponent instances
   * - Factory functions: () => ToolComponent
   * - Async factory functions: () => Promise<ToolComponent>
   *
   * Note: DI tokens (Symbol) are no longer supported
   */
  private async registerExpertComponents(
    agent: Agent,
    components: ExpertComponentDefinition[],
  ): Promise<void> {
    if (!components || components.length === 0) {
      console.log('[ExpertExecutor] No components to register for Expert');
      return;
    }

    // Get workspace from agent
    const workspace = agent.workspace as VirtualWorkspace;
    if (!workspace) {
      console.warn('[ExpertExecutor] Could not get workspace from agent');
      return;
    }

    // Register components directly to the workspace's ComponentRegistry
    for (const comp of components) {
      const componentId = comp.componentId;
      let componentInstance: ToolComponent | undefined;

      // Resolve component instance based on its type
      const instance = comp.instance;

      if (instance instanceof ToolComponent) {
        // Already resolved - use directly
        componentInstance = instance;
      } else if (typeof instance === 'function') {
        // Factory function - call it to get instance
        const factory = instance as () =>
          | ToolComponent
          | Promise<ToolComponent>;
        const result = factory();
        if (result instanceof Promise) {
          componentInstance = await result;
        } else {
          componentInstance = result;
        }
      }

      if (componentInstance) {
        workspace.registerComponent(
          componentId,
          componentInstance,
          comp.priority,
        );
        console.log(`[ExpertExecutor] Registered component: ${componentId}`);
      } else {
        console.warn(
          `[ExpertExecutor] Could not resolve component instance for: ${componentId}`,
        );
      }
    }
  }

  /**
   * Register built-in components (like MailComponent)
   * This enables the Expert to communicate via email
   *
   * @param agent - The Agent instance
   * @param config - The Expert configuration
   * @param instanceId - The runtime instance ID for this Expert
   */
  private async registerBuiltinComponent(
    agent: Agent,
    config: ExpertConfig,
    instanceId: string,
  ): Promise<void> {
    // Check if mail is disabled in config
    if (config.mailConfig?.enabled === false) {
      return;
    }

    // Get workspace from agent
    const workspace = agent.workspace as VirtualWorkspace;
    if (!workspace) {
      console.warn('[ExpertExecutor] Could not get workspace from agent');
      return;
    }

    // Check if mail component already registered
    if (workspace.getComponentRegistry().has('mail')) {
      console.log(
        '[ExpertExecutor] MailComponent already registered, skipping',
      );
      return;
    }

    // Determine mail config: Expert's config takes precedence over global config
    const expertMailConfig = config.mailConfig;
    const globalMailConfig = this.options.mailConfig;

    const baseUrl =
      expertMailConfig?.baseUrl ||
      globalMailConfig?.baseUrl ||
      'http://localhost:3000';

    const apiKey = expertMailConfig?.apiKey || globalMailConfig?.apiKey;

    // Create MailComponent with address format: {expertClassId}-{instanceId}@expert
    // e.g., pubmed-retrieve-abc123@expert
    const mailAddress = `${config.expertId}-${instanceId}@expert`;

    const mailComponent = createMailComponent({
      baseUrl,
      defaultAddress: mailAddress,
      apiKey,
      timeout: 30000,
    });

    // Auto-register the mailbox address - fail if registration fails
    const registerResult = await mailComponent.registerAddress(mailAddress);
    if (!registerResult.success) {
      throw new Error(
        `Failed to register mailbox address "${mailAddress}" for expert "${config.expertId}/${instanceId}": ${registerResult.error || 'Unknown error'}`,
      );
    }

    // Register as built-in component with highest priority (-1)
    workspace.registerComponent('mail', mailComponent, -1);
    console.log(
      `[ExpertExecutor] Registered MailComponent for expert: ${mailAddress}`,
    );
  }

  /**
   * Save instance state to persistence store
   */
  private async saveInstanceState(expert: IExpertInstance): Promise<void> {
    if (!this.persistenceStore) {
      return;
    }

    try {
      const state: ExpertInstanceState = {
        expertClassId: expert.expertId,
        instanceId: expert.instanceId,
        status: expert.status,
      };
      await this.persistenceStore.saveInstance(state);
    } catch (err) {
      console.error(
        `[ExpertExecutor] Failed to save instance state for ${expert.expertId}/${expert.instanceId}:`,
        err,
      );
    }
  }

  /**
   * Delete instance state from persistence store
   */
  private async deleteInstanceState(expertClassId: string, instanceId: string): Promise<void> {
    if (!this.persistenceStore) {
      return;
    }

    try {
      await this.persistenceStore.deleteInstance(expertClassId, instanceId);
    } catch (err) {
      console.error(
        `[ExpertExecutor] Failed to delete instance state for ${expertClassId}/${instanceId}:`,
        err,
      );
    }
  }

  /**
   * Recover running instances after application restart
   * Returns list of recovered expert configurations
   */
  async recoverRunningInstances(): Promise<{ expertClassId: string; instanceId: string }[]> {
    if (!this.persistenceStore) {
      console.log('[ExpertExecutor] No persistence store, skipping recovery');
      return [];
    }

    try {
      const runningInstances = await this.persistenceStore.listRunningInstances();
      const recovered: { expertClassId: string; instanceId: string }[] = [];

      for (const state of runningInstances) {
        // Check if config exists for this expert
        if (!this.expertConfigs.has(state.expertClassId)) {
          console.warn(
            `[ExpertExecutor] Cannot recover ${state.expertClassId}: config not found`,
          );
          continue;
        }

        // Note: We don't auto-restart - just report what was running
        // The caller should decide whether to restart
        console.log(
          `[ExpertExecutor] Found running instance: ${state.expertClassId}/${state.instanceId}`,
        );
        recovered.push({
          expertClassId: state.expertClassId,
          instanceId: state.instanceId,
        });
      }

      return recovered;
    } catch (err) {
      console.error('[ExpertExecutor] Failed to recover running instances:', err);
      return [];
    }
  }
}
