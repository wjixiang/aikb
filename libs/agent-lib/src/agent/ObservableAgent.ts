import { Agent } from './agent';
import {
    ApiMessage,
    TaskStatus,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
    TaskAbortedCallback,
} from '../task/task.type';

/**
 * Observer callbacks for ObservableAgent
 * Provides the same interface as the original Observer pattern
 * but implemented using Proxy pattern
 */
export interface ObservableAgentCallbacks {
    onMessageAdded?: MessageAddedCallback;
    onStatusChanged?: TaskStatusChangedCallback;
    onTaskCompleted?: TaskCompletedCallback;
    onTaskAborted?: TaskAbortedCallback;
    onMethodCall?: (methodName: string, args: any[]) => void;
    onPropertyChange?: (propertyName: string, newValue: any, oldValue: any) => void;
    onError?: (error: Error, context: string) => void;
}

/**
 * Creates an observable Agent using Proxy pattern
 * 
 * This implementation intercepts property access and method calls
 * without requiring any modifications to the original Agent class.
 * 
 * @param agent - The original Agent instance to wrap
 * @param callbacks - Observer callbacks to register
 * @returns A proxied Agent instance that automatically notifies observers
 * 
 * @example
 * ```typescript
 * const agent = createObservableAgent(
 *     new Agent(config, apiConfig, workspace),
 *     {
 *         onStatusChanged: (taskId, status) => {
 *             console.log(`Status changed to: ${status}`);
 *         },
 *         onMessageAdded: (taskId, message) => {
 *             console.log('New message:', message);
 *         }
 *     }
 * );
 * 
 * // Normal usage - notifications happen automatically
 * await agent.start("Write code");
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

                            // Execute the original method
                            const result = Reflect.apply(fnTarget, thisArg, args);

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
 * @example
 * ```typescript
 * const agent = new ObservableAgentFactory()
 *     .onStatusChanged((taskId, status) => console.log(status))
 *     .onMessageAdded((taskId, msg) => console.log(msg))
 *     .onError((err, ctx) => console.error(err, ctx))
 *     .create(new Agent(config, apiConfig, workspace));
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
 * @example
 * ```typescript
 * const agent = observeAgent(new Agent(config, apiConfig, workspace), {
 *     onStatusChanged: (taskId, status) => {
 *         console.log(`Agent ${taskId} is now ${status}`);
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
