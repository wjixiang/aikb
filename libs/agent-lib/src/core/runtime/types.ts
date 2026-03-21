/**
 * Agent Runtime System - Core Type Definitions
 *
 * This module defines the core types for the Agent Runtime system,
 * which manages multiple Agent instances and provides a central task queue.
 */

import type { ExportResult } from '../../components/core/types.js';
import type { AgentStatus } from '../persistence/types.js';

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
}

/**
 * AgentRuntimeConfig - Configuration for AgentRuntime
 */
export interface AgentRuntimeConfig {
  /** Maximum number of agents (default: 10) */
  maxAgents?: number;

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
  | 'task:submitted'
  | 'task:assigned'
  | 'task:started'
  | 'task:completed'
  | 'task:failed';

/**
 * Runtime event
 */
export interface RuntimeEvent {
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
