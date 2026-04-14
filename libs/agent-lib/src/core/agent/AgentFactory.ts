import 'reflect-metadata';
import { Agent } from './agent.js';
import type { AgentConfig, SOP } from './agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import type { ApiClient } from 'llm-api-client';
import type { ObservableAgentCallbacks } from './ObservableAgent.js';
import type { IPersistenceService } from '../persistence/types.js';
import type { ISessionManager } from '../session/ISessionManager.js';
import {
  AgentContainer,
  type AgentCreationOptions,
  type UnifiedAgentConfig,
} from '../di/container.js';
import {
  defaultUnifiedConfig,
  type DIComponentRegistration,
} from '../di/UnifiedAgentConfig.js';

// Re-export for backward compatibility
export type { DIComponentRegistration as ComponentRegistration } from '../di/UnifiedAgentConfig.js';

export interface AgentSoul {
  sop?: SOP;
  config?: Partial<AgentConfig>;
  taskId?: string;
  name?: string;
  type?: string;
  description?: string;
}

/**
 * Minimal Agent Soul configuration for factory functions
 * This is the lightweight interface returned by createAgentSoul() functions
 * API configuration is managed by Runtime
 */
export interface AgentBlueprint {
  agent?: AgentSoul;
  components: DIComponentRegistration[];
}

/**
 * Configuration options for creating an Agent
 */
export interface AgentFactoryOptions extends AgentBlueprint {
  workspace?: Partial<VirtualWorkspaceConfig>;
  observers?: ObservableAgentCallbacks;
  apiClient: ApiClient;
  persistenceService: IPersistenceService;
  sessionManager?: ISessionManager;
}

/**
 * AgentFactory - Factory for creating Agent instances
 *
 * Provides convenient methods to create Agent with proper dependency injection.
 *
 * @example
 * ```typescript
 * const container = AgentFactory.create({
 *   agent: { sop: 'My SOP' },
 *   api: { apiKey: '...' },
 *   components: [
 *     { componentClass: PicosComponent }
 *   ]
 * });
 * const agent = container.getAgent();
 * ```
 *
 * @example Direct creation
 * ```typescript
 * const agent = await AgentFactory.createAgent({
 *   agent: { sop: 'My SOP' }
 * });
 * ```
 */
export class AgentFactory {
  /**
   * Create a new AgentContainer with the given options
   * Each container manages one Agent instance
   * @param options - Agent creation options
   */
  static create(options: AgentFactoryOptions): AgentContainer {
    return new AgentContainer(options);
  }

  /**
   * Create and return an Agent instance directly
   * @param options - Agent creation options
   */
  static async createAgent(
    options: AgentFactoryOptions,
  ): Promise<Agent> {
    const container = this.create(options);
    return container.getAgent();
  }
}
