/**
 * Common Types - Shared type definitions across the agent system
 *
 * This module contains types that are shared across multiple modules
 * and don't belong to any specific module.
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Agent Task Status
// =============================================================================

/**
 * Agent execution status
 */
export enum AgentStatus {
  Idle = 'idle',
  Running = 'running',
  Sleep = 'sleep',
  Completed = 'completed',
  Aborted = 'aborted',
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use AgentStatus instead
 */
export type TaskStatus = AgentStatus;

// =============================================================================
// Task Metadata
// =============================================================================

/**
 * Simplified task execution metadata
 */
export interface TaskMetadata {
  taskId: string;
  startTime?: number;
  endTime?: number;
  tokenCount?: number;
  cost?: number;
}

// =============================================================================
// Event Callbacks
// =============================================================================

/**
 * Callback for task status changed events
 */
export type TaskStatusChangedCallback = (
  taskId: string,
  changedStatus: TaskStatus,
) => void;

/**
 * Callback for task completed events
 */
export type TaskCompletedCallback = (taskId: string) => void;

/**
 * Callback for task aborted events
 */
export type TaskAbortedCallback = (taskId: string, abortReason: string) => void;

// =============================================================================
// Agent Configuration
// =============================================================================

/**
 * Default agent configuration
 */
export interface AgentDefaults {
  /** Default timeout for agent execution (ms) */
  defaultTimeout: number;
  /** Default max tokens */
  defaultMaxTokens: number;
  /** Default temperature */
  defaultTemperature: number;
}

export const defaultAgentDefaults: AgentDefaults = {
  defaultTimeout: 120000,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
};
