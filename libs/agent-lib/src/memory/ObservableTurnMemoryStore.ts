/**
 * ObservableTurnMemoryStore - A wrapper around TurnMemoryStore that provides observation callbacks
 * 
 * This class wraps TurnMemoryStore and notifies observers of turn-level events.
 * It's designed to be used with the DI container - when observer callbacks are provided,
 * the container will inject this observable wrapper instead of the base TurnMemoryStore.
 * 
 * @example
 * ```typescript
 * import { createObservableTurnMemoryStore } from './memory/ObservableTurnMemoryStore.js';
 * 
 * const baseStore = new TurnMemoryStore();
 * const observableStore = createObservableTurnMemoryStore(baseStore, {
 *     onTurnCreated: (turnId, turnNumber) => console.log(`Turn ${turnNumber} created`),
 *     onTurnStatusChanged: (turnId, status) => console.log(`Turn ${turnId} status: ${status}`)
 * });
 * ```
 */

import { TurnMemoryStore } from './TurnMemoryStore.js';
import { Turn, TurnStatus, ThinkingRound, ToolCallResult, TurnMemoryExport } from './Turn.js';
import { ApiMessage } from '../task/task.type.js';

/**
 * Observer callbacks for turn-level events
 */
export interface TurnStoreObserverCallbacks {
    onTurnCreated?: (turnId: string, turnNumber: number, workspaceContext: string, taskContext?: string) => void;
    onTurnStatusChanged?: (turnId: string, status: TurnStatus) => void;
    onTurnMessageAdded?: (turnId: string, message: ApiMessage) => void;
    onThinkingPhaseCompleted?: (turnId: string, rounds: ThinkingRound[], tokensUsed: number) => void;
    onToolCallRecorded?: (turnId: string, toolName: string, success: boolean, result: any) => void;
    onTurnSummaryStored?: (turnId: string, summary: string, insights: string[]) => void;
    onTurnActionTokensUpdated?: (turnId: string, tokens: number) => void;
}

/**
 * Creates an observable TurnMemoryStore using Proxy pattern
 * 
 * @param store - The original TurnMemoryStore instance to wrap
 * @param callbacks - Observer callbacks to register
 * @returns A proxied TurnMemoryStore instance that automatically notifies observers
 */
export function createObservableTurnMemoryStore(
    store: TurnMemoryStore,
    callbacks: TurnStoreObserverCallbacks
): TurnMemoryStore {
    return new Proxy(store, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);

            // If the property is a function, wrap it to observe calls
            if (typeof value === 'function') {
                return new Proxy(value, {
                    apply(fnTarget, thisArg, args) {
                        const methodName = String(prop);

                        // Execute the original method
                        const result = Reflect.apply(fnTarget, thisArg, args);

                        // Notify observers based on method
                        switch (methodName) {
                            case 'createTurn': {
                                const turn = result as Turn;
                                callbacks.onTurnCreated?.(
                                    turn.id,
                                    turn.turnNumber,
                                    turn.workspaceContext,
                                    turn.taskContext
                                );
                                break;
                            }

                            case 'updateTurnStatus':
                                callbacks.onTurnStatusChanged?.(args[0] as string, args[1] as TurnStatus);
                                break;

                            case 'addMessageToTurn':
                                callbacks.onTurnMessageAdded?.(args[0] as string, args[1] as ApiMessage);
                                break;

                            case 'storeThinkingPhase':
                                callbacks.onThinkingPhaseCompleted?.(
                                    args[0] as string,
                                    args[1] as ThinkingRound[],
                                    args[2] as number
                                );
                                break;

                            case 'addToolCallResult': {
                                const toolCall = args[1] as ToolCallResult;
                                callbacks.onToolCallRecorded?.(
                                    args[0] as string,
                                    toolCall.toolName,
                                    toolCall.success,
                                    toolCall.result
                                );
                                break;
                            }

                            case 'storeSummary':
                                callbacks.onTurnSummaryStored?.(
                                    args[0] as string,
                                    args[1] as string,
                                    args[2] as string[]
                                );
                                break;

                            case 'updateActionTokens':
                                callbacks.onTurnActionTokensUpdated?.(args[0] as string, args[1] as number);
                                break;
                        }

                        return result;
                    },
                });
            }

            return value;
        },
    });
}

/**
 * Factory class for creating observable TurnMemoryStore instances
 * Provides a fluent API for registering callbacks
 * 
 * @example
 * ```typescript
 * const baseStore = new TurnMemoryStore();
 * const observableStore = new ObservableTurnMemoryStoreFactory()
 *     .onTurnCreated((turnId, turnNumber) => console.log(`Turn ${turnNumber} created`))
 *     .onTurnStatusChanged((turnId, status) => console.log(`Status: ${status}`))
 *     .create(baseStore);
 * ```
 */
export class ObservableTurnMemoryStoreFactory {
    private callbacks: TurnStoreObserverCallbacks = {};

    onTurnCreated(callback: TurnStoreObserverCallbacks['onTurnCreated']): this {
        this.callbacks.onTurnCreated = callback;
        return this;
    }

    onTurnStatusChanged(callback: TurnStoreObserverCallbacks['onTurnStatusChanged']): this {
        this.callbacks.onTurnStatusChanged = callback;
        return this;
    }

    onTurnMessageAdded(callback: TurnStoreObserverCallbacks['onTurnMessageAdded']): this {
        this.callbacks.onTurnMessageAdded = callback;
        return this;
    }

    onThinkingPhaseCompleted(callback: TurnStoreObserverCallbacks['onThinkingPhaseCompleted']): this {
        this.callbacks.onThinkingPhaseCompleted = callback;
        return this;
    }

    onToolCallRecorded(callback: TurnStoreObserverCallbacks['onToolCallRecorded']): this {
        this.callbacks.onToolCallRecorded = callback;
        return this;
    }

    onTurnSummaryStored(callback: TurnStoreObserverCallbacks['onTurnSummaryStored']): this {
        this.callbacks.onTurnSummaryStored = callback;
        return this;
    }

    onTurnActionTokensUpdated(callback: TurnStoreObserverCallbacks['onTurnActionTokensUpdated']): this {
        this.callbacks.onTurnActionTokensUpdated = callback;
        return this;
    }

    create(store: TurnMemoryStore): TurnMemoryStore {
        return createObservableTurnMemoryStore(store, this.callbacks);
    }
}
