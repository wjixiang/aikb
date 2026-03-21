/**
 * Agent Runtime System
 *
 * This module provides a multi-agent runtime environment with:
 * - Agent lifecycle management (create/start/stop/destroy)
 * - Central task queue for task distribution
 * - Event-driven monitoring
 *
 * @example
 * ```typescript
 * import { AgentRuntime } from 'agent-lib/runtime';
 *
 * const runtime = new AgentRuntime({ maxAgents: 5 });
 *
 * // Create an agent
 * const agentId = await runtime.createAgent({
 *   agent: { sop: 'My SOP...', name: 'MyAgent' },
 *   api: { apiKey: '...' }
 * });
 *
 * // Start the agent
 * await runtime.startAgent(agentId);
 *
 * // Submit a task
 * const taskId = await runtime.submitTask({
 *   description: 'Do something',
 *   targetInstanceId: agentId
 * });
 * ```
 */

// Types
export type {
  AgentMetadata,
  TaskSubmission,
  TaskPriority,
  TaskStatus,
  RuntimeTask,
  RuntimeTaskResult,
  RuntimeEvent,
  RuntimeEventType,
  EventHandler,
  ExportResult,
  AgentRuntimeConfig,
  PersistenceConfig,
  TaskQueueConfig,
} from './types.js';

export {
  generateTaskId,
  generateEventId,
  isTaskExpired,
  getDefaultPriority,
} from './types.js';

// Agent Registry
export type { IAgentRegistry } from './AgentRegistry.js';
export { AgentRegistry, createAgentRegistry } from './AgentRegistry.js';

// Event Dispatcher
export type { IEventDispatcher } from './EventDispatcher.js';
export { EventDispatcher, createEventDispatcher } from './EventDispatcher.js';

// Central Task Queue
export type { ICentralTaskQueue } from './CentralTaskQueue.js';
export { CentralTaskQueue, createCentralTaskQueue } from './CentralTaskQueue.js';

// Agent Runtime
export type { IAgentRuntime, AgentFilter, RuntimeStats } from './AgentRuntime.js';
export { AgentRuntime, createAgentRuntime } from './AgentRuntime.js';
