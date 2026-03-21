import 'reflect-metadata';
import { Agent } from './agent.js';
import type { AgentConfig, SOP } from './agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import type { ObservableAgentCallbacks } from './ObservableAgent.js';
import type { ToolComponent } from '../../components/core/toolComponent.js';
import {
  AgentContainer,
  type AgentCreationOptions,
  type UnifiedAgentConfig,
} from '../di/container.js';
import { defaultUnifiedConfig } from '../di/UnifiedAgentConfig.js';

/**
 * Component registration configuration
 */
export interface ComponentRegistration {
  /** Component identifier (e.g., 'bibliography-search') */
  id: string;
  /** Component instance */
  component: ToolComponent;
  /** Registration priority (higher = registered first) */
  priority?: number;
}

/**
 * Configuration options for creating an Agent
 */
export interface AgentFactoryOptions {
  agent?: {
    sop?: SOP;
    config?: Partial<AgentConfig>;
    taskId?: string;
    name?: string;
    type?: string;
    description?: string;
  };
  api?: Partial<ProviderSettings>;
  workspace?: Partial<VirtualWorkspaceConfig>;
  observers?: ObservableAgentCallbacks;

  /**
   * Components to register with the agent's workspace
   * These will be automatically registered when the agent is created
   */
  components?: ComponentRegistration[];
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
 *     { id: 'bibliography-search', component: new BibliographySearchComponent() }
 *   ]
 * });
 * const agent = container.getAgent();
 * ```
 *
 * @example Direct creation
 * ```typescript
 * const agent = AgentFactory.createAgent({
 *   agent: { sop: 'My SOP' }
 * });
 * ```
 */
export class AgentFactory {
  /**
   * Create a new AgentContainer with the given options
   * Each container manages one Agent instance
   */
  static create(options: AgentFactoryOptions = {}): AgentContainer {
    return new AgentContainer(options);
  }

  /**
   * Create and return an Agent instance directly
   */
  static async createAgent(options: AgentFactoryOptions = {}): Promise<Agent> {
    const container = this.create(options);
    return container.getAgent();
  }
}
