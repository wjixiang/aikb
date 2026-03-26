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
import type { A2ATaskResult } from '../a2a/types.js';
import type { IMessageBus } from './topology/messaging/MessageBus.js';
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
 * - Manage topology (register, connect agents)
 * - Query runtime state
 * - Send A2A messages to other agents
 */
export interface IRuntimeControlClient {
  // ============================================
  // Agent Lifecycle
  // ============================================

  createAgent(options: RuntimeControlAgentOptions): Promise<string>;
  stopAgent(instanceId: string): Promise<void>;
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

  // ============================================
  // Topology Management
  // ============================================

  registerInTopology(
    instanceId: string,
    nodeType: TopologyNodeType,
    capabilities?: string[],
  ): void;
  unregisterFromTopology(instanceId: string): void;
  connectAgents(from: string, to: string, edgeType?: EdgeType): void;
  disconnectAgents(from: string, to: string): void;
  getTopologyGraph(): ITopologyGraph;
  getTopologyStats(): RoutingStats;

  // ============================================
  // A2A Communication
  // ============================================

  /**
   * Send a task to another agent via A2A protocol
   */
  sendA2ATask(
    targetAgentId: string,
    taskId: string,
    description: string,
    input: Record<string, unknown>,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      /** ACK timeout in ms */
      ackTimeout?: number;
      /** Result timeout in ms */
      resultTimeout?: number;
    },
  ): Promise<A2ATaskResult>;

  /**
   * Send a task and wait only for ACK (asynchronous mode)
   * Returns after ACK is received with the conversationId
   */
  sendA2ATaskAndWaitForAck(
    targetAgentId: string,
    taskId: string,
    description: string,
    input: Record<string, unknown>,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      /** ACK timeout in ms */
      ackTimeout?: number;
    },
  ): Promise<string>;

  /**
   * Send a query to another agent via A2A protocol
   */
  sendA2AQuery(
    targetAgentId: string,
    query: string,
    options?: {
      expectedFormat?: string;
      /** Timeout in ms */
      timeout?: number;
    },
  ): Promise<unknown>;

  /**
   * Send an event notification to another agent via A2A protocol (fire-and-forget)
   */
  sendA2AEvent(
    targetAgentId: string,
    eventType: string,
    data: unknown,
  ): Promise<void>;
}

// =============================================================================
// Topology Types
// =============================================================================

export type TopologyNodeType = 'router' | 'worker' | 'hybrid';

export interface TopologyNode {
  instanceId: string;
  nodeType: TopologyNodeType;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export type EdgeType = 'parent-child' | 'peer' | 'route';

export interface TopologyEdge {
  from: string;
  to: string;
  edgeType: EdgeType;
  weight?: number;
  bidirectional?: boolean;
}

export interface RoutingDecision {
  action: RoutingAction;
  targetInstanceIds?: string[];
  reasoning?: string;
}

export type RoutingAction = 'forward' | 'broadcast' | 'respond' | 'reject';

export interface RoutingStats {
  totalMessages: number;
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  failedConversations: number;
  timedOutConversations: number;
}

export interface ITopologyGraph {
  addNode(node: TopologyNode): void;
  removeNode(instanceId: string): void;
  getNode(instanceId: string): TopologyNode | undefined;
  hasNode(instanceId: string): boolean;
  getAllNodes(): TopologyNode[];
  addEdge(edge: TopologyEdge): void;
  removeEdge(from: string, to: string): void;
  hasEdge(from: string, to: string): boolean;
  getEdge(from: string, to: string): TopologyEdge | undefined;
  getAllEdges(): TopologyEdge[];
  getNeighbors(instanceId: string): TopologyNode[];
  getChildren(instanceId: string): TopologyNode[];
  getParent(instanceId: string): TopologyNode | undefined;
  getParents(instanceId: string): TopologyNode[];
  findPath(from: string, to: string): string[] | null;
  isReachable(from: string, to: string): boolean;
  clear(): void;
  size: { nodes: number; edges: number };
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
  messageBus?: IMessageBus;
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
  /** Redis configuration (required when mode is 'redis') */
  redis?: import('./topology/messaging/RedisConfig.js').RedisMessageBusConfig;
}

export interface AgentRuntimeConfig {
  maxAgents?: number;
  defaultApiConfig?: Partial<RuntimeControlProviderSettings>;
  persistence?: PersistenceConfig;
  /** MessageBus configuration - defaults to in-memory */
  messageBus?: MessageBusConfig;
  /** ACK timeout in ms for message confirmation (default: 5000) */
  ackTimeout?: number;
  /** Result timeout in ms for async task completion (default: 60000) */
  resultTimeout?: number;
  /** Max retries for failed message delivery (default: 3) */
  maxRetries?: number;
  /** Runtime control config - when restBaseUrl is set, topology tools use REST API */
  runtimeControl?: {
    restBaseUrl?: string;
    apiKey?: string;
  };
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
  | 'agent:idle';

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
