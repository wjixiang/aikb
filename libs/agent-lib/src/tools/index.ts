/**
 * Tool Management Module
 *
 * This module provides centralized tool management using IoC pattern.
 *
 * Key components:
 * - IToolProvider: Interface for tool sources
 * - IToolManager: Central tool registry and executor with integrated strategy management
 * - IToolStateStrategy: Strategy pattern for tool state control
 *
 * Note: ToolStateManager has been merged into ToolManager for simpler architecture.
 */

// Core interfaces
export * from './IToolProvider.js';
export * from './IToolManager.js';

// ToolManager implementation
export { ToolManager } from './ToolManager.js';

// Providers
export * from './providers/index.js';

// State management (strategy interfaces)
export * from './state/IToolStateStrategy.js';
