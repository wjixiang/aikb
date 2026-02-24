/**
 * Tool Management Module
 *
 * This module provides centralized tool management using IoC pattern.
 *
 * Key components:
 * - IToolProvider: Interface for tool sources
 * - IToolManager: Central tool registry and executor
 * - IToolStateStrategy: Strategy pattern for tool state control
 * - IToolStateManager: Manages tool state based on active skill
 */

// Core interfaces
export * from './IToolProvider.js';
export * from './IToolManager.js';

// ToolManager implementation
export { ToolManager } from './ToolManager.js';

// Providers
export * from './providers/index.js';

// State management
export * from './state/IToolStateStrategy.js';
export * from './state/IToolStateManager.js';
export { ToolStateManager } from './state/ToolStateManager.js';
