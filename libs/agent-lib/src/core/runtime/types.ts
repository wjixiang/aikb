/**
 * Agent Runtime System - Core Type Definitions
 *
 * This module defines the core types for the Agent Runtime system,
 * which manages multiple Agent instances and provides a central task queue.
 */

import type { ExportResult } from '../../components/core/toolComponent.js';
import type { AgentStatus } from '../common/types.js';

// =============================================================================
// Agent Metadata - Registry entry for each Agent instance
// =============================================================================

/**
 * AgentMetadata - Stored in AgentRegistry and synchronized with AgentInstance table
 *
 * This interface aligns with the existing AgentInstance Prisma model.
 */
export interface AgentMetadata {
  /** Unique instance identifier */
  instanceId: string;

  /** Current status of the agent */
  status: AgentStatus;

  /** Agent friendly name */
  name?: string;

  /** Agent type identifier (e.g., 'pubmed-retrieve', 'paper-analysis') */
  agentType?: string;

  /** Agent description */
  description?: string;

  /** Configuration snapshot (UnifiedAgentConfig) */
  config?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;

  /** Completion timestamp (if completed or aborted) */
  completedAt?: Date;

  // ============================================
  // Hierarchy & Ownership (for RuntimeControlClient)
  // ============================================

  /** Parent Agent's instanceId (if created by another Agent) */
  parentInstanceId?: string;

  /** Creator information */
  createdBy?: {
    /** Creator Agent's instanceId */
    instanceId: string;
    /** Creator Agent's name */
    name?: string;
    /** Creation timestamp */
    createdAt: Date;
  };

  /** Child Agent instanceIds */
  childInstanceIds?: string[];

  /** Runtime control permissions granted to this Agent */
  runtimePermissions?: RuntimeControlPermissions;
}

// =============================================================================
// Runtime Control Permissions
// =============================================================================

/**
 * RuntimeControlPermissions - Agent's Runtime API control permissions
 *
 * Specifies what Runtime operations an Agent can perform.
 * Permissions are set at creation time and cannot be modified at runtime.
 *
 * @example
 * ```typescript
 * // Full permissions for main controller
 * const fullPermissions: RuntimeControlPermissions = {
 *   canCreateAgent: true,
 *   canDestroyAgent: true,
 *   canManageAgentLifecycle: true,
 *   canSubmitTask: true,
 *   canListAllAgents: true,
 *   canGetStats: true,
 *   maxChildAgents: -1,  // unlimited
 * };
 *
 * // Limited permissions for worker
 * const limitedPermissions: RuntimeControlPermissions = {
 *   canCreateAgent: false,
 *   canDestroyAgent: false,
 *   canManageAgentLifecycle: false,
 *   canSubmitTask: true,
 *   canListAllAgents: false,
 *   canGetStats: false,
 *   maxChildAgents: 0,
 * };
 * ```
 */
export interface RuntimeControlPermissions {
  /** Whether this Agent can create child Agents */
  canCreateAgent: boolean;

  /** Whether this Agent can destroy Agents (only those it created) */
  canDestroyAgent: boolean;

  /** Whether this Agent can start/stop Agents (only those it created) */
  canManageAgentLifecycle: boolean;

  /** Whether this Agent can submit tasks to other Agents */
  canSubmitTask: boolean;

  /** Whether this Agent can list all Agents (false = only its children) */
  canListAllAgents: boolean;

  /** Whether this Agent can get runtime statistics */
  canGetStats: boolean;

  /** Maximum number of child Agents this Agent can create (-1 = unlimited) */
  maxChildAgents: number;
}

/**
 * Default permissions - no Runtime control capabilities
 */
export const DEFAULT_RUNTIME_PERMISSIONS: RuntimeControlPermissions = {
  canCreateAgent: false,
  canDestroyAgent: false,
  canManageAgentLifecycle: false,
  canSubmitTask: false,
  canListAllAgents: false,
  canGetStats: false,
  maxChildAgents: 0,
};

/**
 * Full permissions - all Runtime control capabilities
 */
export const FULL_RUNTIME_PERMISSIONS: RuntimeControlPermissions = {
  canCreateAgent: true,
  canDestroyAgent: true,
  canManageAgentLifecycle: true,
  canSubmitTask: true,
  canListAllAgents: true,
  canGetStats: true,
  maxChildAgents: -1,
};

// =============================================================================
// Runtime Statistics
// =============================================================================

/**
 * RuntimeStats - Statistics about the runtime state
 *
 * Provides a snapshot of the current runtime status including
 * agent counts and task queue metrics.
 */
export interface RuntimeStats {
  /** Total number of agents managed by this runtime */
  totalAgents: number;
  /** Count of agents grouped by their current status */
  agentsByStatus: Record<AgentStatus, number>;
  /** Number of tasks waiting to be processed */
  totalPendingTasks?: number;
  /** Number of tasks currently being processed */
  totalProcessingTasks?: number;
}

// =============================================================================
// Minimal Agent interface (to avoid circular dependency)
// =============================================================================

/**
 * Minimal Agent interface for type references
 * This is a subset of the full Agent interface to avoid circular dependencies
 */
export interface IAgentMinimal {
  instanceId: string;
  status: AgentStatus;
  config?: { name?: string; type?: string };
}

/**
 * Agent type - actual Agent class from agent.ts
 * This is declared as unknown to avoid circular dependency.
 * The actual implementation should cast this to the proper Agent type.
 */
export type AgentType = unknown;

// =============================================================================
// IRuntimeControlClient
// =============================================================================

/**
 * IRuntimeControlClient - Restricted Runtime control interface
 *
 * Provided to Agents to enable自主管理 child Agents.
 * All operations are subject to permission checks and hierarchy constraints.
 *
 * **Permission Model:**
 * - Agents can only manage Agents they created
 * - Permissions are fixed at creation time
 * - Cascade destruction: parent destruction automatically destroys all descendants
 *
 * @example
 * ```typescript
 * const client = this.getRuntimeClient();
 * if (client?.hasPermission('canCreateAgent')) {
 *   const childId = await client.createAgent({
 *     agent: { name: 'worker', type: 'worker' }
 *   });
 * }
 * ```
 */
export interface IRuntimeControlClient {
  // ============================================
  // Permission Query
  // ============================================

  /**
   * Get current permissions configuration
   */
  getPermissions(): RuntimeControlPermissions;

  /**
   * Check if a specific permission is granted
   */
  hasPermission(permission: keyof RuntimeControlPermissions): boolean;

  // ============================================
  // Agent Lifecycle (permission controlled)
  // ============================================

  /**
   * Create a child Agent
   *
   * @param options Agent configuration
   * @throws Error if canCreateAgent permission is not granted
   * @throws Error if maxChildAgents limit is reached
   */
  createAgent(options: RuntimeControlAgentOptions): Promise<string>;

  /**
   * Start an Agent (can only start Agents this Agent created)
   *
   * @throws Error if canManageAgentLifecycle permission is not granted
   * @throws Error if target Agent is not a descendant
   */
  startAgent(instanceId: string): Promise<void>;

  /**
   * Stop an Agent (can only stop Agents this Agent created)
   *
   * @throws Error if canManageAgentLifecycle permission is not granted
   * @throws Error if target Agent is not a descendant
   */
  stopAgent(instanceId: string): Promise<void>;

  /**
   * Destroy an Agent (can only destroy Agents this Agent created, cascade by default)
   *
   * @param instanceId Target Agent instance ID
   * @param options.cascade If true, also destroys all descendants (default: true)
   * @throws Error if canDestroyAgent permission is not granted
   * @throws Error if target Agent is not a descendant
   */
  destroyAgent(
    instanceId: string,
    options?: { cascade?: boolean },
  ): Promise<void>;

  // ============================================
  // Agent Query (permission controlled)
  // ============================================

  /**
   * Get an Agent instance
   *
   * - With canListAllAgents: can get any Agent
   * - Without: can only get its own child Agents
   */
  getAgent(instanceId: string): Promise<AgentType | undefined>;

  /**
   * List Agents
   *
   * - With canListAllAgents: lists all Agents
   * - Without: only lists its own child Agents
   */
  listAgents(filter?: AgentFilter): Promise<AgentMetadata[]>;

  /**
   * Get this Agent's own instanceId
   */
  getSelfInstanceId(): string;

  /**
   * Get parent Agent's instanceId (if any)
   */
  getParentInstanceId(): string | undefined;

  /**
   * List all direct child Agents
   */
  listChildAgents(): Promise<AgentMetadata[]>;

  // ============================================
  // Task Management (permission controlled)
  // ============================================

  /**
   * Submit a task to an Agent
   *
   * @throws Error if canSubmitTask permission is not granted
   */
  submitTask(task: TaskSubmission): Promise<string>;

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): Promise<RuntimeTask | undefined>;

  /**
   * Get pending tasks
   */
  getPendingTasks(instanceId?: string): Promise<RuntimeTask[]>;

  // ============================================
  // Runtime Statistics (permission controlled)
  // ============================================

  /**
   * Get runtime statistics
   *
   * @throws Error if canGetStats permission is not granted
   */
  getStats(): Promise<RuntimeStats>;
}

// =============================================================================
// Agent Creation Options for Runtime Control
// =============================================================================

/**
 * AgentSoul - Core Agent configuration
 */
export interface AgentSoul {
  sop?: unknown;
  config?: Record<string, unknown>;
  taskId?: string;
  name?: string;
  type?: string;
  description?: string;
}

/**
 * Component registration for Agent
 */
export interface ComponentRegistration {
  id: string;
  component: unknown;
  priority?: number;
}

/**
 * Observable agent callbacks
 */
export interface ObservableAgentCallbacks {
  onAgentStart?: () => void;
  onAgentStop?: () => void;
  onAgentComplete?: (result?: unknown) => void;
  onAgentError?: (error?: Error) => void;
}

/**
 * Hook configuration
 */
export interface HookConfig {
  hooks?: unknown[];
  enabledHooks?: string[];
  disabledHooks?: string[];
  globalHandler?: unknown;
}

/**
 * Runtime control API provider settings
 */
export interface RuntimeControlProviderSettings {
  apiProvider?: string;
  apiKey?: string;
  apiModelId?: string;
  apiBaseUrl?: string;
  apiTimeout?: number;
}

/**
 * Virtual workspace config
 */
export interface RuntimeControlVirtualWorkspaceConfig {
  id?: string;
  name?: string;
  rootDir?: string;
}

/**
 * Options for creating an Agent via RuntimeControlClient
 */
export interface RuntimeControlAgentOptions {
  agent?: AgentSoul;
  api?: Partial<RuntimeControlProviderSettings>;
  workspace?: Partial<RuntimeControlVirtualWorkspaceConfig>;
  observers?: ObservableAgentCallbacks;
  components?: ComponentRegistration[];
  hooks?: HookConfig;

  /**
   * Runtime permissions for the child Agent
   * If not specified, child inherits limited permissions from parent
   */
  runtimePermissions?: Partial<RuntimeControlPermissions>;
}

/**
 * AgentRuntimeConfig - Configuration for AgentRuntime
 */
export interface AgentRuntimeConfig {
  /** Maximum number of agents (default: 10) */
  maxAgents?: number;

  /** Default API configuration for all agents created by this runtime */
  defaultApiConfig?: Partial<RuntimeControlProviderSettings>;

  /** Persistence configuration */
  persistence?: PersistenceConfig;

  /** Task queue configuration */
  taskQueue?: TaskQueueConfig;
}

/**
 * Filter options for listing agents
 */
export interface AgentFilter {
  status?: AgentStatus;
  agentType?: string;
  name?: string;
}

// =============================================================================
// Task Types - Central Task Queue
// =============================================================================

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Task submission - Parameters for submitting a new task
 */
export interface TaskSubmission {
  /** Task description */
  description: string;

  /** Task input data */
  input?: Record<string, unknown>;

  /** Task priority */
  priority?: TaskPriority;

  /** Target Agent instance ID (required - direct routing only) */
  targetInstanceId: string;

  /** Task expiration time */
  expiresAt?: Date;
}

/**
 * RuntimeTask - Stored in CentralTaskQueue and RuntimeTask table
 */
export interface RuntimeTask {
  /** Unique task identifier */
  taskId: string;

  /** Task description */
  description: string;

  /** Task input data */
  input?: Record<string, unknown>;

  /** Task priority */
  priority: TaskPriority;

  /** Task status */
  status: TaskStatus;

  /** Target Agent instance ID */
  targetInstanceId: string;

  /** Agent instance processing this task */
  processingInstanceId?: string;

  /** Task result - from workspace.exportResult() */
  output?: Record<string, ExportResult>;

  /** Error message if failed */
  error?: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Processing start timestamp */
  startedAt?: Date;

  /** Completion timestamp */
  completedAt?: Date;

  /** Expiration timestamp */
  expiresAt?: Date;
}

/**
 * Task result - Returned when task completes
 */
export interface RuntimeTaskResult {
  /** Task ID */
  taskId: string;

  /** Whether task completed successfully */
  success: boolean;

  /** Task output - from workspace.exportResult() */
  output?: Record<string, ExportResult>;

  /** Error message if failed */
  error?: string;

  /** Completion timestamp */
  completedAt: Date;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Runtime event types
 */
export type RuntimeEventType =
  | 'agent:created'
  | 'agent:started'
  | 'agent:stopped'
  | 'agent:destroyed'
  | 'agent:error'
  | 'agent:idle' // Agent becomes available for new tasks
  | 'task:submitted'
  | 'task:assigned'
  | 'task:started'
  | 'task:completed'
  | 'task:failed';

/**
 * Runtime event
 */
export interface RuntimeEvent {
  /** Unique event identifier */
  id: string;

  /** Event type */
  type: RuntimeEventType;

  /** Event timestamp */
  timestamp: Date;

  /** Event payload */
  payload: unknown;
}

/**
 * Event handler function
 */
export type EventHandler = (event: RuntimeEvent) => void;

// =============================================================================
// Runtime Configuration
// =============================================================================

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Database URL */
  databaseUrl: string;

  /** Auto-commit changes */
  autoCommit?: boolean;
}

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  /** Maximum pending tasks */
  maxPendingTasks?: number;

  /** Task timeout in milliseconds */
  taskTimeout?: number;

  /** Enable task expiration check */
  enableExpiration?: boolean;
}

/**
 * Agent Runtime configuration
 */
export interface AgentRuntimeConfig {
  /** Maximum number of agents */
  maxAgents?: number;

  /** Persistence configuration */
  persistence?: PersistenceConfig;

  /** Task queue configuration */
  taskQueue?: TaskQueueConfig;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique task ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if task is expired
 */
export function isTaskExpired(task: RuntimeTask): boolean {
  if (!task.expiresAt) return false;
  return new Date() > task.expiresAt;
}

/**
 * Get default task priority
 */
export function getDefaultPriority(): TaskPriority {
  return 'normal';
}

// Re-export types from other modules
export type { ExportResult } from '../../components/core/toolComponent.js';
export type { AgentStatus } from '../common/types.js';
