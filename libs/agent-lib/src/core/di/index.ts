/**
 * Dependency Injection Module
 *
 * This module provides InversifyJS-based dependency injection infrastructure
 * for the agent-lib library. It includes service identifiers, container management,
 * and utilities for creating Agent instances with proper dependency injection.
 */

export { TYPES } from './types.js';
export {
  AgentContainer,
  type AgentCreationOptions,
  type UnifiedAgentConfig,
  type AgentConfigBundle,
  type AgentDependencies,
} from './container.js';
export {
  mergeWithDefaults,
  mergeConfigBundle,
} from './UnifiedAgentConfig.js';
export type { TestOverrides } from './types.js';
