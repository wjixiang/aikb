/**
 * Agent Topology Network - Core Type Definitions
 *
 * This module defines the core types for the multi-agent topology network,
 * including nodes, edges, messages, conversations, and routing decisions.
 */

// =============================================================================
// Node Types
// =============================================================================

export type TopologyNodeType = 'router' | 'worker' | 'hybrid';

export interface TopologyNode {
  instanceId: string;
  nodeType: TopologyNodeType;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Edge Types
// =============================================================================

export type EdgeType = 'parent-child' | 'peer' | 'route';

export interface TopologyEdge {
  from: string;
  to: string;
  edgeType: EdgeType;
  weight?: number;
  bidirectional?: boolean;
}

// =============================================================================
// Message Types
// =============================================================================

export type MessageType = 'request' | 'ack' | 'result' | 'event' | 'error';

export interface TopologyMessage {
  messageId: string;
  conversationId: string;
  from: string;
  to: string;
  content: unknown;
  messageType: MessageType;
  ttl: number;
  timestamp: number;
}

export function createMessage(
  from: string,
  to: string,
  content: unknown,
  messageType: MessageType,
  options?: Partial<Pick<TopologyMessage, 'conversationId' | 'ttl'>>,
): TopologyMessage {
  return {
    messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    conversationId:
      options?.conversationId ??
      `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    from,
    to,
    content,
    messageType,
    ttl: options?.ttl ?? 10,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Conversation Types
// =============================================================================

export type ConversationStatus =
  | 'pending'
  | 'acknowledged'
  | 'completed'
  | 'failed'
  | 'timeout';

export interface Conversation {
  conversationId: string;
  request: TopologyMessage;
  ack?: TopologyMessage;
  result?: TopologyMessage;
  status: ConversationStatus;
  createdAt: number;
  ackTimeout: number;
  retryCount: number;
  maxRetries: number;
}

export function createConversation(
  request: TopologyMessage,
  config: {
    ackTimeout?: number;
    maxRetries?: number;
  } = {},
): Conversation {
  return {
    conversationId: request.conversationId,
    request,
    status: 'pending',
    createdAt: Date.now(),
    ackTimeout: config.ackTimeout ?? 5000,
    retryCount: 0,
    maxRetries: config.maxRetries ?? 3,
  };
}

// =============================================================================
// Routing Types
// =============================================================================

export type RoutingAction = 'forward' | 'broadcast' | 'respond' | 'reject';

export interface RoutingDecision {
  action: RoutingAction;
  targetInstanceIds?: string[];
  reasoning?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface TopologyConfig {
  defaultAckTimeout?: number;
  maxRetries?: number;
  defaultTtl?: number;
}

export const DEFAULT_TOPOLOGY_CONFIG: Required<TopologyConfig> = {
  defaultAckTimeout: 5000,
  maxRetries: 3,
  defaultTtl: 10,
};

// =============================================================================
// Event Types
// =============================================================================

export type TopologyEventType =
  | 'node:added'
  | 'node:removed'
  | 'edge:added'
  | 'edge:removed'
  | 'message:sent'
  | 'message:received'
  | 'conversation:started'
  | 'conversation:ack'
  | 'conversation:completed'
  | 'conversation:timeout'
  | 'conversation:failed'
  | 'router:registered'
  | 'router:unregistered';

export interface TopologyEvent {
  id: string;
  type: TopologyEventType;
  timestamp: number;
  payload: unknown;
}

export function createTopologyEvent(
  type: TopologyEventType,
  payload: unknown,
): TopologyEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    timestamp: Date.now(),
    payload,
  };
}

// =============================================================================
// Utility Types
// =============================================================================

export interface RoutingStats {
  totalMessages: number;
  totalConversations: number;
  activeConversations: number;
  completedConversations: number;
  failedConversations: number;
  timedOutConversations: number;
  averageResponseTime?: number;
}

export interface MessageHandler {
  (message: TopologyMessage): void | Promise<void>;
}

export interface EventHandler {
  (event: TopologyEvent): void | Promise<void>;
}
