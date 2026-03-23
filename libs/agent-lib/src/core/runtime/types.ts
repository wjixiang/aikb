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

// =============================================================================
// Agent Metadata
// =============================================================================

export interface AgentMetadata {
  instanceId: string;
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
}

// =============================================================================
// Runtime Statistics
// =============================================================================

export interface RuntimeStats {
  totalAgents: number;
  agentsByStatus: Record<AgentStatus, number>;
}

// =============================================================================
// IRuntimeControlClient (Simplified - No Permissions)
// =============================================================================

/**
 * IRuntimeControlClient - Runtime control interface for Agents
 *
 * All agents have equal capabilities to:
 * - Create/destroy/start/stop agents
 * - Manage topology (register, connect agents)
 * - Query runtime state
 */
export interface IRuntimeControlClient {
  // ============================================
  // Agent Lifecycle
  // ============================================

  createAgent(options: RuntimeControlAgentOptions): Promise<string>;
  startAgent(instanceId: string): Promise<void>;
  stopAgent(instanceId: string): Promise<void>;
  destroyAgent(
    instanceId: string,
    options?: { cascade?: boolean },
  ): Promise<void>;

  // ============================================
  // Agent Query
  // ============================================

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
}

export interface ComponentRegistration {
  id: string;
  component: unknown;
  priority?: number;
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
  components?: ComponentRegistration[];
  hooks?: HookConfig;
  parentInstanceId?: string;
}

// =============================================================================
// Runtime Configuration
// =============================================================================

export interface AgentRuntimeConfig {
  maxAgents?: number;
  defaultApiConfig?: Partial<RuntimeControlProviderSettings>;
  persistence?: PersistenceConfig;
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

export interface RuntimeEvent {
  id: string;
  type: RuntimeEventType;
  timestamp: Date;
  payload: unknown;
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
export type { AgentStatus } from '../common/types.js';
