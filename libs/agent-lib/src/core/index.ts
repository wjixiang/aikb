/**
 * Agent Lib Core Module
 *
 * This module provides the core agent functionality including:
 * - Agent and factory
 * - BAML client
 * - State management
 * - Memory
 * - Tools
 * - Expert system
 * - Thinking
 * - Types
 */

// Agent and Factory
export { Agent, defaultAgentConfig } from './agent/agent.js';
export { AgentFactory } from './agent/AgentFactory.js';
export type { AgentConfig, AgentFactoryOptions } from './agent/AgentFactory.js';
export * from './agent/ObservableAgent.js';

// Assistant Message
export { NativeToolCallParser } from './assistant-message/NativeToolCallParser.js';

// API Client
export * from './api-client/index.js';

// BAML Client
export * from './baml_client/index.js';

// Database
export { prisma, AgentDBPrismaService } from '../prisma.js';
export { AgentDBModule } from '../agent-db.module.js';

// DI (Dependency Injection)
export * from './di/index.js';

// Expert System
export * from './expert/index.js';
export { ExpertWorkspaceBase } from './expert/ExpertWorkspaceBase.js';
export { ExpertExecutor } from './expert/ExpertExecutor.js';
export { ExpertRegistry } from './expert/ExpertRegistry.js';
export { createExpertConfig } from './expert/ExpertFactory.js';
export type { ValidationResult, InputHandler, ExportConfig, ExportResult, ExpertConfig, ExpertComponentDefinition, ExpertTask, ExpertResult, IExpertInstance } from './expert/types.js';

// Memory
export * from './memory/index.js';

// Prompts
export * from './prompts/index.js';

// Stateful Context
export * from './statefulContext/index.js';

// Task
export * from './task/index.js';
export type { ApiMessage } from './task/task.type.js';
export { MessageBuilder } from './task/task.type.js';
export { MessageContentFormatter } from './task/MessageFormatter.util.js';

// Thinking
export * from './thinking/index.js';

// Tools
export * from './tools/index.js';

// Types
export * from './types/index.js';

// Utils
export * from './utils/index.js';

// Workspaces
export * from './workspaces/index.js';
