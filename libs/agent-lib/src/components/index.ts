/**
 * Agent Lib Components Module
 *
 * This module provides the core component infrastructure:
 * - ToolComponent base class
 * - TUI rendering primitives
 * - Component Registry
 * - Utility functions
 * - Built-in components (LineageControl)
 *
 * Domain-specific components are provided by the component-hub package.
 */

// UI Components
export * from './ui/index.js';

/**
 * Utils Module
 *
 * This module provides utility functions for tool rendering.
 */
export * from './utils/index.js';

/**
 * Component Registry Module
 *
 * This module provides the ComponentRegistry for managing ToolComponent registration.
 */
export { ComponentRegistry } from './ComponentRegistry.js';
export type { ComponentRegistration } from './ComponentRegistry.js';

/**
 * Core Module
 *
 * This module provides the core types and ToolComponent base class.
 */
export * from './core/index.js';

// ==================== Lineage Control Component ====================

/**
 * Lineage Control Module
 *
 * Unified component for agent inbox, task delegation, and lineage-based agent lifecycle management.
 * Replaces the legacy A2ATaskComponent and RuntimeControlComponent.
 */
export { LineageControlComponent } from './LineageControl/index.js';
export {
  lineageControlToolSchemas,
  type CreateAgentByTypeParams,
  type StartAgentParams,
  type StopAgentParams,
  type DestroyAgentParams,
  type ListChildAgentsParams,
  type ListAllowedSoulsParams,
  type GetMyInfoParams,
  type GetStatsParams,
  type DiscoverAgentsParams,
  type LineageControlToolName,
  type LineageControlToolReturnTypes,
  type SentTaskInfo,
  type IncomingTaskInfo,
  type CheckInboxParams,
  type AcknowledgeTaskParams,
  type CompleteTaskParams,
  type FailTaskParams,
  type SendTaskParams,
  type SendQueryParams,
  type CheckSentParams,
  type WaitForResultParams,
  type CancelTaskParams,
} from './LineageControl/index.js';

// ==================== Legacy A2A Re-exports ====================

export type {
  AcknowledgeTaskParams as A2AAcknowledgeTaskParams,
  CompleteTaskParams as A2ACompleteTaskParams,
  FailTaskParams as A2AFailTaskParams,
  SendTaskParams as A2ASendTaskParams,
  SendQueryParams as A2ASendQueryParams,
  WaitForResultParams as A2AWaitForResultParams,
  CancelTaskParams as A2ACancelTaskParams,
  DiscoverAgentsParams as A2ADiscoverAgentsParams,
  CheckInboxParams as A2ACheckInboxParams,
  CheckSentParams as A2ACheckSentParams,
  SentTaskInfo as A2ASentTaskInfo,
  IncomingTaskInfo as A2AIncomingTaskInfo,
} from './A2AComponent/a2aTaskSchemas.js';

// Test Components - Re-export for convenience in tests
// Located in: core/statefulContext/__tests__/testComponents.ts
export {
  TestComponent,
  TestComponent2,
  AnotherComponent,
} from '../core/statefulContext/__tests__/testComponents.js';
export {
  TestToolComponentA,
  TestToolComponentB,
  TestToolComponentC,
} from '../core/statefulContext/__tests__/testComponents.js';
