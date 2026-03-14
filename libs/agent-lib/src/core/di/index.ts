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
    getGlobalContainer,
    resetGlobalContainer,
    type AgentCreationOptions,
} from './container.js';
