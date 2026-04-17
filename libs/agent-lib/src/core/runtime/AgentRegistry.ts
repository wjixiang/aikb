/**
 * AgentRegistry - In-memory registry for Agent instances
 *
 * Manages agent metadata and supports queries by status and type.
 * Synchronized with AgentInstance database table.
 */

import type { AgentMetadata } from './types.js';
import { AgentStatus } from './types.js';
import type { IPersistenceService } from '../persistence/types.js';
import { TYPES } from '../di/types.js';
import type { Container } from 'inversify';

/**
 * IAgentRegistry - Interface for Agent registry
 */
export interface IAgentRegistry {
  /**
   * Register a new agent
   */
  register(metadata: AgentMetadata): void;

  /**
   * Unregister an agent
   */
  unregister(instanceId: string): void;

  /**
   * Get agent metadata by instance ID
   */
  get(instanceId: string): AgentMetadata | undefined;

  /**
   * Find agents by status
   */
  findByStatus(status: AgentStatus): AgentMetadata[];

  /**
   * Find sleeping agents (status === 'sleeping')
   */
  findSleeping(): AgentMetadata[];

  /**
   * Find agents by type
   */
  findByType(agentType: string): AgentMetadata[];

  /**
   * Update agent metadata
   */
  update(instanceId: string, updates: Partial<AgentMetadata>): void;

  /**
   * Get all registered agents
   */
  getAll(): AgentMetadata[];

  /**
   * Check if agent exists
   */
  has(instanceId: string): boolean;

  /**
   * Get agent count
   */
  get size(): number;

  // ============================================
  // Hierarchy Query Methods
  // ============================================

  /**
   * Get direct child agents of a parent agent
   */
  getChildren(parentInstanceId: string): AgentMetadata[];

  /**
   * Get all descendant agents (children, grandchildren, etc.)
   */
  getDescendants(instanceId: string): AgentMetadata[];

  /**
   * Check if one agent is an ancestor of another
   * @param ancestorId Potential ancestor instance ID
   * @param descendantId Potential descendant instance ID
   * @returns true if ancestorId is an ancestor of descendantId
   */
  isAncestorOf(ancestorId: string, descendantId: string): boolean;

  /**
   * Add a child relation between two agents
   */
  addChildRelation(parentInstanceId: string, childInstanceId: string): void;

  /**
   * Remove a child relation between two agents
   */
  removeChildRelation(parentInstanceId: string, childInstanceId: string): void;

  /**
   * Sync registry from database
   */
  syncFromDatabase(): Promise<void>;

  /**
   * Sync single agent to database
   */
  syncToDatabase(instanceId: string): Promise<void>;

  // ============================================
  // A2A Service Discovery Methods
  // ============================================

  /**
   * Find agents by capability (A2A service discovery)
   */
  findByCapability(capability: string): AgentMetadata[];

  /**
   * Find agents by skill (A2A service discovery)
   */
  findBySkill(skill: string): AgentMetadata[];

  /**
   * Get all capabilities registered in the system
   */
  getAllCapabilities(): string[];

  /**
   * Get all skills registered in the system
   */
  getAllSkills(): string[];
}

/**
 * AgentRegistry - Implementation of IAgentRegistry
 *
 * Uses Map for in-memory storage and optionally syncs with database.
 * Also provides A2A service discovery via capability/skill indexing.
 */
export class AgentRegistry implements IAgentRegistry {
  private agents: Map<string, AgentMetadata> = new Map();
  private container?: Container;
  private persistenceService?: IPersistenceService;

  // A2A service discovery indexes
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private skillIndex: Map<string, Set<string>> = new Map();

  constructor(container?: Container) {
    this.container = container;
    this.tryInitPersistence();
  }

  private tryInitPersistence(): void {
    if (!this.container) {
      // No container provided, registry will be memory-only
      this.persistenceService = undefined;
      return;
    }

    try {
      this.persistenceService = this.container.get<IPersistenceService>(
        TYPES.IPersistenceService,
      );
    } catch {
      // Persistence service not available, registry will be memory-only
      this.persistenceService = undefined;
    }
  }

  register(metadata: AgentMetadata): void {
    // Remove existing agent from indexes first (if updating)
    const existing = this.agents.get(metadata.instanceId);
    if (existing) {
      this.removeFromIndexes(existing);
    }

    // Add to main registry
    this.agents.set(metadata.instanceId, {
      ...metadata,
      updatedAt: new Date(),
    });

    // Add to A2A indexes
    this.addToIndexes(metadata);
  }

  /**
   * Add agent to capability/skill indexes
   */
  private addToIndexes(metadata: AgentMetadata): void {
    // Index by capabilities
    if (metadata.capabilities && metadata.capabilities.length > 0) {
      for (const capability of metadata.capabilities) {
        if (!this.capabilityIndex.has(capability)) {
          this.capabilityIndex.set(capability, new Set());
        }
        this.capabilityIndex.get(capability)!.add(metadata.instanceId);
      }
    }

    // Index by skills
    if (metadata.skills && metadata.skills.length > 0) {
      for (const skill of metadata.skills) {
        if (!this.skillIndex.has(skill)) {
          this.skillIndex.set(skill, new Set());
        }
        this.skillIndex.get(skill)!.add(metadata.instanceId);
      }
    }
  }

  /**
   * Remove agent from capability/skill indexes
   */
  private removeFromIndexes(metadata: AgentMetadata): void {
    // Remove from capability index
    if (metadata.capabilities) {
      for (const capability of metadata.capabilities) {
        this.capabilityIndex.get(capability)?.delete(metadata.instanceId);
        if (this.capabilityIndex.get(capability)?.size === 0) {
          this.capabilityIndex.delete(capability);
        }
      }
    }

    // Remove from skill index
    if (metadata.skills) {
      for (const skill of metadata.skills) {
        this.skillIndex.get(skill)?.delete(metadata.instanceId);
        if (this.skillIndex.get(skill)?.size === 0) {
          this.skillIndex.delete(skill);
        }
      }
    }
  }

  unregister(instanceId: string): void {
    const existing = this.agents.get(instanceId);
    if (existing) {
      this.removeFromIndexes(existing);
    }
    this.agents.delete(instanceId);
  }

  get(instanceId: string): AgentMetadata | undefined {
    return this.agents.get(instanceId);
  }

  findByStatus(status: AgentStatus): AgentMetadata[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.status === status,
    );
  }

  findSleeping(): AgentMetadata[] {
    return this.findByStatus(AgentStatus.Sleeping);
  }

  findByType(agentType: string): AgentMetadata[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.agentType === agentType,
    );
  }

  update(instanceId: string, updates: Partial<AgentMetadata>): void {
    const existing = this.agents.get(instanceId);
    if (existing) {
      // Remove old indexes if capabilities or skills are changing
      if (updates.capabilities !== undefined || updates.skills !== undefined) {
        this.removeFromIndexes(existing);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      };

      this.agents.set(instanceId, updated);

      // Re-add to indexes if capabilities or skills changed
      if (updates.capabilities !== undefined || updates.skills !== undefined) {
        this.addToIndexes(updated);
      }
    }
  }

  getAll(): AgentMetadata[] {
    return Array.from(this.agents.values());
  }

  has(instanceId: string): boolean {
    return this.agents.has(instanceId);
  }

  get size(): number {
    return this.agents.size;
  }

  // ============================================
  // Hierarchy Query Methods Implementation
  // ============================================

  /**
   * @inheritDoc
   */
  getChildren(parentInstanceId: string): AgentMetadata[] {
    return this.getAll().filter(
      (agent) => agent.parentInstanceId === parentInstanceId,
    );
  }

  /**
   * @inheritDoc
   */
  getDescendants(instanceId: string): AgentMetadata[] {
    const children = this.getChildren(instanceId);
    const descendants: AgentMetadata[] = [...children];

    for (const child of children) {
      descendants.push(...this.getDescendants(child.instanceId));
    }

    return descendants;
  }

  /**
   * @inheritDoc
   */
  isAncestorOf(ancestorId: string, descendantId: string): boolean {
    const descendant = this.get(descendantId);
    if (!descendant || !descendant.parentInstanceId) {
      return false;
    }
    if (descendant.parentInstanceId === ancestorId) {
      return true;
    }
    return this.isAncestorOf(ancestorId, descendant.parentInstanceId);
  }

  /**
   * @inheritDoc
   */
  addChildRelation(parentInstanceId: string, childInstanceId: string): void {
    const parent = this.get(parentInstanceId);
    if (parent) {
      const childIds = parent.childInstanceIds ?? [];
      if (!childIds.includes(childInstanceId)) {
        childIds.push(childInstanceId);
        this.update(parentInstanceId, { childInstanceIds: childIds });
      }
    }
  }

  /**
   * @inheritDoc
   */
  removeChildRelation(parentInstanceId: string, childInstanceId: string): void {
    const parent = this.get(parentInstanceId);
    if (parent?.childInstanceIds) {
      const childIds = parent.childInstanceIds.filter(
        (id) => id !== childInstanceId,
      );
      this.update(parentInstanceId, { childInstanceIds: childIds });
    }
  }

  async syncFromDatabase(): Promise<void> {
    if (!this.persistenceService) {
      return;
    }

    try {
      const instances = await this.persistenceService.listAgents({ take: 1000 });

      this.agents.clear();

      for (const instance of instances) {
        const alias = `restored-${instance.instanceId.slice(0, 8)}`;
        this.agents.set(instance.instanceId, {
          instanceId: instance.instanceId,
          alias,
          status: instance.status,
          config: instance.config as Record<string, unknown>,
          name: instance.name,
          agentType: instance.agentType,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt,
          completedAt: instance.completedAt,
        });
      }
    } catch (error) {
      console.error('[AgentRegistry] Failed to sync from database:', error);
    }
  }

  async syncToDatabase(instanceId: string): Promise<void> {
    if (!this.persistenceService) {
      return;
    }

    const metadata = this.agents.get(instanceId);
    if (!metadata) {
      return;
    }

    try {
      await this.persistenceService.updateInstanceMetadata(instanceId, {
        status: metadata.status,
        config: metadata.config,
      });
    } catch (error) {
      console.error('[AgentRegistry] Failed to sync to database:', error);
    }
  }

  // ============================================
  // A2A Service Discovery Methods
  // ============================================

  /**
   * @inheritDoc
   */
  findByCapability(capability: string): AgentMetadata[] {
    const instanceIds = this.capabilityIndex.get(capability);
    if (!instanceIds) {
      return [];
    }
    return Array.from(instanceIds)
      .map((id) => this.agents.get(id))
      .filter((agent): agent is AgentMetadata => agent !== undefined);
  }

  /**
   * @inheritDoc
   */
  findBySkill(skill: string): AgentMetadata[] {
    const instanceIds = this.skillIndex.get(skill);
    if (!instanceIds) {
      return [];
    }
    return Array.from(instanceIds)
      .map((id) => this.agents.get(id))
      .filter((agent): agent is AgentMetadata => agent !== undefined);
  }

  /**
   * @inheritDoc
   */
  getAllCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys());
  }

  /**
   * @inheritDoc
   */
  getAllSkills(): string[] {
    return Array.from(this.skillIndex.keys());
  }
}

/**
 * Create an AgentRegistry instance
 */
export function createAgentRegistry(container?: Container): IAgentRegistry {
  return new AgentRegistry(container);
}
