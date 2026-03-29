/**
 * AgentSoulRegistry - Registry for all available AgentSoul configurations
 *
 * This registry allows Router agents to discover and instantiate
 * specialized agents for different tasks.
 *
 * Type definitions and registry - concrete agents are in agent-soul-hub package.
 */

import type { AgentBlueprint } from './agent/AgentFactory.js';

export type { AgentBlueprint } from './agent/AgentFactory.js';

export type AgentSoulType =
  | 'chief-router'
  | 'router'
  | 'epidemiology'
  | 'pathophysiology'
  | 'diagnosis'
  | 'management'
  | 'quality-of-life'
  | 'emerging-treatments'
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
const agentSoulFactories: Map<string, AgentSoulFactory> = new Map();

/**
 * Register an agent soul factory function
 */
export function registerAgentSoulFactory(
  type: string,
  factory: AgentSoulFactory,
): void {
  agentSoulFactories.set(type, factory);
}

/**
 * Create an agent soul by type - requires factory to be registered first
 */
export function createAgentSoulByType(type: string): AgentBlueprint {
  const factory = agentSoulFactories.get(type);
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
