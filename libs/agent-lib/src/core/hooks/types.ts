/**
 * Hook Types for Agent Lifecycle Events
 *
 * This module provides type definitions for the centralized hook system.
 * Hooks allow injecting custom behavior at key lifecycle points.
 */

import type { ToolComponent } from '../../components/core/toolComponent.js';
import type { Tool } from '../../components/core/types.js';
import type { RuntimeTask, RuntimeTaskResult } from '../../components/runtime-task/types.js';

// =============================================================================
// Hook Categories
// =============================================================================

/**
 * Runtime hook types - Agent lifecycle events
 */
export type RuntimeHookType =
  | 'agent:created' // After AgentContainer is created
  | 'agent:starting' // Before agent.start() is called
  | 'agent:started' // After agent.start() completes
  | 'agent:completing' // Before agent.complete() is called
  | 'agent:completed' // After agent.complete() is called
  | 'agent:aborting' // Before agent.abort() is called
  | 'agent:aborted' // After agent.abort() is called
  | 'agent:error'; // When an error occurs

/**
 * Component hook types - Registration lifecycle
 */
export type ComponentHookType =
  | 'component:beforeRegister' // Before component is registered
  | 'component:afterRegister' // After component is registered
  | 'component:beforeUnregister' // Before component is unregistered
  | 'component:afterUnregister'; // After component is unregistered

/**
 * Tool hook types - Tool execution lifecycle
 */
export type ToolHookType =
  | 'tool:beforeExecute' // Before tool is executed
  | 'tool:afterExecute'; // After tool is executed (success or failure)

/**
 * Task hook types - RuntimeTask lifecycle
 */
export type TaskHookType =
  | 'task:submitted' // When a new task is submitted
  | 'task:received' // When component receives a task
  | 'task:completed' // When task processing completes
  | 'task:failed'; // When task processing fails

/**
 * All hook types
 */
export type HookType =
  | RuntimeHookType
  | ComponentHookType
  | ToolHookType
  | TaskHookType;

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
  type: 'agent:created';
  /** Agent name if configured */
  name?: string;
  /** Agent type if configured */
  agentType?: string;
}

/**
 * Agent starting context
 */
export interface AgentStartingContext extends HookContextBase {
  type: 'agent:starting';
  /** Initial message/task */
  initialMessage?: string;
}

/**
 * Agent started context
 */
export interface AgentStartedContext extends HookContextBase {
  type: 'agent:started';
  /** Initial message/task */
  initialMessage?: string;
}

/**
 * Agent completing context
 */
export interface AgentCompletingContext extends HookContextBase {
  type: 'agent:completing';
}

/**
 * Agent completed context
 */
export interface AgentCompletedContext extends HookContextBase {
  type: 'agent:completed';
}

/**
 * Agent aborting context
 */
export interface AgentAbortingContext extends HookContextBase {
  type: 'agent:aborting';
  /** Abort reason */
  reason: string;
  /** Abort source */
  source: string;
}

/**
 * Agent aborted context
 */
export interface AgentAbortedContext extends HookContextBase {
  type: 'agent:aborted';
  /** Abort reason */
  reason: string;
  /** Abort source */
  source: string;
}

/**
 * Agent error context
 */
export interface AgentErrorContext extends HookContextBase {
  type: 'agent:error';
  /** The error that occurred */
  error: Error;
  /** Phase where error occurred */
  phase: string;
}

/**
 * Component before register context
 */
export interface ComponentBeforeRegisterContext extends HookContextBase {
  type: 'component:beforeRegister';
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
  type: 'component:afterRegister';
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
  type: 'component:beforeUnregister';
  /** Component ID */
  componentId: string;
  /** Component instance */
  component: ToolComponent;
}

/**
 * Component after unregister context
 */
export interface ComponentAfterUnregisterContext extends HookContextBase {
  type: 'component:afterUnregister';
  /** Component ID */
  componentId: string;
}

/**
 * Tool before execute context
 */
export interface ToolBeforeExecuteContext extends HookContextBase {
  type: 'tool:beforeExecute';
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
  type: 'tool:afterExecute';
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

// =============================================================================
// Task Hook Contexts
// =============================================================================

/**
 * Task submitted context
 */
export interface TaskSubmittedContext extends HookContextBase {
  type: 'task:submitted';
  /** Task ID */
  taskId: string;
  /** The submitted task */
  task: RuntimeTask;
  /** Source of the task (e.g., 'mail', 'api', 'runtime') */
  source?: string;
}

/**
 * Task received context
 */
export interface TaskReceivedContext extends HookContextBase {
  type: 'task:received';
  /** Task ID */
  taskId: string;
  /** The received task */
  task: RuntimeTask;
}

/**
 * Task completed context
 */
export interface TaskCompletedContext extends HookContextBase {
  type: 'task:completed';
  /** Task ID */
  taskId: string;
  /** Task result */
  result: RuntimeTaskResult;
}

/**
 * Task failed context
 */
export interface TaskFailedContext extends HookContextBase {
  type: 'task:failed';
  /** Task ID */
  taskId: string;
  /** The original task */
  task: RuntimeTask;
  /** Error that caused failure */
  error: Error;
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
  | ComponentBeforeRegisterContext
  | ComponentAfterRegisterContext
  | ComponentBeforeUnregisterContext
  | ComponentAfterUnregisterContext
  | ToolBeforeExecuteContext
  | ToolAfterExecuteContext
  | TaskSubmittedContext
  | TaskReceivedContext
  | TaskCompletedContext
  | TaskFailedContext;

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
