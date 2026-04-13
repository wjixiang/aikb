/**
 * Agent Lib Core Module
 *
 * This module provides the core agent functionality including:
 * - Agent and factory
 * - State management
 * - Memory
 * - Tools
 * - Expert system
 * - Types
 */

// Agent and Factory
export { Agent, defaultAgentConfig } from './agent/agent.js';

// Configuration
export * from './config.js';
export { AgentFactory } from './agent/AgentFactory.js';
export type { AgentConfig } from './agent/agent.js';
export type { AgentFactoryOptions } from './agent/AgentFactory.js';
export type { AgentBlueprint } from './agent/AgentFactory.js';
export * from './agent/ObservableAgent.js';

// Agent Soul Registry (types and factory registration - concrete agents in agent-soul-hub)
export {
  AgentSoulRegistry,
  agentSoulRegistry,
  registerAgentSoulFactory,
  createAgentSoulByType,
  getAvailableAgentSoulTypes,
} from './AgentSoulRegistry.js';
export type {
  AgentSoulEntry,
  IAgentSoulRegistry,
  AgentSoulType,
} from './AgentSoulRegistry.js';

// Assistant Message
export { NativeToolCallParser } from './assistant-message/NativeToolCallParser.js';

// API Client (re-exported from llm-api-client)
export * from 'llm-api-client';

// Common Types
export * from './common/types.js';

// DI (Dependency Injection)
export * from './di/index.js';

// Expert System (removed)

// Memory
export { MemoryModule, defaultMemoryConfig } from './memory/index.js';
export type { IMemoryModule, MemoryModuleConfig } from './memory/index.js';
export type {
  Message,
  MessageBuilder,
  MessageAddedCallback,
  ExtendedContentBlock,
  ThinkingBlock,
} from './memory/index.js';

// Prompts
export * from './prompts/index.js';

// Stateful Context
export * from './statefulContext/index.js';

// Tools
export * from './tools/index.js';

// Types
export * from './types/index.js';

// Hooks
export * from './hooks/index.js';

// Prisma
export * from './prisma/index.js';

// Topology Network
export * from './runtime/topology/index.js';

// A2A (Agent-to-Agent) Communication
export * from './a2a/index.js';

// Runtime (selective exports to avoid conflicts)
export type {
  AgentMetadata,
  RuntimeEvent,
  RuntimeEventType,
  AgentEventPayload,
  AgentRuntimeConfig,
  PersistenceConfig,
  IAgentRegistry,
  IEventDispatcher,
  IAgentRuntime,
  AgentFilter,
  IRuntimeControlClient,
  RuntimeControlAgentOptions,
  AgentSoul,
  ObservableAgentCallbacks as RuntimeObservableAgentCallbacks,
  HookConfig as RuntimeHookConfig,
  RuntimeControlProviderSettings,
  RuntimeControlVirtualWorkspaceConfig,
  RuntimeStats,
  TopologyNode,
  TopologyEdge,
  RoutingStats,
  IAgentSleepControl,
  IAgentEventStream,
  AgentEventType,
  AgentEvent,
  AgentEventDataMap,
  AgentStatusEventData,
  MessageAddedEventData,
  ToolStartedEventData,
  ToolCompletedEventData,
  LlmCompletedEventData,
  ErrorEventData,
} from './runtime/index.js';
export {
  generateEventId,
  AgentRegistry,
  createAgentRegistry,
  EventDispatcher,
  createEventDispatcher,
  AgentRuntime,
  createAgentRuntime,
  RuntimeControlClientImpl,
  RuntimeControlState,
  createAgentEventStream,
  createAgentEvent,
} from './runtime/index.js';
