/**
 * Agent Events Module — Unified real-time event push
 *
 * Provides a typed event stream that bridges HookModule hooks
 * to external consumers (SSE, WebSocket, internal subscribers).
 */

export type {
  AgentEventType,
  AgentEvent,
  AgentEventDataMap,
  AgentStatusEventData,
  MessageAddedEventData,
  ToolStartedEventData,
  ToolCompletedEventData,
  LlmCompletedEventData,
  ErrorEventData,
} from './types.js';

export { createAgentEvent } from './types.js';

export type { IAgentEventStream } from './AgentEventStream.js';
export {
  AgentEventStream,
  createAgentEventStream,
} from './AgentEventStream.js';
