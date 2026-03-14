/**
 * Task Implementation
 * 
 * Implements the ITask interface with dedicated collector and validator.
 * Each Task is associated with a Level-1 TodoItem that auto-syncs status.
 */

import type {
    ITask,
    ITodoItem,
    IResultCollector,
    IResultValidator,
    TaskStatus,
    TaskCreationConfig,
    CollectedResult,
    ValidationResult,
    ProcessedResult,
    CollectionContext,
    TaskResultCallback,
    TaskCompleteCallback,
    TaskErrorCallback,
    Subscription,
} from './types.js';
import { TodoItem } from './todo/TodoItem.js';
import { TaskError } from './types.js';

/**
 * Implementation of ITask
 * Represents a single task with dedicated collector and validator
 */
export class Task implements ITask {
    readonly id: string;
    readonly description: string;
    private _status: TaskStatus;

    // Dedicated components (injected at creation, immutable)
    readonly collector: IResultCollector;
    readonly validator: IResultValidator;

    // Associated Level-1 TodoItem (auto-synced)
    readonly todoItem: ITodoItem;

    // Event callbacks
    private _resultCallbacks: Set<TaskResultCallback> = new Set();
    private _completeCallbacks: Set<TaskCompleteCallback> = new Set();
    private _errorCallbacks: Set<TaskErrorCallback> = new Set();

    // Metadata
    readonly metadata?: Record<string, unknown>;

    // Internal state
    private _createdAt: number;
    private _updatedAt: number;
    private _completedAt?: number;
    private _finalResult?: unknown;

    constructor(config: TaskCreationConfig) {
        this.id = config.id;
        this.description = config.description;
        this._status = 'pending';
        this.collector = config.collector;
        this.validator = config.validator;
        this.metadata = config.metadata;

        // Create associated Level-1 TodoItem
        this.todoItem = TodoItem.createLevel1({
            id: config.id,
            description: config.description,
            priority: config.priority,
        });

        this._createdAt = Date.now();
        this._updatedAt = this._createdAt;
    }

    get status(): TaskStatus {
        return this._status;
    }

    /**
     * Collect result using the dedicated collector
     */
    collect(data: unknown, context?: CollectionContext): CollectedResult {
        this._ensureNotFailed();

        try {
            const result = this.collector.collect(data, context);
            this._updatedAt = Date.now();

            // Trigger result callbacks
            this._triggerResultCallbacks(result);

            return result;
        } catch (error) {
            this.fail(error as Error);
            throw error;
        }
    }

    /**
     * Validate result using the dedicated validator
     */
    validate(result: CollectedResult): ValidationResult | Promise<ValidationResult> {
        return this.validator.validate(result);
    }

    /**
     * Process data (collect + validate atomically)
     */
    async process(data: unknown, context?: CollectionContext): Promise<ProcessedResult> {
        this._ensureNotFailed();

        const collected = this.collect(data, context);
        const validation = await this.validate(collected);

        // Update status based on validation
        if (!validation.isValid) {
            this._status = 'failed';
            this.todoItem.status = 'failed';
            const error = new Error(`Validation failed: ${validation.errors?.join(', ') || 'Unknown error'}`);
            this._triggerErrorCallbacks(error);
        }

        return {
            collected,
            validation,
            taskStatus: this._status,
        };
    }

    /**
     * Update task status (syncs with TodoItem)
     */
    updateStatus(status: TaskStatus, reason?: string): void {
        if (this._status === status) {
            return;
        }

        const previousStatus = this._status;
        this._status = status;
        this.todoItem.status = status;
        this._updatedAt = Date.now();

        // If transitioning to completed, trigger completion callbacks
        if (status === 'completed' && previousStatus !== 'completed') {
            this._completedAt = Date.now();
            this._triggerCompleteCallbacks();
        }

        // If transitioning to failed, trigger error callbacks
        if (status === 'failed' && previousStatus !== 'failed') {
            this._triggerErrorCallbacks(new Error(reason || 'Task marked as failed'));
        }
    }

    /**
     * Mark task as completed
     */
    complete(finalResult?: unknown): void {
        this._finalResult = finalResult;
        this.updateStatus('completed');
    }

    /**
     * Mark task as failed
     */
    fail(error: Error): void {
        // Only update status, which will trigger error callbacks
        this.updateStatus('failed', error.message);
    }

    /**
     * Subscribe to result events
     */
    onResult(callback: TaskResultCallback): Subscription {
        this._resultCallbacks.add(callback);
        return {
            unsubscribe: () => {
                this._resultCallbacks.delete(callback);
            },
        };
    }

    /**
     * Subscribe to completion events
     */
    onComplete(callback: TaskCompleteCallback): Subscription {
        this._completeCallbacks.add(callback);
        return {
            unsubscribe: () => {
                this._completeCallbacks.delete(callback);
            },
        };
    }

    /**
     * Subscribe to error events
     */
    onError(callback: TaskErrorCallback): Subscription {
        this._errorCallbacks.add(callback);
        return {
            unsubscribe: () => {
                this._errorCallbacks.delete(callback);
            },
        };
    }

    /**
     * Get task statistics
     */
    getStats(): {
        createdAt: number;
        updatedAt: number;
        completedAt?: number;
        duration?: number;
    } {
        return {
            createdAt: this._createdAt,
            updatedAt: this._updatedAt,
            completedAt: this._completedAt,
            duration: this._completedAt ? this._completedAt - this._createdAt : undefined,
        };
    }

    /**
     * Get final result (if completed)
     */
    getFinalResult(): unknown | undefined {
        return this._finalResult;
    }

    /**
     * Convert to plain object (for serialization)
     */
    toJSON(): {
        id: string;
        description: string;
        status: TaskStatus;
        collector: string;
        validator: string;
        todoItem: ReturnType<ITodoItem['toJSON']>;
        metadata?: Record<string, unknown>;
        stats: ReturnType<Task['getStats']>;
    } {
        return {
            id: this.id,
            description: this.description,
            status: this._status,
            collector: this.collector.type,
            validator: this.validator.type,
            todoItem: this.todoItem.toJSON(),
            metadata: this.metadata,
            stats: this.getStats(),
        };
    }

    // ==================== Private Methods ====================

    /**
     * Ensure task is not in failed state
     */
    private _ensureNotFailed(): void {
        if (this._status === 'failed') {
            throw new Error(`Task '${this.id}' is in failed state and cannot process new data`);
        }
    }

    /**
     * Trigger result callbacks
     */
    private _triggerResultCallbacks(result: CollectedResult): void {
        for (const callback of this._resultCallbacks) {
            try {
                void callback(this, result);
            } catch (error) {
                console.error(`Error in result callback for task '${this.id}':`, error);
            }
        }
    }

    /**
     * Trigger completion callbacks
     */
    private _triggerCompleteCallbacks(): void {
        for (const callback of this._completeCallbacks) {
            try {
                void callback(this, this._finalResult);
            } catch (error) {
                console.error(`Error in complete callback for task '${this.id}':`, error);
            }
        }
    }

    /**
     * Trigger error callbacks
     */
    private _triggerErrorCallbacks(error: Error): void {
        for (const callback of this._errorCallbacks) {
            try {
                void callback(this, error);
            } catch (err) {
                console.error(`Error in error callback for task '${this.id}':`, err);
            }
        }
    }
}

/**
 * Factory function to create a Task
 */
export function createTask(config: TaskCreationConfig): Task {
    return new Task(config);
}
