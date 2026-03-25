/**
 * A2A (Agent-to-Agent) Communication Protocol - Type Definitions
 *
 * This module defines the core types for A2A communication between agents,
 * including Agent Cards, Messages, Payloads, and related structures.
 */

import type { TopologyMessage } from '../runtime/topology/types';

// =============================================================================
// Agent Card - Service Discovery
// =============================================================================

/**
 * Agent Card represents an agent's identity and capabilities for service discovery.
 * Similar to Anthropic's Agent Card specification.
 */
export interface AgentCard {
  /** Unique identifier for the agent instance */
  instanceId: string;
  /** Human-readable name */
  name: string;
  /** Description of the agent's purpose */
  description: string;
  /** Protocol version */
  version: string;
  /** Capabilities this agent provides (e.g., "search", "analysis", "mail") */
  capabilities: string[];
  /** Specific skills the agent possesses */
  skills: string[];
  /** Communication endpoint (instanceId for internal routing) */
  endpoint: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** URL to agent's publicly accessible A2A endpoint (optional) */
  url?: string;
}

/**
 * Simplified Agent Card for registry operations
 */
export interface AgentCardSummary {
  instanceId: string;
  name: string;
  capabilities: string[];
  skills: string[];
}

// =============================================================================
// A2A Message Types
// =============================================================================

/**
 * A2A Message Types - High-level protocol messages
 */
export type A2AMessageType =
  | 'task'
  | 'query'
  | 'response'
  | 'event'
  | 'stream'
  | 'cancel';

/**
 * Task status for A2A Task messages
 */
export type A2ATaskStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * A2A Payload - Content of an A2A message
 */
export interface A2APayload {
  /** Task identifier (for task/response messages) */
  taskId?: string;
  /** Human-readable task description */
  description?: string;
  /** Task input data */
  input?: Record<string, unknown>;
  /** Task output data (for responses) */
  output?: unknown;
  /** Current task status */
  status?: A2ATaskStatus;
  /** Error message (for failed tasks) */
  error?: string;
  /** Correlation ID for related messages */
  correlationId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A2A Message - High-level message structure for agent communication
 */
export interface A2AMessage {
  /** Unique message identifier */
  messageId: string;
  /** Conversation identifier for grouping related messages */
  conversationId: string;
  /** Type of A2A message */
  messageType: A2AMessageType;
  /** Sender's instance ID */
  from: string;
  /** Receiver's instance ID */
  to: string;
  /** Message content/payload */
  content: A2APayload;
  /** Message creation timestamp */
  timestamp: number;
  /** Whether this is a streaming message */
  streaming?: boolean;
  /** Reference to a previous message (for correlations) */
  referenceId?: string;
  /** Message priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

/**
 * Task delegation message
 */
export interface A2ATaskMessage extends Omit<A2AMessage, 'content'> {
  messageType: 'task';
  content: {
    taskId: string;
    description: string;
    input: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
}

/**
 * Query request message
 */
export interface A2AQueryMessage extends Omit<A2AMessage, 'content'> {
  messageType: 'query';
  content: {
    query: string;
    expectedFormat?: string;
  };
}

/**
 * Response message
 */
export interface A2AResponseMessage extends Omit<A2AMessage, 'content'> {
  messageType: 'response';
  content: {
    taskId?: string;
    output: unknown;
    status: A2ATaskStatus;
    error?: string;
  };
}

/**
 * Event notification message
 */
export interface A2AEventMessage extends Omit<A2AMessage, 'content'> {
  messageType: 'event';
  content: {
    eventType: string;
    data: unknown;
  };
}

// =============================================================================
// A2A Protocol Types
// =============================================================================

/**
 * A2A Client configuration
 */
export interface A2AClientConfig {
  /** This agent's instance ID */
  instanceId: string;
  /** Default timeout for requests in ms */
  defaultTimeout?: number;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };
}

/**
 * A2A Handler configuration
 */
export interface A2AHandlerConfig {
  /** This agent's instance ID */
  instanceId: string;
  /** Supported message types */
  supportedTypes: A2AMessageType[];
  /** Handler timeout in ms */
  handlerTimeout?: number;
}

// =============================================================================
// Handler Types
// =============================================================================

/**
 * Task handler function signature
 */
export interface A2ATaskHandler {
  (payload: A2APayload, context: A2AContext): Promise<A2ATaskResult>;
}

/**
 * Query handler function signature
 */
export interface A2AQueryHandler {
  (payload: A2APayload, context: A2AContext): Promise<A2AResponse>;
}

/**
 * Event handler function signature
 */
export interface A2AEventHandler {
  (payload: A2APayload, context: A2AContext): Promise<void>;
}

/**
 * Cancel handler function signature
 */
export interface A2ACancelHandler {
  (taskId: string, context: A2AContext): Promise<void>;
}

/**
 * Context passed to A2A message handlers
 */
export interface A2AContext {
  /** Message metadata */
  message: A2AMessage;
  /** Original Topology message */
  rawMessage?: TopologyMessage;
  /** Handler start time */
  startTime: number;
  /** Request metadata */
  metadata: Record<string, unknown>;
  /** Send acknowledgment for the message */
  acknowledge(): Promise<void>;
}

/**
 * Result of processing an A2A task
 */
export interface A2ATaskResult {
  /** Task ID */
  taskId: string;
  /** Task status */
  status: A2ATaskStatus;
  /** Task output */
  output?: unknown;
  /** Error message if failed */
  error?: string;
  /** Processing metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A2A Response wrapper
 */
export interface A2AResponse {
  /** Response message ID */
  messageId: string;
  /** Response content */
  content: A2APayload;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// Registry Types
// =============================================================================

/**
 * Agent Registry configuration
 */
export interface A2ARegistryConfig {
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in ms */
  cacheTtl?: number;
}

// =============================================================================
// A2A Event Types
// =============================================================================

export type A2AEventType =
  | 'agent:registered'
  | 'agent:unregistered'
  | 'message:sent'
  | 'message:received'
  | 'task:delegated'
  | 'task:completed'
  | 'task:failed'
  | 'query:received'
  | 'response:received';

export interface A2AEvent {
  id: string;
  type: A2AEventType;
  timestamp: number;
  payload: unknown;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a new A2A message ID
 */
export function createA2AMessageId(): string {
  return `a2a_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new conversation ID
 */
export function createConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create an A2A message
 */
export function createA2AMessage(
  from: string,
  to: string,
  messageType: A2AMessageType,
  content: A2APayload,
  options?: Partial<
    Pick<
      A2AMessage,
      'conversationId' | 'streaming' | 'referenceId' | 'priority'
    >
  >,
): A2AMessage {
  return {
    messageId: createA2AMessageId(),
    conversationId: options?.conversationId ?? createConversationId(),
    messageType,
    from,
    to,
    content,
    timestamp: Date.now(),
    streaming: options?.streaming,
    referenceId: options?.referenceId,
    priority: options?.priority ?? 'normal',
  };
}

/**
 * Create an A2A task message
 */
export function createA2ATaskMessage(
  from: string,
  to: string,
  taskId: string,
  description: string,
  input: Record<string, unknown>,
  options?: { priority?: 'low' | 'normal' | 'high' | 'urgent' },
): A2ATaskMessage {
  return {
    messageId: createA2AMessageId(),
    conversationId: createConversationId(),
    messageType: 'task',
    from,
    to,
    content: {
      taskId,
      description,
      input,
      priority: options?.priority ?? 'normal',
    },
    timestamp: Date.now(),
    priority: options?.priority ?? 'normal',
  };
}

/**
 * Create an A2A query message
 */
export function createA2AQueryMessage(
  from: string,
  to: string,
  query: string,
  options?: { expectedFormat?: string },
): A2AQueryMessage {
  return {
    messageId: createA2AMessageId(),
    conversationId: createConversationId(),
    messageType: 'query',
    from,
    to,
    content: {
      query,
      expectedFormat: options?.expectedFormat,
    },
    timestamp: Date.now(),
  };
}

/**
 * Create an A2A response message
 */
export function createA2AResponseMessage(
  from: string,
  to: string,
  output: unknown,
  status: A2ATaskStatus,
  options?: {
    conversationId?: string;
    referenceId?: string;
    taskId?: string;
    error?: string;
  },
): A2AResponseMessage {
  return {
    messageId: createA2AMessageId(),
    conversationId: options?.conversationId ?? createConversationId(),
    messageType: 'response',
    from,
    to,
    content: {
      output,
      status,
      taskId: options?.taskId,
      error: options?.error,
    },
    timestamp: Date.now(),
    referenceId: options?.referenceId,
  };
}

/**
 * Create an A2A event message
 */
export function createA2AEventMessage(
  from: string,
  to: string,
  eventType: string,
  data: unknown,
): A2AEventMessage {
  return {
    messageId: createA2AMessageId(),
    conversationId: createConversationId(),
    messageType: 'event',
    from,
    to,
    content: {
      eventType,
      data,
    },
    timestamp: Date.now(),
  };
}

/**
 * Create an A2A event
 */
export function createA2AEvent(type: A2AEventType, payload: unknown): A2AEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    timestamp: Date.now(),
    payload,
  };
}
