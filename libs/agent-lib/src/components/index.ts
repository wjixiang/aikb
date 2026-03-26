/**
 * Agent Lib Components Module
 *
 * This module provides the core component infrastructure:
 * - ToolComponent base class
 * - TUI rendering primitives
 * - Component Registry
 * - Utility functions
 * - Built-in components (A2A, RuntimeControl)
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

// ==================== A2A Task Component ====================

/**
 * A2A Task Module
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

// ==================== RuntimeControl Component ====================

/**
 * RuntimeControl Component
 *
 * Tools for Agent creation and management.
 */
export { RuntimeControlComponent } from './runtime-control/index.js';
export type { RuntimeControlState } from './runtime-control/types.js';



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
