import 'reflect-metadata';
import { Agent } from './agent.js';
import type { AgentConfig, SOP } from './agent.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import type { ObservableAgentCallbacks } from './ObservableAgent.js';
import type { ToolComponent } from '../../components/core/toolComponent.js';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
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
  /** Component instance (uses component.componentId as identifier) */
  component: ToolComponent;
  /** Registration priority (higher = registered first) */
  priority?: number;
}

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
export interface AgentSoulConfig {
  agent?: AgentSoul;
  components?: ComponentRegistration[];
}

/**
 * Configuration options for creating an Agent
 */
export interface AgentFactoryOptions extends AgentSoulConfig {
  api?: Partial<ProviderSettings>;
  workspace?: Partial<VirtualWorkspaceConfig>;
  observers?: ObservableAgentCallbacks;
  messageBus?: IMessageBus;
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
