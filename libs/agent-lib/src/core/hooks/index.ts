/**
 * Hook Module - Centralized hook management for agent-lib
 *
 * This module provides a unified hook system for injecting custom behavior
 * at key lifecycle points in the agent system.
 *
 * @example
 * ```typescript
 * import { AgentContainer, onAgentCreated, onToolAfterExecute, createHookConfig } from 'agent-lib';
 *
 * const hookConfig = createHookConfig()
 *   .add(onAgentCreated(async (ctx) => {
 *     console.log(`Agent ${ctx.instanceId} created`);
 *   }))
 *   .add(onToolAfterExecute((ctx) => {
 *     console.log(`Tool ${ctx.toolName} took ${ctx.duration}ms`);
 *   }))
 *   .build();
 *
 * const container = new AgentContainer({
 *   agent: { sop: 'My SOP' },
 *   api: { apiKey: '...' },
 *   hooks: hookConfig,
 * });
 * ```
 */

export { HookModule } from './HookModule.js';
export { HookType } from './types.js';

export type {
  // Hook Contexts
  HookContext,
  HookContextBase,
  AgentCreatedContext,
  AgentStartingContext,
  AgentStartedContext,
  AgentCompletingContext,
  AgentCompletedContext,
  AgentAbortingContext,
  AgentAbortedContext,
  AgentErrorContext,
  ComponentBeforeRegisterContext,
  ComponentAfterRegisterContext,
  ComponentBeforeUnregisterContext,
  ComponentAfterUnregisterContext,
  ToolBeforeExecuteContext,
  ToolAfterExecuteContext,
  // Handler Types
  HookHandler,
  HookRegistrationOptions,
  RegisteredHook,
  HookConfig,
  HookEntry,
} from './types.js';

// Convenience hook factory functions
export {
  // Runtime hooks
  onAgentCreated,
  onAgentStarting,
  onAgentStarted,
  onAgentCompleting,
  onAgentCompleted,
  onAgentAborting,
  onAgentAborted,
  onAgentError,
  // Component hooks
  onComponentBeforeRegister,
  onComponentAfterRegister,
  onComponentBeforeUnregister,
  onComponentAfterUnregister,
  // Tool hooks
  onToolBeforeExecute,
  onToolAfterExecute,
  // Builder
  createHookConfig,
  HookConfigBuilder,
} from './factories.js';
