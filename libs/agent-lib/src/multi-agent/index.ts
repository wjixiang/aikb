/**
 * Multi-Agent System - Core Module
 *
 * Provides message-driven multi-agent communication infrastructure
 * with support for Expert-to-Expert and MC-to-Expert messaging.
 *
 * Main exports:
 * - TaskMessage, TaskResult: Core communication types
 * - TaskSource, TaskTarget: Address types
 * - IMessageBus: Message routing interface
 * - MessageBus: Message routing implementation
 * - IExpertAdapter, IMCAdapter: Integration adapters
 * - Helper functions: createTaskMessage, createTaskResult, etc.
 */

// Types
export * from './types.js';

// Message Bus
export { MessageBus } from './MessageBus.js';
export { MessageQueue } from './MessageQueue.js';
