/**
 * Agent Event Types — Wire-format events for real-time push
 *
 * These types define the event protocol consumed by SSE/WebSocket adapters
 * and frontend clients. Events are produced by AgentEventStream which maps
 * HookModule hook contexts to these serializable types.
 */

// =============================================================================
// Event Type Discriminator
// =============================================================================

/**
 * All event types that can be emitted by AgentEventStream.
 */
export type AgentEventType =
  | 'agent.status'
  | 'message.added'
  | 'tool.started'
  | 'tool.completed'
  | 'llm.completed'
  | 'error';

// =============================================================================
// Event Envelope
// =============================================================================

/**
 * Unified event envelope for all agent events.
 * Designed to be JSON-serializable for SSE/WebSocket transport.
 */
export interface AgentEvent<T = unknown> {
  /** Unique event ID (for deduplication) */
  id: string;
  /** Event type discriminator */
  type: AgentEventType;
  /** Agent instance that produced this event */
  instanceId: string;
  /** Epoch milliseconds timestamp */
  timestamp: number;
  /** Typed event payload */
  data: T;
}

// =============================================================================
// Event Data Payloads
// =============================================================================

export interface AgentStatusEventData {
  status: string;
  reason?: string;
}

export interface MessageAddedEventData {
  role: 'user' | 'assistant' | 'system';
  content: Array<Record<string, unknown>>;
  ts?: number;
}

export interface ToolStartedEventData {
  toolName: string;
  params: Record<string, unknown>;
  componentId?: string;
}

export interface ToolCompletedEventData {
  toolName: string;
  params: Record<string, unknown>;
  result: unknown;
  success: boolean;
  error?: string;
  duration: number;
  componentId?: string;
}

export interface LlmCompletedEventData {
  promptTokens: number;
  completionTokens: number;
}

export interface ErrorEventData {
  message: string;
  phase?: string;
}

// =============================================================================
// Typed Event Map (for type-safe dispatch)
// =============================================================================

export interface AgentEventDataMap {
  'agent.status': AgentStatusEventData;
  'message.added': MessageAddedEventData;
  'tool.started': ToolStartedEventData;
  'tool.completed': ToolCompletedEventData;
  'llm.completed': LlmCompletedEventData;
  'error': ErrorEventData;
}

/**
 * Create a typed AgentEvent for a specific event type.
 */
export function createAgentEvent<T extends AgentEventType>(
  type: T,
  instanceId: string,
  data: AgentEventDataMap[T],
): AgentEvent<AgentEventDataMap[T]> {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    instanceId,
    timestamp: Date.now(),
    data,
  };
}
