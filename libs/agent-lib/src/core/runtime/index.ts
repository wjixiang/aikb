/**
 * Agent Runtime System
 *
 * This module provides a multi-agent runtime environment with:
 * - Agent lifecycle management (create/start/stop/destroy)
 * - Event-driven monitoring
 *
 * @example
 * ```typescript
 * import { AgentRuntime } from 'agent-lib/runtime';
 *
 * const runtime = new AgentRuntime({});
 *
 * // Create an agent
 * const agentId = await runtime.createAgent({
 *   agent: { sop: 'My SOP...', name: 'MyAgent' },
 *   api: { apiKey: '...' }
 * });
 *
 * // Start the agent
 * await runtime.startAgent(agentId);
 * ```
 */

// Types
export type {
  AgentMetadata,
  RuntimeEvent,
  RuntimeEventType,
  EventHandler,
  AgentRuntimeConfig,
  PersistenceConfig,
  AgentEventPayload,
} from './types.js';

export { generateEventId } from './types.js';

// Agent Registry
export type { IAgentRegistry } from './AgentRegistry.js';
export { AgentRegistry, createAgentRegistry } from './AgentRegistry.js';

// Event Dispatcher
export type { IEventDispatcher } from './EventDispatcher.js';
export { EventDispatcher, createEventDispatcher } from './EventDispatcher.js';

// Agent Runtime
export type { IAgentRuntime, AgentFilter } from './AgentRuntime.js';
export { AgentRuntime, createAgentRuntime } from './AgentRuntime.js';

// Runtime Control
export type {
  IRuntimeControlClient,
  RuntimeControlAgentOptions,
  AgentSoul,
  ObservableAgentCallbacks,
  HookConfig,
  RuntimeControlProviderSettings,
  RuntimeControlVirtualWorkspaceConfig,
  RuntimeStats,
  TopologyNode,
  TopologyEdge,
  RoutingStats,
} from './types.js';

export { RuntimeControlClientImpl } from './RuntimeControlClient.js';

export { RuntimeControlState } from './RuntimeControlState.js';

export type { IAgentSleepControl } from './AgentSleepControl.js';

