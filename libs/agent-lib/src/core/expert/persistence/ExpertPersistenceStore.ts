/**
 * Expert Persistence Store - Interface Definition
 *
 * Defines the interface for persisting Expert instance state
 */

import type { AgentStatus } from '../../common/types.js';

/**
 * Expert instance state that can be persisted
 */
export interface ExpertInstanceState {
  expertClassId: string;
  instanceId: string;
  status: AgentStatus;
}

/**
 * Interface for Expert instance persistence
 */
export interface IExpertPersistenceStore {
  /**
   * Save or update an Expert instance state
   */
  saveInstance(state: ExpertInstanceState): Promise<void>;

  /**
   * Load an Expert instance state by composite key
   */
  loadInstance(expertClassId: string, instanceId: string): Promise<ExpertInstanceState | null>;

  /**
   * List all instances for a given expertClassId
   * If expertClassId is not provided, lists all instances
   */
  listInstances(expertClassId?: string): Promise<ExpertInstanceState[]>;

  /**
   * Delete an Expert instance
   */
  deleteInstance(expertClassId: string, instanceId: string): Promise<void>;

  /**
   * List all running instances
   */
  listRunningInstances(): Promise<ExpertInstanceState[]>;
}