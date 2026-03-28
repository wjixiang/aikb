/**
 * AgentSoulRegistry - Registry for all available AgentSoul configurations
 *
 * This registry allows Coordinator agents to discover and instantiate
 * specialized agents for different tasks.
 *
 * Type definitions and registry - concrete agents are in agent-soul-hub package.
 */

import type { AgentBlueprint } from './agent/AgentFactory.js';

export type { AgentBlueprint } from './agent/AgentFactory.js';

export type AgentSoulType =
  | 'chief-coordinator'
  | 'coordinator'
  | 'epidemiology'
  | 'pathophysiology'
  | 'diagnosis'
  | 'management'
  | 'quality-of-life'
  | 'emerging-treatments'
  | 'paper-analysis'
  | 'bib-retrieve'
  | 'web-search';

export interface AgentSoulEntry {
  type: AgentSoulType;
  name: string;
  description: string;
  capabilities: string[];
}

export interface IAgentSoulRegistry {
  register(entry: AgentSoulEntry): void;
  getAll(): AgentSoulEntry[];
  get(type: AgentSoulType): AgentSoulEntry | undefined;
  getByCapability(capability: string): AgentSoulEntry[];
}

export class AgentSoulRegistry implements IAgentSoulRegistry {
  private entries: Map<AgentSoulType, AgentSoulEntry> = new Map();

  register(entry: AgentSoulEntry): void {
    this.entries.set(entry.type, entry);
  }

  getAll(): AgentSoulEntry[] {
    return Array.from(this.entries.values());
  }

  get(type: AgentSoulType): AgentSoulEntry | undefined {
    return this.entries.get(type);
  }

  getByCapability(capability: string): AgentSoulEntry[] {
    const result: AgentSoulEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.capabilities.includes(capability)) {
        result.push(entry);
      }
    }
    return result;
  }
}

// Global registry instance
export const agentSoulRegistry = new AgentSoulRegistry();

// Factory function registry
type AgentSoulFactory = () => AgentBlueprint;
const agentSoulFactories: Partial<Record<AgentSoulType, AgentSoulFactory>> = {};

/**
 * Register an agent soul factory function
 */
export function registerAgentSoulFactory(
  type: AgentSoulType,
  factory: AgentSoulFactory,
): void {
  agentSoulFactories[type] = factory;
  // Also register metadata if not already registered
  if (!agentSoulRegistry.get(type)) {
    agentSoulRegistry.register({
      type,
      name: `${type} Agent`,
      description: `Agent soul of type: ${type}`,
      capabilities: ['literature-search'],
    });
  }
}

/**
 * Create an agent soul by type - requires factory to be registered first
 */
export function createAgentSoulByType(type: AgentSoulType): AgentBlueprint {
  const factory = agentSoulFactories[type];
  if (!factory) {
    throw new Error(
      `Agent soul factory not registered for type: ${type}. ` +
        `Make sure agent-soul-hub is imported and initialized.`,
    );
  }
  return factory();
}

/**
 * Get all available agent soul types
 */
export function getAvailableAgentSoulTypes(): AgentSoulType[] {
  return Object.keys(agentSoulFactories) as AgentSoulType[];
}
