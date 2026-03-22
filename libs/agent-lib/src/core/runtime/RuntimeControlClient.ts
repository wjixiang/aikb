/**
 * RuntimeControlClient - Implementation of IRuntimeControlClient
 *
 * This module provides the concrete implementation of the Runtime control interface
 * that is passed to Agents, enabling them to manage child Agents with proper
 * permission checking and hierarchy constraints.
 *
 * @module RuntimeControlClient
 */

import type { Agent } from '../agent/agent.js';
import type {
  IRuntimeControlClient,
  RuntimeControlPermissions,
  AgentFilter,
  AgentMetadata,
  TaskSubmission,
  RuntimeTask,
  RuntimeStats,
  RuntimeControlAgentOptions,
} from './types.js';
import type { AgentRuntime } from './AgentRuntime.js';

/**
 * RuntimeControlClientImpl - Implementation of IRuntimeControlClient
 *
 * This class encapsulates all Runtime control operations that an Agent can perform.
 * All operations are subject to:
 * - Permission checks (as configured in RuntimeControlPermissions)
 * - Hierarchy constraints (can only manage Agents this Agent created)
 * - Cascade behavior for destruction
 *
 * @example
 * ```typescript
 * // Inside an Agent, access the RuntimeControlClient
 * const client = this.getRuntimeClient();
 * if (client?.hasPermission('canCreateAgent')) {
 *   const childId = await client.createAgent({
 *     agent: { name: 'worker', type: 'worker' }
 *   });
 * }
 * ```
 */
export class RuntimeControlClientImpl implements IRuntimeControlClient {
  constructor(
    private runtime: AgentRuntime,
    private callerInstanceId: string,
    private permissions: RuntimeControlPermissions,
  ) {}

  // ============================================
  // Permission Query
  // ============================================

  /**
   * @inheritDoc
   */
  getPermissions(): RuntimeControlPermissions {
    return { ...this.permissions };
  }

  /**
   * @inheritDoc
   */
  hasPermission(permission: keyof RuntimeControlPermissions): boolean {
    return Boolean(this.permissions[permission]);
  }

  // ============================================
  // Agent Lifecycle
  // ============================================

  /**
   * @inheritDoc
   */
  async createAgent(options: RuntimeControlAgentOptions): Promise<string> {
    if (!this.permissions.canCreateAgent) {
      throw new Error('Permission denied: cannot create agent');
    }

    return this.runtime._createChildAgent(
      this.callerInstanceId,
      options,
      this.permissions,
    );
  }

  /**
   * @inheritDoc
   */
  async startAgent(instanceId: string): Promise<void> {
    if (!this.permissions.canManageAgentLifecycle) {
      throw new Error('Permission denied: cannot manage agent lifecycle');
    }

    if (!this.isDescendantOrSelf(instanceId)) {
      throw new Error(
        `Permission denied: cannot start agent ${instanceId} (not owned by you)`,
      );
    }

    return this.runtime.startAgent(instanceId);
  }

  /**
   * @inheritDoc
   */
  async stopAgent(instanceId: string): Promise<void> {
    if (!this.permissions.canManageAgentLifecycle) {
      throw new Error('Permission denied: cannot manage agent lifecycle');
    }

    if (!this.isDescendantOrSelf(instanceId)) {
      throw new Error(
        `Permission denied: cannot stop agent ${instanceId} (not owned by you)`,
      );
    }

    return this.runtime.stopAgent(instanceId);
  }

  /**
   * @inheritDoc
   */
  async destroyAgent(
    instanceId: string,
    options?: { cascade?: boolean },
  ): Promise<void> {
    if (!this.permissions.canDestroyAgent) {
      throw new Error('Permission denied: cannot destroy agent');
    }

    if (!this.isDescendantOrSelf(instanceId)) {
      throw new Error(
        `Permission denied: cannot destroy agent ${instanceId} (not owned by you)`,
      );
    }

    return this.runtime._destroyAgentWithCascade(
      instanceId,
      options?.cascade ?? true,
    );
  }

  // ============================================
  // Agent Query
  // ============================================

  /**
   * @inheritDoc
   */
  async getAgent(instanceId: string): Promise<Agent | undefined> {
    if (this.permissions.canListAllAgents) {
      return this.runtime.getAgent(instanceId);
    }

    if (!this.isDescendantOrSelf(instanceId)) {
      return undefined;
    }

    return this.runtime.getAgent(instanceId);
  }

  /**
   * @inheritDoc
   */
  async listAgents(filter?: AgentFilter): Promise<AgentMetadata[]> {
    if (this.permissions.canListAllAgents) {
      return this.runtime.listAgents(filter);
    }

    const allAgents = await this.runtime.listAgents(filter);
    return allAgents.filter(
      (agent) => agent.parentInstanceId === this.callerInstanceId,
    );
  }

  /**
   * @inheritDoc
   */
  getSelfInstanceId(): string {
    return this.callerInstanceId;
  }

  /**
   * @inheritDoc
   */
  getParentInstanceId(): string | undefined {
    const metadata = this.runtime.getAgentMetadata(this.callerInstanceId);
    return metadata?.parentInstanceId;
  }

  /**
   * @inheritDoc
   */
  async listChildAgents(): Promise<AgentMetadata[]> {
    return this.runtime._getChildren(this.callerInstanceId);
  }

  // ============================================
  // Task Management
  // ============================================

  /**
   * @inheritDoc
   */
  async submitTask(task: TaskSubmission): Promise<string> {
    if (!this.permissions.canSubmitTask) {
      throw new Error('Permission denied: cannot submit task');
    }

    return this.runtime.submitTask(task);
  }

  /**
   * @inheritDoc
   */
  async getTaskStatus(taskId: string): Promise<RuntimeTask | undefined> {
    return this.runtime.getTaskStatus(taskId);
  }

  /**
   * @inheritDoc
   */
  async getPendingTasks(instanceId?: string): Promise<RuntimeTask[]> {
    return this.runtime.getPendingTasks(instanceId);
  }

  // ============================================
  // Runtime Statistics
  // ============================================

  /**
   * @inheritDoc
   */
  async getStats(): Promise<RuntimeStats> {
    if (!this.permissions.canGetStats) {
      throw new Error('Permission denied: cannot get stats');
    }

    return this.runtime.getStats();
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Check if target instanceId is this Agent or one of its descendants
   */
  private isDescendantOrSelf(instanceId: string): boolean {
    if (instanceId === this.callerInstanceId) {
      return true;
    }
    return this.runtime._isDescendantOf(this.callerInstanceId, instanceId);
  }
}
