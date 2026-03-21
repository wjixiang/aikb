/**
 * AgentRegistry - In-memory registry for Agent instances
 *
 * Manages agent metadata and supports queries by status and type.
 * Synchronized with AgentInstance database table.
 */

import type { AgentMetadata, AgentStatus } from './types.js';
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
   * Find idle agents (status === 'idle')
   */
  findIdle(): AgentMetadata[];

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

  /**
   * Sync registry from database
   */
  syncFromDatabase(): Promise<void>;

  /**
   * Sync single agent to database
   */
  syncToDatabase(instanceId: string): Promise<void>;
}

/**
 * AgentRegistry - Implementation of IAgentRegistry
 *
 * Uses Map for in-memory storage and optionally syncs with database.
 */
export class AgentRegistry implements IAgentRegistry {
  private agents: Map<string, AgentMetadata> = new Map();
  private container: Container;
  private persistenceService?: IPersistenceService;

  constructor(container: Container) {
    this.container = container;
    this.tryInitPersistence();
  }

  private tryInitPersistence(): void {
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
    this.agents.set(metadata.instanceId, {
      ...metadata,
      updatedAt: new Date(),
    });
  }

  unregister(instanceId: string): void {
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

  findIdle(): AgentMetadata[] {
    return this.findByStatus('idle');
  }

  findByType(agentType: string): AgentMetadata[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.agentType === agentType,
    );
  }

  update(instanceId: string, updates: Partial<AgentMetadata>): void {
    const existing = this.agents.get(instanceId);
    if (existing) {
      this.agents.set(instanceId, {
        ...existing,
        ...updates,
        updatedAt: new Date(),
      });
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

  async syncFromDatabase(): Promise<void> {
    if (!this.persistenceService) {
      return;
    }

    try {
      // Get all agent instances from database
      const instances = await this.persistenceService.listSessions({
        limit: 1000,
      });

      // Clear and repopulate registry
      this.agents.clear();

      for (const instance of instances) {
        this.agents.set(instance.instanceId, {
          instanceId: instance.instanceId,
          status: instance.status as AgentStatus,
          config: instance.config as Record<string, unknown>,
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
}

/**
 * Create an AgentRegistry instance
 */
export function createAgentRegistry(container: Container): IAgentRegistry {
  return new AgentRegistry(container);
}
