/**
 * Factory functions for creating hook registrations
 *
 * These provide a convenient API for registering hooks via configuration.
 *
 * @example
 * ```typescript
 * import { onAgentCreated, onToolAfterExecute, createHookConfig } from 'agent-lib';
 *
 * const hookConfig = createHookConfig()
 *   .add(onAgentCreated(async (ctx) => {
 *     console.log(`Agent ${ctx.instanceId} created`);
 *   }))
 *   .add(onToolAfterExecute((ctx) => {
 *     console.log(`Tool ${ctx.toolName} took ${ctx.duration}ms`);
 *   }))
 *   .build();
 * ```
 */

import {
  HookType,
  type HookHandler,
  type HookRegistrationOptions,
  type HookConfig,
  type HookEntry,
  type AgentCreatedContext,
  type AgentStartingContext,
  type AgentStartedContext,
  type AgentCompletingContext,
  type AgentCompletedContext,
  type AgentAbortingContext,
  type AgentAbortedContext,
  type AgentErrorContext,
  type ComponentBeforeRegisterContext,
  type ComponentAfterRegisterContext,
  type ComponentBeforeUnregisterContext,
  type ComponentAfterUnregisterContext,
  type ToolBeforeExecuteContext,
  type ToolAfterExecuteContext,
  type TaskSubmittedContext,
  type TaskReceivedContext,
  type TaskCompletedContext,
  type TaskFailedContext,
} from './types.js';

// =============================================================================
// Runtime Hook Factories
// =============================================================================

/**
 * Create a hook for agent creation
 */
export function onAgentCreated(
  handler: HookHandler<AgentCreatedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_CREATED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent starting (before start() executes)
 */
export function onAgentStarting(
  handler: HookHandler<AgentStartingContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_STARTING,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent started (after start() completes)
 */
export function onAgentStarted(
  handler: HookHandler<AgentStartedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_STARTED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent completing (before complete())
 */
export function onAgentCompleting(
  handler: HookHandler<AgentCompletingContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_COMPLETING,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent completed (after complete())
 */
export function onAgentCompleted(
  handler: HookHandler<AgentCompletedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_COMPLETED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent aborting (before abort())
 */
export function onAgentAborting(
  handler: HookHandler<AgentAbortingContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_ABORTING,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent aborted (after abort())
 */
export function onAgentAborted(
  handler: HookHandler<AgentAbortedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_ABORTED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for agent errors
 */
export function onAgentError(
  handler: HookHandler<AgentErrorContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.AGENT_ERROR,
    handler: handler as HookHandler,
    options,
  };
}

// =============================================================================
// Component Hook Factories
// =============================================================================

/**
 * Create a hook for before component registration
 */
export function onComponentBeforeRegister(
  handler: HookHandler<ComponentBeforeRegisterContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.COMPONENT_BEFORE_REGISTER,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for after component registration
 */
export function onComponentAfterRegister(
  handler: HookHandler<ComponentAfterRegisterContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.COMPONENT_AFTER_REGISTER,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for before component unregistration
 */
export function onComponentBeforeUnregister(
  handler: HookHandler<ComponentBeforeUnregisterContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.COMPONENT_BEFORE_UNREGISTER,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for after component unregistration
 */
export function onComponentAfterUnregister(
  handler: HookHandler<ComponentAfterUnregisterContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.COMPONENT_AFTER_UNREGISTER,
    handler: handler as HookHandler,
    options,
  };
}

// =============================================================================
// Tool Hook Factories
// =============================================================================

/**
 * Create a hook for before tool execution
 */
export function onToolBeforeExecute(
  handler: HookHandler<ToolBeforeExecuteContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.TOOL_BEFORE_EXECUTE,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for after tool execution
 */
export function onToolAfterExecute(
  handler: HookHandler<ToolAfterExecuteContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.TOOL_AFTER_EXECUTE,
    handler: handler as HookHandler,
    options,
  };
}

// =============================================================================
// Task Hook Factories
// =============================================================================

/**
 * Create a hook for when a task is submitted
 */
export function onTaskSubmitted(
  handler: HookHandler<TaskSubmittedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.TASK_SUBMITTED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for when a task is received
 */
export function onTaskReceived(
  handler: HookHandler<TaskReceivedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.TASK_RECEIVED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for when a task completes successfully
 */
export function onTaskCompleted(
  handler: HookHandler<TaskCompletedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.TASK_COMPLETED,
    handler: handler as HookHandler,
    options,
  };
}

/**
 * Create a hook for when a task fails
 */
export function onTaskFailed(
  handler: HookHandler<TaskFailedContext>,
  options?: HookRegistrationOptions,
): HookEntry {
  return {
    type: HookType.TASK_FAILED,
    handler: handler as HookHandler,
    options,
  };
}

// =============================================================================
// Hook Configuration Builder
// =============================================================================

/**
 * Builder for creating hook configurations
 *
 * @example
 * ```typescript
 * const hookConfig = createHookConfig()
 *   .add(onAgentCreated(async (ctx) => { ... }))
 *   .add(onToolAfterExecute((ctx) => { ... }))
 *   .setGlobalHandler((ctx) => console.log(ctx.type))
 *   .build();
 * ```
 */
export class HookConfigBuilder {
  private hooks: HookEntry[] = [];
  private enabledHooks?: HookType[];
  private disabledHooks: HookType[] = [];
  private globalHandler?: HookHandler;

  /**
   * Add a hook entry
   */
  add(
    type: HookType,
    handler: HookHandler,
    options?: HookRegistrationOptions,
  ): this {
    this.hooks.push({ type, handler, options });
    return this;
  }

  /**
   * Add a hook entry (alternative signature)
   */
  addEntry(entry: HookEntry): this {
    this.hooks.push(entry);
    return this;
  }

  /**
   * Add multiple hook entries
   */
  addAll(entries: HookEntry[]): this {
    this.hooks.push(...entries);
    return this;
  }

  /**
   * Enable only specific hook types (disables all others)
   */
  enableOnly(types: HookType[]): this {
    this.enabledHooks = types;
    return this;
  }

  /**
   * Disable specific hook types
   */
  disable(types: HookType[]): this {
    this.disabledHooks.push(...types);
    return this;
  }

  /**
   * Set a global handler that receives all events
   */
  setGlobalHandler(handler: HookHandler): this {
    this.globalHandler = handler;
    return this;
  }

  /**
   * Build the final HookConfig
   */
  build(): HookConfig {
    const config: HookConfig = { hooks: this.hooks };
    if (this.enabledHooks) config.enabledHooks = this.enabledHooks;
    if (this.disabledHooks.length > 0)
      config.disabledHooks = this.disabledHooks;
    if (this.globalHandler) config.globalHandler = this.globalHandler;
    return config;
  }
}

/**
 * Create a hook configuration builder
 */
export function createHookConfig(): HookConfigBuilder {
  return new HookConfigBuilder();
}
