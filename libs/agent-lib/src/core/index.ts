/**
 * Agent Lib Core Module
 *
 * This module provides the core agent functionality including:
 * - Agent and factory
 * - State management
 * - Memory
 * - Tools
 * - Expert system
 * - Thinking
 * - Types
 */

// Agent and Factory
export { Agent, defaultAgentConfig } from './agent/agent.js';

// Configuration
export * from './config.js';
export { AgentFactory } from './agent/AgentFactory.js';
export type { AgentConfig } from './agent/agent.js';
export type { AgentFactoryOptions } from './agent/AgentFactory.js';
export * from './agent/ObservableAgent.js';

// Assistant Message
export { NativeToolCallParser } from './assistant-message/NativeToolCallParser.js';

// API Client
export * from './api-client/index.js';

// Common Types
export * from './common/types.js';

// DI (Dependency Injection)
export * from './di/index.js';

// Expert System (removed)

// Memory
export { ContextMemoryStore } from './memory/index.js';
export type { ContextSnapshot, MemorySummary } from './memory/index.js';
export { MemoryModule, defaultMemoryConfig } from './memory/index.js';
export type { IMemoryModule, MemoryModuleConfig } from './memory/index.js';
export type {
  ApiMessage,
  MessageBuilder,
  ThinkingBlock,
  ExtendedContentBlock,
  MessageAddedCallback,
} from './memory/index.js';

// Prompts
export * from './prompts/index.js';

// Stateful Context
export * from './statefulContext/index.js';

// Thinking
export * from './thinking/index.js';

// Tools
export * from './tools/index.js';

// Types
export * from './types/index.js';

// Utils
export * from './utils/index.js';

// Hooks
export * from './hooks/index.js';

// Prisma
export * from './prisma/index.js';

// Workspaces
export * from './workspaces/index.js';
