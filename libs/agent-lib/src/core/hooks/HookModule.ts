/**
 * HookModule - Centralized hook management for Agent lifecycle events
 *
 * Provides a unified hook system for:
 * - Runtime hooks (agent lifecycle)
 * - Component hooks (registration lifecycle)
 * - Tool hooks (execution lifecycle)
 *
 * @example
 * ```typescript
 * const hookModule = container.get<HookModule>(TYPES.HookModule);
 *
 * // Register a hook with fluent API
 * hookModule
 *   .on('agent:created', async (ctx) => {
 *     console.log(`Agent ${ctx.instanceId} created`);
 *   }, { priority: 10 })
 *   .on('tool:afterExecute', (ctx) => {
 *     console.log(`Tool ${ctx.toolName} executed in ${ctx.duration}ms`);
 *   });
 *
 * // Trigger hooks
 * await hookModule.executeHooks('agent:created', context);
 * ```
 */

import { injectable, inject, optional } from 'inversify';
import { TYPES } from '../di/types.js';
import type { Logger } from 'pino';
import type {
  HookType,
  HookContext,
  HookHandler,
  HookRegistrationOptions,
  RegisteredHook,
  HookConfig,
} from './types.js';

/**
 * HookModule - Manages all hooks for an agent container
 */
@injectable()
export class HookModule {
  private hooks: Map<HookType, RegisteredHook[]> = new Map();
  private logger: Logger;
  private enabledHooks: Set<HookType> | null = null;
  private disabledHooks: Set<HookType> = new Set();
  private globalHandler?: HookHandler;
  private hookIdCounter = 0;

  constructor(
    @inject(TYPES.Logger) logger: Logger,
    @inject(TYPES.HookConfig)
    @optional()
    config?: HookConfig,
  ) {
    this.logger = logger.child({ module: 'HookModule' });

    if (config) {
      this.applyConfig(config);
    }
  }

  /**
   * Apply hook configuration
   */
  private applyConfig(config: HookConfig): void {
    // Set enabled/disabled hooks
    if (config.enabledHooks) {
      this.enabledHooks = new Set(config.enabledHooks);
    }
    if (config.disabledHooks) {
      this.disabledHooks = new Set(config.disabledHooks);
    }

    // Set global handler
    if (config.globalHandler) {
      this.globalHandler = config.globalHandler;
    }

    // Register configured hooks
    if (config.hooks) {
      for (const { type, handler, options } of config.hooks) {
        this.on(type, handler, options);
      }
    }
  }

  /**
   * Register a hook handler
   *
   * @param type - Hook type to listen for
   * @param handler - Function to call when hook is triggered
   * @param options - Registration options (id, priority, parallel)
   * @returns this (for chaining)
   */
  on<T extends HookType>(
    type: T,
    handler: HookHandler<Extract<HookContext, { type: T }>>,
    options: HookRegistrationOptions = {},
  ): this {
    // Check if hook type is enabled
    if (!this.isHookEnabled(type)) {
      this.logger.warn(
        { type },
        `Hook type ${type} is disabled, skipping registration`,
      );
      return this;
    }

    const id = options.id ?? `hook_${++this.hookIdCounter}`;
    const priority = options.priority ?? 100;
    const parallel = options.parallel ?? false;

    const registered: RegisteredHook = {
      id,
      type,
      handler: handler as HookHandler,
      priority,
      parallel,
    };

    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }

    const hooks = this.hooks.get(type)!;
    hooks.push(registered);

    // Sort by priority (lower = earlier)
    hooks.sort((a, b) => a.priority - b.priority);

    this.logger.debug({ type, id, priority }, `Hook registered: ${type}`);
    return this;
  }

  /**
   * Remove a hook by ID
   *
   * @param type - Hook type
   * @param id - Hook ID to remove
   * @returns true if hook was found and removed
   */
  off(type: HookType, id: string): boolean {
    const hooks = this.hooks.get(type);
    if (!hooks) return false;

    const index = hooks.findIndex((h) => h.id === id);
    if (index === -1) return false;

    hooks.splice(index, 1);
    this.logger.debug({ type, id }, `Hook removed: ${type}/${id}`);
    return true;
  }

  /**
   * Remove all hooks of a specific type
   *
   * @param type - Hook type to clear
   */
  clearType(type: HookType): void {
    this.hooks.delete(type);
    this.logger.debug({ type }, `All hooks cleared for type: ${type}`);
  }

  /**
   * Remove all hooks
   */
  clearAll(): void {
    this.hooks.clear();
    this.logger.debug('All hooks cleared');
  }

  /**
   * Check if a hook type is enabled
   */
  private isHookEnabled(type: HookType): boolean {
    if (this.disabledHooks.has(type)) return false;
    if (this.enabledHooks && !this.enabledHooks.has(type)) return false;
    return true;
  }

  /**
   * Execute all hooks of a specific type
   *
   * @param type - Hook type to execute
   * @param context - Context to pass to handlers
   */
  async executeHooks<T extends HookType>(
    type: T,
    context: Extract<HookContext, { type: T }>,
  ): Promise<void> {
    if (!this.isHookEnabled(type)) {
      return;
    }

    const hooks = this.hooks.get(type);

    // Still call global handler if set, even if no specific hooks
    if (!hooks || hooks.length === 0) {
      if (this.globalHandler) {
        await this.executeHandler(this.globalHandler, context, 'global');
      }
      return;
    }

    // Separate parallel and sequential hooks
    const sequentialHooks = hooks.filter((h) => !h.parallel);
    const parallelHooks = hooks.filter((h) => h.parallel);

    // Execute sequential hooks first (in priority order)
    for (const hook of sequentialHooks) {
      await this.executeHandler(hook.handler, context, hook.id);
    }

    // Execute parallel hooks together
    if (parallelHooks.length > 0) {
      await Promise.all(
        parallelHooks.map((hook) =>
          this.executeHandler(hook.handler, context, hook.id),
        ),
      );
    }

    // Call global handler if set
    if (this.globalHandler) {
      await this.executeHandler(this.globalHandler, context, 'global');
    }
  }

  /**
   * Execute a single handler with error handling
   */
  private async executeHandler(
    handler: HookHandler,
    context: HookContext,
    hookId: string,
  ): Promise<void> {
    try {
      await handler(context);
    } catch (error) {
      this.logger.error(
        {
          hookId,
          type: context.type,
          error: error instanceof Error ? error.message : String(error),
        },
        `Hook handler error: ${hookId}`,
      );
      // Don't rethrow - hooks should not break execution
    }
  }

  /**
   * Get registered hooks for a type (for debugging)
   */
  getHooks(type: HookType): RegisteredHook[] {
    return [...(this.hooks.get(type) ?? [])];
  }

  /**
   * Get all registered hooks (for debugging)
   */
  getAllHooks(): Map<HookType, RegisteredHook[]> {
    return new Map(this.hooks);
  }

  /**
   * Get hook count for a type
   */
  getHookCount(type?: HookType): number {
    if (type) {
      return this.hooks.get(type)?.length ?? 0;
    }
    let total = 0;
    for (const hooks of this.hooks.values()) {
      total += hooks.length;
    }
    return total;
  }

  /**
   * Check if there are any hooks registered for a type
   */
  hasHooks(type: HookType): boolean {
    const hooks = this.hooks.get(type);
    return hooks !== undefined && hooks.length > 0;
  }
}
