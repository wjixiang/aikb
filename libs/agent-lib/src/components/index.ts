/**
 * Agent Lib Components Module
 *
 * This module provides the core component infrastructure:
 * - ToolComponent base class
 * - TUI rendering primitives
 * - Utility functions
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
 * Core Module
 *
 * This module provides the core types and ToolComponent base class.
 */
export * from './core/index.js';

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
