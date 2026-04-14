/**
 * Agent Runtime System - Core Type Definitions
 *
 * This module defines the core types for the Agent Runtime system,
 * which manages multiple Agent instances.

 * Simplified architecture:
 * - No permission system - all agents have equal capabilities
 * - Topology management integrated for agent communication
 */

import type { AgentStatus } from '../common/types.js';
import type { DIComponentRegistration } from '../di/UnifiedAgentConfig.js';

// =============================================================================
// Agent Metadata
// =============================================================================

export interface AgentMetadata {
  instanceId: string;
  alias: string;
  status: AgentStatus;
  name?: string;
  agentType?: string;
  description?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  parentInstanceId?: string;
  createdBy?: {
    instanceId: string;
    name?: string;
    createdAt: Date;
  };
  childInstanceIds?: string[];
  version?: string;
  capabilities?: string[];
  skills?: string[];
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Runtime Statistics
// =============================================================================

export interface RuntimeStats {
  totalAgents: number;
  agentsByStatus: Record<AgentStatus, number>;
}

// =============================================================================
// ID Type Aliases (for clarity)
// =============================================================================

/**
 * Conversation ID - unique identifier for a message conversation session
 */
export type ConversationId = string;

/**
 * A2A Task ID - business-level task identifier
 */
export type A2ATaskId = string;

/**
 * Runtime Task ID - database primary key for task persistence
 */
export type RuntimeTaskId = string;

// =============================================================================
// Task Integration Callbacks
// =============================================================================

export interface ConversationTaskInfo {
  runtimeTaskId: string;
  taskId: string;
}

export interface TaskCallbacks {
  onTaskProcessing?: (info: ConversationTaskInfo) => void;
  onTaskCompleted?: (info: ConversationTaskInfo, result: unknown) => void;
  onTaskFailed?: (info: ConversationTaskInfo, error: string) => void;
}

// =============================================================================
// IRuntimeControlClient (Simplified - No Permissions)
// =============================================================================

/**
 * IRuntimeControlClient - Runtime control interface for Agents
 *
 * All agents have equal capabilities to:
 * - Create/destroy/stop agents
 * - Query runtime state
 */
export interface IRuntimeControlClient {
  // ============================================
  // Agent Lifecycle
  // ============================================

  createAgent(options: RuntimeControlAgentOptions): Promise<string>;
  startAgent(instanceId: string): Promise<void>;
  stopAgent(instanceId: string): Promise<void>;
  sleepAgent(instanceId: string, reason?: string): Promise<void>;
  restoreAgent(instanceId: string): Promise<unknown>;
  destroyAgent(
    instanceId: string,
    options?: { cascade?: boolean },
  ): Promise<void>;

  // ============================================
  // Agent Query
  // ============================================

  /**
   * Resolve agent ID, alias, or name to instance ID
   */
  resolveAgentId(idOrAlias: string): string;
  getAgent(instanceId: string): Promise<unknown>;
  listAgents(filter?: AgentFilter): Promise<AgentMetadata[]>;
  getSelfInstanceId(): string;
  getParentInstanceId(): string | undefined;
  listChildAgents(): Promise<AgentMetadata[]>;

  // ============================================
  // Statistics
  // ============================================

  getStats(): Promise<RuntimeStats>;
}

// =============================================================================
// Agent Creation Options
// =============================================================================

export interface AgentSoul {
  sop?: unknown;
  config?: Record<string, unknown>;
  taskId?: string;
  name?: string;
  type?: string;
  description?: string;
  // A2A service discovery fields (AgentCard)
  version?: string;
  capabilities?: string[];
  skills?: string[];
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface ObservableAgentCallbacks {
  onAgentStart?: () => void;
  onAgentStop?: () => void;
  onAgentComplete?: (result?: unknown) => void;
  onAgentError?: (error?: Error) => void;
}

export interface HookConfig {
  hooks?: unknown[];
  enabledHooks?: string[];
  disabledHooks?: string[];
  globalHandler?: unknown;
}

export interface RuntimeControlProviderSettings {
  apiProvider?: string;
  apiKey?: string;
  apiModelId?: string;
  apiBaseUrl?: string;
  apiTimeout?: number;
}

export interface RuntimeControlVirtualWorkspaceConfig {
  id?: string;
  name?: string;
  rootDir?: string;
}

export interface RuntimeControlAgentOptions {
  agent?: AgentSoul;
  api?: Partial<RuntimeControlProviderSettings>;
  workspace?: Partial<RuntimeControlVirtualWorkspaceConfig>;
  observers?: ObservableAgentCallbacks;
  components?: DIComponentRegistration[];
  hooks?: HookConfig;
  parentInstanceId?: string;
}

// =============================================================================
// Runtime Configuration
// =============================================================================

/**
 * MessageBus mode configuration
 */
export type MessageBusMode = 'memory' | 'redis';

/**
 * MessageBus configuration for AgentRuntime
 */
export interface MessageBusConfig {
  /** Operating mode: 'memory' for local, 'redis' for distributed */
  mode: MessageBusMode;
}

export interface AgentRuntimeConfig {
  /**
   * ApiClient instance for LLM API calls.
   * All agents created by this runtime will use this client.
   */
  apiClient?: import('llm-api-client').ApiClient;
  /**
   * Persistence service instance for agent state persistence.
   */
  persistenceService?: import('../persistence/types.js').IPersistenceService;
  /** MessageBus configuration - defaults to in-memory */
  messageBus?: MessageBusConfig;
  /** ACK timeout in ms for message confirmation (default: 5000) */
  ackTimeout?: number;
  /** Max retries for failed message delivery (default: 3) */
  maxRetries?: number;
}

export interface AgentFilter {
  status?: AgentStatus;
  agentType?: string;
  name?: string;
}

// =============================================================================
// Event Types
// =============================================================================

export type RuntimeEventType =
  | 'agent:created'
  | 'agent:started'
  | 'agent:stopped'
  | 'agent:destroyed'
  | 'agent:error'
  | 'agent:sleeping';

export interface AgentEventPayload {
  instanceId: string;
  error?: Error;
  [key: string]: unknown;
}

export interface RuntimeEvent {
  id: string;
  type: RuntimeEventType;
  timestamp: Date;
  payload: AgentEventPayload;
}

export type EventHandler = (event: RuntimeEvent) => void;

// =============================================================================
// Configuration
// =============================================================================

export interface PersistenceConfig {
  databaseUrl: string;
  autoCommit?: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Re-export
export { AgentStatus } from '../common/types.js';
