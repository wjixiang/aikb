/**
 * Messaging Types - Agent communication types
 */

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

export interface Conversation {
  conversationId: string;
  request: TopologyMessage;
  ack?: TopologyMessage;
  result?: TopologyMessage;
  status: ConversationStatus;
  createdAt: number;
  ackTimeout: number;
  resultTimeout: number;
  retryCount: number;
  maxRetries: number;
}

export type ConversationStatus =
  | 'pending'
  | 'acknowledged'
  | 'completed'
  | 'failed'
  | 'timeout';

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

export interface TopologyConfig {
  defaultAckTimeout?: number;
  defaultResultTimeout?: number;
  maxRetries?: number;
  defaultTtl?: number;
}
