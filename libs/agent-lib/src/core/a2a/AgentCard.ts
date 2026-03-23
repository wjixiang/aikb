/**
 * Agent Card Registry - Service Discovery for A2A Communication
 *
 * Manages Agent Cards for agent discovery and capability lookup.
 */

import pino from 'pino';
import type { AgentCard, AgentCardSummary, A2ARegistryConfig } from './types.js';

export interface IAgentCardRegistry {
  register(card: AgentCard): void;
  unregister(instanceId: string): void;
  getAgent(instanceId: string): AgentCard | undefined;
  findByCapability(capability: string): AgentCard[];
  findBySkill(skill: string): AgentCard[];
  getAllAgents(): AgentCard[];
  getAgentSummaries(): AgentCardSummary[];
  hasAgent(instanceId: string): boolean;
  updateAgent(instanceId: string, updates: Partial<AgentCard>): void;
  clear(): void;
}

/**
 * Agent Card Registry
 *
 * Provides service discovery for A2A agent communication.
 * Agents register themselves with their capabilities, and other agents
 * can query the registry to find agents by capability.
 */
export class AgentCardRegistry implements IAgentCardRegistry {
  private readonly logger: pino.Logger;
  private readonly agents: Map<string, AgentCard> = new Map();
  private readonly capabilityIndex: Map<string, Set<string>> = new Map();
  private readonly skillIndex: Map<string, Set<string>> = new Map();
  private readonly config: Required<A2ARegistryConfig>;

  constructor(config: A2ARegistryConfig = {}) {
    this.logger = pino({
      level: 'debug',
      timestamp: pino.stdTimeFunctions.isoTime,
    });
    this.config = {
      enableCache: config.enableCache ?? false,
      cacheTtl: config.cacheTtl ?? 60000,
    };
  }

  /**
   * Register an agent with its card
   */
  register(card: AgentCard): void {
    if (!card.instanceId) {
      throw new Error('Agent card must have an instanceId');
    }

    // Remove existing registration if present
    if (this.agents.has(card.instanceId)) {
      this.unregister(card.instanceId);
    }

    this.agents.set(card.instanceId, { ...card });

    // Index by capabilities
    for (const capability of card.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(card.instanceId);
    }

    // Index by skills
    for (const skill of card.skills) {
      if (!this.skillIndex.has(skill)) {
        this.skillIndex.set(skill, new Set());
      }
      this.skillIndex.get(skill)!.add(card.instanceId);
    }

    this.logger.debug(`Registered agent: ${card.name} (${card.instanceId})`);
  }

  /**
   * Unregister an agent
   */
  unregister(instanceId: string): void {
    const card = this.agents.get(instanceId);
    if (!card) {
      return;
    }

    // Remove from capability index
    for (const capability of card.capabilities) {
      this.capabilityIndex.get(capability)?.delete(instanceId);
      if (this.capabilityIndex.get(capability)?.size === 0) {
        this.capabilityIndex.delete(capability);
      }
    }

    // Remove from skill index
    for (const skill of card.skills) {
      this.skillIndex.get(skill)?.delete(instanceId);
      if (this.skillIndex.get(skill)?.size === 0) {
        this.skillIndex.delete(skill);
      }
    }

    this.agents.delete(instanceId);
    this.logger.debug(`Unregistered agent: ${card.name} (${instanceId})`);
  }

  /**
   * Get an agent's card by instance ID
   */
  getAgent(instanceId: string): AgentCard | undefined {
    return this.agents.get(instanceId);
  }

  /**
   * Find agents by capability
   */
  findByCapability(capability: string): AgentCard[] {
    const instanceIds = this.capabilityIndex.get(capability);
    if (!instanceIds) {
      return [];
    }
    return Array.from(instanceIds)
      .map((id) => this.agents.get(id))
      .filter((card): card is AgentCard => card !== undefined);
  }

  /**
   * Find agents by skill
   */
  findBySkill(skill: string): AgentCard[] {
    const instanceIds = this.skillIndex.get(skill);
    if (!instanceIds) {
      return [];
    }
    return Array.from(instanceIds)
      .map((id) => this.agents.get(id))
      .filter((card): card is AgentCard => card !== undefined);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentCard[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get simplified agent summaries for listing
   */
  getAgentSummaries(): AgentCardSummary[] {
    return Array.from(this.agents.values()).map((card) => ({
      instanceId: card.instanceId,
      name: card.name,
      capabilities: card.capabilities,
      skills: card.skills,
    }));
  }

  /**
   * Check if an agent is registered
   */
  hasAgent(instanceId: string): boolean {
    return this.agents.has(instanceId);
  }

  /**
   * Update an existing agent's card
   */
  updateAgent(instanceId: string, updates: Partial<AgentCard>): void {
    const existing = this.agents.get(instanceId);
    if (!existing) {
      throw new Error(`Agent not found: ${instanceId}`);
    }

    // Remove old indexes
    for (const capability of existing.capabilities) {
      this.capabilityIndex.get(capability)?.delete(instanceId);
    }
    for (const skill of existing.skills) {
      this.skillIndex.get(skill)?.delete(instanceId);
    }

    // Merge updates
    const updated: AgentCard = {
      ...existing,
      ...updates,
      instanceId, // Ensure instanceId cannot be changed
    };

    this.agents.set(instanceId, updated);

    // Rebuild indexes
    for (const capability of updated.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(instanceId);
    }

    for (const skill of updated.skills) {
      if (!this.skillIndex.has(skill)) {
        this.skillIndex.set(skill, new Set());
      }
      this.skillIndex.get(skill)!.add(instanceId);
    }

    this.logger.debug(`Updated agent: ${updated.name} (${instanceId})`);
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.agents.clear();
    this.capabilityIndex.clear();
    this.skillIndex.clear();
    this.logger.debug('Cleared all agent registrations');
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    totalCapabilities: number;
    totalSkills: number;
  } {
    return {
      totalAgents: this.agents.size,
      totalCapabilities: this.capabilityIndex.size,
      totalSkills: this.skillIndex.size,
    };
  }
}

/**
 * Singleton instance for global registry access
 */
let globalRegistry: AgentCardRegistry | null = null;

export function getGlobalAgentRegistry(): AgentCardRegistry {
  if (!globalRegistry) {
    globalRegistry = new AgentCardRegistry();
  }
  return globalRegistry;
}

export function setGlobalAgentRegistry(registry: AgentCardRegistry): void {
  globalRegistry = registry;
}
