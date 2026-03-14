import { Agent } from './agent.js';
import {
    TaskStatus,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
    TaskAbortedCallback,
} from '../task/task.type.js';
import { TurnStatus, ThinkingRound, ToolCallResult, Turn } from '../memory/Turn.js';
import { ApiMessage } from '../task/task.type.js';

/**
 * Observer callbacks for ObservableAgent
 *
 * These callbacks are used to monitor agent behavior and events.
 * When provided via the DI container (AgentContainer.createAgent),
 * the agent will be automatically wrapped in an ObservableAgent proxy.
 *
 * The callbacks provide the same interface as the original Observer pattern
 * but implemented using Proxy pattern for non-invasive observation.
 */
export interface ObservableAgentCallbacks {
    // ==================== Task-level callbacks ====================

    onMessageAdded?: MessageAddedCallback;
    onStatusChanged?: TaskStatusChangedCallback;
    onTaskCompleted?: TaskCompletedCallback;
    onTaskAborted?: TaskAbortedCallback;
    onMethodCall?: (methodName: string, args: any[]) => void;
    onPropertyChange?: (propertyName: string, newValue: any, oldValue: any) => void;
    onError?: (error: Error, context: string) => void;

    // ==================== Turn-level callbacks ====================
    // These callbacks monitor the turn-based memory system

    /**
     * Called when a new turn is created
     * @param turnId - The unique ID of the created turn
     * @param turnNumber - The sequential turn number
     * @param workspaceContext - The workspace context snapshot
     * @param taskContext - Optional task context (user's goal)
     */
    onTurnCreated?: (turnId: string, turnNumber: number, workspaceContext: string, taskContext?: string) => void;

    /**
     * Called when a turn's status changes
     * @param turnId - The turn ID
     * @param status - The new status
     */
    onTurnStatusChanged?: (turnId: string, status: TurnStatus) => void;

    /**
     * Called when a message is added to a turn
     * @param turnId - The turn ID
     * @param message - The message that was added
     */
    onTurnMessageAdded?: (turnId: string, message: ApiMessage) => void;

    /**
     * Called when the thinking phase completes for a turn
     * @param turnId - The turn ID
     * @param rounds - The thinking rounds performed
     * @param tokensUsed - Total tokens used in thinking phase
     */
    onThinkingPhaseCompleted?: (turnId: string, rounds: ThinkingRound[], tokensUsed: number) => void;

    /**
     * Called when a tool call result is recorded
     * @param turnId - The turn ID
     * @param toolName - Name of the tool that was called
     * @param success - Whether the tool call succeeded
     * @param result - The result of the tool call
     */
    onToolCallRecorded?: (turnId: string, toolName: string, success: boolean, result: any) => void;

    /**
     * Called when a summary is stored for a turn
     * @param turnId - The turn ID
     * @param summary - The generated summary
     * @param insights - Extracted insights
     */
    onTurnSummaryStored?: (turnId: string, summary: string, insights: string[]) => void;

    /**
     * Called when action phase token usage is updated
     * @param turnId - The turn ID
     * @param tokens - Number of tokens used in action phase
     */
    onTurnActionTokensUpdated?: (turnId: string, tokens: number) => void;
}

/**
 * Creates an observable Agent using Proxy pattern
 *
 * This implementation intercepts property access and method calls
 * without requiring any modifications to the original Agent class.
 *
 * **Note:** With the new DI-based architecture, you typically don't need to
 * call this function directly. Instead, pass observer callbacks to the
 * AgentContainer.createAgent() method, which will automatically wrap
 * the agent when observers are provided.
 *
 * @param agent - The original Agent instance to wrap
 * @param callbacks - Observer callbacks to register
 * @returns A proxied Agent instance that automatically notifies observers
 *
 * @example Direct usage (manual wrapping)
 * ```typescript
 * import { createObservableAgent } from './ObservableAgent.js';
 *
 * const agent = createObservableAgent(baseAgent, {
 *     onStatusChanged: (taskId, status) => {
 *         console.log(`Status changed to: ${status}`);
 *     },
 *     onMessageAdded: (taskId, message) => {
 *         console.log('New message:', message);
 *     }
 * });
 *
 * // Normal usage - notifications happen automatically
 * await agent.start("Write code");
 * ```
 *
 * @example Recommended usage (via DI container)
 * ```typescript
 * import { getGlobalContainer } from './di/index.js';
 *
 * const container = getGlobalContainer();
 * const agent = container.createAgent({
 *     agentPrompt: { capability: 'Test', direction: 'Test' },
 *     observers: {
 *         onStatusChanged: (taskId, status) => console.log(`Status: ${status}`),
 *         onMessageAdded: (taskId, message) => console.log('New message:', message)
 *     }
 * });
 * // Agent is automatically wrapped - no manual createObservableAgent call needed
 * ```
 */
export function createObservableAgent<T extends Agent>(
    agent: T,
    callbacks: ObservableAgentCallbacks
): T {
    // Track status changes to detect transitions
    let lastStatus: TaskStatus = agent.status;
    let isCompleted = false;
    let isAborted = false;
    let abortReason: string | undefined;

    return new Proxy(agent, {
        /**
         * Intercept property access
         * - Wraps functions to observe method calls
         * - Returns other properties as-is
         */
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);

            // Special handling for memoryModule to observe message additions
            // This is needed because the new architecture uses MemoryModule instead of
            // direct array manipulation for conversation history
            //
            // Note: Turn-level observation is now handled at the DI container level
            // via ObservableTurnMemoryStore. The turnStore injected into MemoryModule
            // is already wrapped if turn-level callbacks are provided.
            if (prop === 'memoryModule' && value && typeof value === 'object') {
                return new Proxy(value, {
                    get(moduleTarget, moduleProp, moduleReceiver) {
                        const moduleValue = Reflect.get(moduleTarget, moduleProp, moduleReceiver);

                        // Wrap message addition methods to notify observers
                        if (typeof moduleValue === 'function' && String(moduleProp) === 'addMessage') {

                            return new Proxy(moduleValue, {
                                apply(fnTarget, thisArg, args) {
                                    // Execute the original method
                                    // The method now returns the added message
                                    const addedMessage = Reflect.apply(fnTarget, thisArg, args);

                                    // Notify observers about message additions
                                    // Use the returned message directly instead of calling getAllMessages
                                    const taskId = target.getTaskId;
                                    callbacks.onMessageAdded?.(taskId, addedMessage);

                                    return addedMessage;
                                }
                            });

                        }

                        return moduleValue;
                    }
                });
            }

            // If the property is a function, wrap it to observe calls
            if (typeof value === 'function') {
                return new Proxy(value, {
                    apply(fnTarget, thisArg, args) {
                        const methodName = String(prop);

                        try {
                            // Special handling for abort method to capture reason
                            if (methodName === 'abort' && args.length > 0) {
                                abortReason = args[0] as string;
                            }

                            // Notify method call (optional, for debugging)
                            callbacks.onMethodCall?.(methodName, args);

                            // Execute the original method with receiver as thisArg
                            // This ensures internal property accesses go through the proxy
                            const result = Reflect.apply(fnTarget, receiver, args);

                            // Handle Promise results (async methods)
                            if (result instanceof Promise) {
                                return result
                                    .then((promiseResult) => {
                                        // Check for status changes after async completion
                                        checkAndNotifyStatus(target, callbacks);
                                        return promiseResult;
                                    })
                                    .catch((error) => {
                                        // Notify error observers
                                        callbacks.onError?.(error, `Method: ${methodName}`);
                                        throw error;
                                    });
                            }

                            // Check for status changes after sync method completion
                            checkAndNotifyStatus(target, callbacks);

                            return result;
                        } catch (error) {
                            // Notify error observers for sync errors
                            callbacks.onError?.(error as Error, `Method: ${methodName}`);
                            throw error;
                        }
                    },
                });
            }

            return value;
        },

        /**
         * Intercept property assignment
         * - Detects status changes
         * - Notifies observers of property changes
         */
        set(target, prop, value, receiver) {
            const propName = String(prop);
            const currentValue = Reflect.get(target, prop, receiver);

            // Special handling for _status property
            if (propName === '_status' && currentValue !== value) {
                const newStatus = value as TaskStatus;
                const taskId = target.getTaskId;

                // Update tracking variables
                lastStatus = newStatus;
                isCompleted = newStatus === 'completed';
                isAborted = newStatus === 'aborted';

                // Set the value first
                const result = Reflect.set(target, prop, value, receiver);

                // Then notify observers (they can access the new value)
                callbacks.onStatusChanged?.(taskId, newStatus);

                // Auto-notify task completion/abortion based on status
                if (isCompleted) {
                    callbacks.onTaskCompleted?.(taskId);
                } else if (isAborted) {
                    callbacks.onTaskAborted?.(taskId, abortReason || 'Task aborted');
                }

                return result;
            }

            // Generic property change notification
            if (currentValue !== value) {
                const result = Reflect.set(target, prop, value, receiver);
                callbacks.onPropertyChange?.(propName, value, currentValue);
                return result;
            }

            return Reflect.set(target, prop, value, receiver);
        },

        /**
         * Intercept property deletion
         */
        deleteProperty(target, prop) {
            const currentValue = Reflect.get(target, prop);
            const result = Reflect.deleteProperty(target, prop);

            if (result) {
                callbacks.onPropertyChange?.(String(prop), undefined, currentValue);
            }

            return result;
        },
    });
}

/**
 * Helper function to check and notify status changes
 * Called after method execution to detect status transitions
 */
function checkAndNotifyStatus(
    agent: Agent,
    callbacks: ObservableAgentCallbacks
): void {
    const currentStatus = agent.status;
    const taskId = agent.getTaskId;

    // Check for task completion
    if (currentStatus === 'completed') {
        callbacks.onTaskCompleted?.(taskId);
    }

    // Check for task abortion
    if (currentStatus === 'aborted') {
        callbacks.onTaskAborted?.(taskId, 'Task aborted');
    }
}

/**
 * Factory class for creating observable Agents
 * Provides a fluent API for registering callbacks
 *
 * **Note:** With the new DI-based architecture, using the DI container
 * directly is recommended over this factory class. The container handles
 * observer wrapping automatically when callbacks are provided.
 *
 * This factory is still available for backward compatibility and for
 * scenarios where you need to manually wrap an existing agent instance.
 *
 * @example Using the factory (legacy approach)
 * ```typescript
 * import { ObservableAgentFactory } from './ObservableAgent.js';
 *
 * const agent = new ObservableAgentFactory()
 *     .onStatusChanged((taskId, status) => console.log(status))
 *     .onMessageAdded((taskId, msg) => console.log(msg))
 *     .onError((err, ctx) => console.error(err, ctx))
 *     .create(existingAgent);
 * ```
 *
 * @example Recommended approach (via DI container)
 * ```typescript
 * import { getGlobalContainer } from './di/index.js';
 *
 * const container = getGlobalContainer();
 * const agent = container.createAgent({
 *     agentPrompt: { capability: 'Test', direction: 'Test' },
 *     observers: {
 *         onStatusChanged: (taskId, status) => console.log(status),
 *         onMessageAdded: (taskId, msg) => console.log(msg),
 *         onError: (err, ctx) => console.error(err, ctx)
 *     }
 * });
 * ```
 */
export class ObservableAgentFactory {
    private callbacks: ObservableAgentCallbacks = {};

    /**
     * Register message added callback
     */
    onMessageAdded(callback: MessageAddedCallback): this {
        this.callbacks.onMessageAdded = callback;
        return this;
    }

    /**
     * Register status changed callback
     */
    onStatusChanged(callback: TaskStatusChangedCallback): this {
        this.callbacks.onStatusChanged = callback;
        return this;
    }

    /**
     * Register task completed callback
     */
    onTaskCompleted(callback: TaskCompletedCallback): this {
        this.callbacks.onTaskCompleted = callback;
        return this;
    }

    /**
     * Register task aborted callback
     */
    onTaskAborted(callback: TaskAbortedCallback): this {
        this.callbacks.onTaskAborted = callback;
        return this;
    }

    /**
     * Register method call callback (for debugging)
     */
    onMethodCall(callback: (methodName: string, args: any[]) => void): this {
        this.callbacks.onMethodCall = callback;
        return this;
    }

    /**
     * Register property change callback
     */
    onPropertyChange(
        callback: (propertyName: string, newValue: any, oldValue: any) => void
    ): this {
        this.callbacks.onPropertyChange = callback;
        return this;
    }

    /**
     * Register error callback
     */
    onError(callback: (error: Error, context: string) => void): this {
        this.callbacks.onError = callback;
        return this;
    }

    /**
     * Create the observable Agent with registered callbacks
     */
    create<T extends Agent>(agent: T): T {
        return createObservableAgent(agent, this.callbacks);
    }
}

/**
 * Utility function to create an observable Agent with a subset of callbacks
 * Useful when you only need to observe specific events
 *
 * **Note:** With the new DI-based architecture, you typically don't need to
 * call this function directly. Pass observer callbacks to the DI container instead.
 *
 * This function is still available for:
 * - Manually wrapping existing agent instances
 * - Backward compatibility with existing code
 * - Scenarios where you have an agent but didn't use the DI container
 *
 * @example Direct usage (manual wrapping)
 * ```typescript
 * import { observeAgent } from './ObservableAgent.js';
 *
 * const agent = observeAgent(existingAgent, {
 *     onStatusChanged: (taskId, status) => {
 *         console.log(`Agent ${taskId} is now ${status}`);
 *     }
 * });
 * ```
 *
 * @example Recommended approach (via DI container)
 * ```typescript
 * import { getGlobalContainer } from './di/index.js';
 *
 * const container = getGlobalContainer();
 * const agent = container.createAgent({
 *     agentPrompt: { capability: 'Test', direction: 'Test' },
 *     observers: {
 *         onStatusChanged: (taskId, status) => {
 *             console.log(`Agent ${taskId} is now ${status}`);
 *         }
 *     }
 * });
 * ```
 */
export function observeAgent<T extends Agent>(
    agent: T,
    callbacks: ObservableAgentCallbacks
): T {
    return createObservableAgent(agent, callbacks);
}
