/**
 * Agent Lib Components Module
 *
 * This module provides the core component infrastructure:
 * - ToolComponent base class
 * - TUI rendering primitives
 * - Component Registry
 * - Utility functions
 *
 * Domain-specific components are in agent-components-lib package.
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

// ==================== Core Components ====================

/**
 * A2A Task Component
 *
 * A2A task acknowledgment and response management.
 */
export { A2ATaskComponent } from './A2AComponent/index.js';
export {
  a2aTaskToolSchemas,
  type AcknowledgeTaskParams,
  type CompleteTaskParams,
  type FailTaskParams,
  type SendTaskResultParams,
  type GetPendingTasksParams,
  type A2ATaskToolName,
} from './A2AComponent/index.js';

/**
 * RuntimeControl Component
 *
 * Tools for Agent creation and management.
 */
export { RuntimeControlComponent } from './runtime-control/index.js';
export type { RuntimeControlState } from './runtime-control/types.js';
