/**
 * Hook Types for Agent Lifecycle Events
 *
 * This module provides type definitions for the centralized hook system.
 * Hooks allow injecting custom behavior at key lifecycle points.
 */

import type { ToolComponent } from '../../components/core/toolComponent.js';
import type { Tool } from '../../components/core/types.js';
import type { Message } from '../memory/types.js';

// =============================================================================
// Hook Categories (Enum)
// =============================================================================

/**
 * Hook types enum - Agent lifecycle events
 */
export enum HookType {
  AGENT_CREATED = 'agent:created',
  AGENT_STARTING = 'agent:starting',
  AGENT_STARTED = 'agent:started',
  AGENT_COMPLETING = 'agent:completing',
  AGENT_COMPLETED = 'agent:completed',
  AGENT_ABORTING = 'agent:aborting',
  AGENT_ABORTED = 'agent:aborted',
  AGENT_ERROR = 'agent:error',
  AGENT_SLEEPING = 'agent:sleeping',
  AGENT_WOKEN = 'agent:woken',
  COMPONENT_BEFORE_REGISTER = 'component:beforeRegister',
  COMPONENT_AFTER_REGISTER = 'component:afterRegister',
  COMPONENT_BEFORE_UNREGISTER = 'component:beforeUnregister',
  COMPONENT_AFTER_UNREGISTER = 'component:afterUnregister',
  TOOL_BEFORE_EXECUTE = 'tool:beforeExecute',
  TOOL_AFTER_EXECUTE = 'tool:afterExecute',
  MESSAGE_ADDED = 'message:added',
  LLM_CALL_COMPLETED = 'llm:callCompleted',
}

// =============================================================================
// Hook Contexts (Payloads)
// =============================================================================

/**
 * Base hook context
 */
export interface HookContextBase {
  /** Timestamp when hook was triggered */
  timestamp: Date;
  /** Agent instance ID */
  instanceId: string;
}

/**
 * Agent created context
 */
export interface AgentCreatedContext extends HookContextBase {
  type: HookType.AGENT_CREATED;
  /** Agent name if configured */
  name?: string;
  /** Agent type if configured */
  agentType?: string;
}

/**
 * Agent starting context
 */
export interface AgentStartingContext extends HookContextBase {
  type: HookType.AGENT_STARTING;
  /** Initial message/task */
  initialMessage?: string;
}

/**
 * Agent started context
 */
export interface AgentStartedContext extends HookContextBase {
  type: HookType.AGENT_STARTED;
  /** Initial message/task */
  initialMessage?: string;
}

/**
 * Agent completing context
 */
export interface AgentCompletingContext extends HookContextBase {
  type: HookType.AGENT_COMPLETING;
}

/**
 * Agent completed context
 */
export interface AgentCompletedContext extends HookContextBase {
  type: HookType.AGENT_COMPLETED;
}

/**
 * Agent aborting context
 */
export interface AgentAbortingContext extends HookContextBase {
  type: HookType.AGENT_ABORTING;
  /** Abort reason */
  reason: string;
  /** Abort source */
  source: string;
}

/**
 * Agent aborted context
 */
export interface AgentAbortedContext extends HookContextBase {
  type: HookType.AGENT_ABORTED;
  /** Abort reason */
  reason: string;
  /** Abort source */
  source: string;
}

/**
 * Agent error context
 */
export interface AgentErrorContext extends HookContextBase {
  type: HookType.AGENT_ERROR;
  /** The error that occurred */
  error: Error;
  /** Phase where error occurred */
  phase: string;
}

/**
 * Agent sleeping context
 */
export interface AgentSleepingContext extends HookContextBase {
  type: HookType.AGENT_SLEEPING;
  /** Reason for sleeping */
  reason: string;
}

/**
 * Agent woken context
 */
export interface AgentWokenContext extends HookContextBase {
  type: HookType.AGENT_WOKEN;
  /** Wake-up data (e.g., A2A result) */
  data?: unknown;
}

/**
 * Component before register context
 */
export interface ComponentBeforeRegisterContext extends HookContextBase {
  type: HookType.COMPONENT_BEFORE_REGISTER;
  /** Component ID */
  componentId: string;
  /** Component instance */
  component: ToolComponent;
  /** Registration priority */
  priority?: number;
}

/**
 * Component after register context
 */
export interface ComponentAfterRegisterContext extends HookContextBase {
  type: HookType.COMPONENT_AFTER_REGISTER;
  /** Component ID */
  componentId: string;
  /** Component instance */
  component: ToolComponent;
  /** Registration priority */
  priority?: number;
  /** Tools provided by this component */
  tools: Tool[];
}

/**
 * Component before unregister context
 */
export interface ComponentBeforeUnregisterContext extends HookContextBase {
  type: HookType.COMPONENT_BEFORE_UNREGISTER;
  /** Component ID */
  componentId: string;
  /** Component instance */
  component: ToolComponent;
}

/**
 * Component after unregister context
 */
export interface ComponentAfterUnregisterContext extends HookContextBase {
  type: HookType.COMPONENT_AFTER_UNREGISTER;
  /** Component ID */
  componentId: string;
}

/**
 * Tool before execute context
 */
export interface ToolBeforeExecuteContext extends HookContextBase {
  type: HookType.TOOL_BEFORE_EXECUTE;
  /** Tool name */
  toolName: string;
  /** Tool parameters */
  params: Record<string, unknown>;
  /** Component ID if applicable */
  componentId?: string;
}

/**
 * Tool after execute context
 */
export interface ToolAfterExecuteContext extends HookContextBase {
  type: HookType.TOOL_AFTER_EXECUTE;
  /** Tool name */
  toolName: string;
  /** Tool parameters */
  params: Record<string, unknown>;
  /** Execution result */
  result: unknown;
  /** Whether execution succeeded */
  success: boolean;
  /** Error if execution failed */
  error?: Error;
  /** Component ID if applicable */
  componentId?: string;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Message added context — fired when any message is added to agent memory
 */
export interface MessageAddedContext extends HookContextBase {
  type: HookType.MESSAGE_ADDED;
  /** The message that was added */
  message: Message;
}

/**
 * LLM call completed context — fired after a full LLM API call returns
 */
export interface LlmCallCompletedContext extends HookContextBase {
  type: HookType.LLM_CALL_COMPLETED;
  /** Token usage from the LLM response */
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Union type of all hook contexts
 */
export type HookContext =
  | AgentCreatedContext
  | AgentStartingContext
  | AgentStartedContext
  | AgentCompletingContext
  | AgentCompletedContext
  | AgentAbortingContext
  | AgentAbortedContext
  | AgentErrorContext
  | AgentSleepingContext
  | AgentWokenContext
  | ComponentBeforeRegisterContext
  | ComponentAfterRegisterContext
  | ComponentBeforeUnregisterContext
  | ComponentAfterUnregisterContext
  | ToolBeforeExecuteContext
  | ToolAfterExecuteContext
  | MessageAddedContext
  | LlmCallCompletedContext;
// =============================================================================
// Hook Handler Types
// =============================================================================

/**
 * Hook handler function
 */
export type HookHandler<T extends HookContext = HookContext> = (
  context: T,
) => void | Promise<void>;

/**
 * Hook registration options
 */
export interface HookRegistrationOptions {
  /** Unique identifier for this hook (for removal) */
  id?: string;
  /** Priority (lower = earlier execution, default: 100) */
  priority?: number;
  /** Whether to execute hooks in parallel (default: false - sequential) */
  parallel?: boolean;
}

/**
 * Registered hook entry
 */
export interface RegisteredHook {
  /** Unique identifier */
  id: string;
  /** Hook type */
  type: HookType;
  /** Handler function */
  handler: HookHandler;
  /** Priority (lower = earlier) */
  priority: number;
  /** Execute in parallel with other hooks of same type */
  parallel: boolean;
}

// =============================================================================
// Hook Module Configuration
// =============================================================================

/**
 * Hook entry for configuration
 */
export interface HookEntry {
  /** Hook type */
  type: HookType;
  /** Handler function */
  handler: HookHandler;
  /** Registration options */
  options?: HookRegistrationOptions;
}

/**
 * Hook configuration for AgentCreationOptions
 */
export interface HookConfig {
  /** Hooks to register at container creation */
  hooks?: HookEntry[];
  /** Enable only specific hook types (if set, others are disabled) */
  enabledHooks?: HookType[];
  /** Disable specific hook types */
  disabledHooks?: HookType[];
  /** Global hook that receives all events */
  globalHandler?: HookHandler;
}
