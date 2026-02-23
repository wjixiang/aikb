/**
 * Task Module Type Definitions
 * 
 * This file contains all core type definitions for the Task Module,
 * including interfaces for TaskModule, Task, Collectors, Validators, and TodoItems.
 */

// ==================== Common Types ====================

/**
 * Task status throughout its lifecycle
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * TodoItem priority levels
 */
export type TodoPriority = 'low' | 'medium' | 'high';

/**
 * TodoItem status (aligned with TaskStatus)
 */
export type TodoStatus = TaskStatus;

/**
 * Task level in hierarchical structure
 */
export type TaskLevel = 1 | 2;

// ==================== Collector Types ====================

/**
 * Collection context providing metadata about the data source
 */
export interface CollectionContext {
    source?: 'llm_text' | 'tool_call' | 'external';
    toolName?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Result collected by a collector
 */
export interface CollectedResult {
    readonly type: string;
    readonly data: unknown;
    readonly metadata?: Record<string, unknown>;
    readonly timestamp: number;
}

/**
 * Interface for result collectors
 * Collectors are responsible for extracting and structuring data from LLM outputs
 */
export interface IResultCollector {
    /**
     * Unique type identifier for this collector
     */
    readonly type: string;

    /**
     * Collect and structure the provided data
     */
    collect(data: unknown, context?: CollectionContext): CollectedResult;

    /**
     * Check if this collector can handle the provided data
     */
    canCollect(data: unknown): boolean;
}

// ==================== Validator Types ====================

/**
 * Validation result from a validator
 */
export interface ValidationResult {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
    metadata?: Record<string, unknown>;
}

/**
 * Interface for result validators
 * Validators are responsible for checking if collected results meet requirements
 */
export interface IResultValidator {
    /**
     * Unique type identifier for this validator
     */
    readonly type: string;

    /**
     * Validate the provided collected result
     * Can be synchronous or asynchronous
     */
    validate(result: CollectedResult): ValidationResult | Promise<ValidationResult>;
}

// ==================== TodoItem Types ====================

/**
 * Metadata for auto-generated Level-1 TodoItems
 */
export interface TodoItemMetadata {
    source: 'task_auto_generated';
    taskId: string;
    createdAt: number;
    [key: string]: unknown;
}

/**
 * Level-2 TodoItem (dynamically created by LLM)
 */
export interface Level2TodoItem {
    id: string;
    description: string;
    status: TodoStatus;
    parentId: string;
    level: 2;
    priority?: TodoPriority;
    metadata?: Record<string, unknown>;
}

/**
 * Base TodoItem interface
 * Level-1 items are auto-generated from Tasks, Level-2 items are created by LLM
 */
export interface ITodoItem {
    readonly id: string;
    readonly description: string;
    status: TodoStatus;
    priority?: TodoPriority;
    level: TaskLevel;

    // For Level-1 items
    readonly meta?: TodoItemMetadata;

    // Child management (for Level-1 items to contain Level-2 items)
    addChild(item: Level2TodoItem): void;
    getChildren(): Level2TodoItem[];
    getChild(id: string): Level2TodoItem | undefined;
    updateChildStatus(id: string, status: TodoStatus): void;

    /**
     * Convert to plain object (for serialization)
     */
    toJSON(): {
        id: string;
        description: string;
        status: TodoStatus;
        priority?: TodoPriority;
        level: TaskLevel;
        meta?: TodoItemMetadata;
        children: Level2TodoItem[];
    };
}

// ==================== Task Types ====================

/**
 * Callback types for Task events
 */
export type TaskResultCallback = (task: ITask, result: CollectedResult) => void | Promise<void>;
export type TaskCompleteCallback = (task: ITask, finalResult?: unknown) => void | Promise<void>;
export type TaskErrorCallback = (task: ITask, error: Error) => void | Promise<void>;

/**
 * Subscription handle for event callbacks
 */
export interface Subscription {
    unsubscribe(): void;
}

/**
 * Result after processing (collect + validate)
 */
export interface ProcessedResult {
    collected: CollectedResult;
    validation: ValidationResult;
    taskStatus: TaskStatus;
}

/**
 * Configuration for creating a new Task
 */
export interface TaskCreationConfig {
    id: string;
    description: string;
    collector: IResultCollector;
    validator: IResultValidator;
    priority?: TodoPriority;
    metadata?: Record<string, unknown>;
}

/**
 * Interface for a Task instance
 * Each Task has its own dedicated Collector and Validator
 */
export interface ITask {
    readonly id: string;
    readonly description: string;
    readonly status: TaskStatus;

    // Dedicated components (injected at creation, immutable)
    readonly collector: IResultCollector;
    readonly validator: IResultValidator;

    // Associated Level-1 TodoItem (auto-synced)
    readonly todoItem: ITodoItem;

    // Result processing
    collect(data: unknown, context?: CollectionContext): CollectedResult;
    validate(result: CollectedResult): ValidationResult | Promise<ValidationResult>;
    process(data: unknown, context?: CollectionContext): ProcessedResult | Promise<ProcessedResult>;

    // Status management
    updateStatus(status: TaskStatus, reason?: string): void;
    complete(finalResult?: unknown): void;
    fail(error: Error): void;

    // Event subscription
    onResult(callback: TaskResultCallback): Subscription;
    onComplete(callback: TaskCompleteCallback): Subscription;
    onError(callback: TaskErrorCallback): Subscription;
}

// ==================== TaskModule Types ====================

/**
 * Entry for batch result collection
 */
export interface TaskResultEntry {
    taskId: string;
    data: unknown;
    context?: CollectionContext;
}

/**
 * Entry for batch validation
 */
export interface ValidationEntry {
    taskId: string;
    result: CollectedResult;
}

/**
 * Report from batch collection operation
 */
export interface CollectionReport {
    success: boolean;
    results: Record<string, CollectedResult>;
    errors?: Record<string, string>;
}

/**
 * Report from batch validation operation
 */
export interface ValidationReport {
    results: Record<string, ValidationResult>;
    summary: { valid: number; invalid: number };
}

/**
 * Options for rendering TODO list for LLM prompt
 */
export interface RenderOptions {
    includeLevel2?: boolean;
    format?: 'markdown' | 'plain' | 'json';
    maxLevel2Items?: number;
}

/**
 * Task context summary for prompt building
 */
export interface TaskContextSummary {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    failedTasks: number;
    taskDescriptions: string[];
}

/**
 * Default configuration for TaskModule
 */
export interface TaskModuleDefaults {
    collector?: IResultCollector;
    validator?: IResultValidator;
}

/**
 * Interface for TaskModule (container for Tasks)
 */
export interface ITaskModule {
    // === Task lifecycle management ===
    createTask(config: TaskCreationConfig): ITask;
    getTask(taskId: string): ITask | undefined;
    getRootTasks(): ITask[];
    destroyTask(taskId: string): void;

    // === Batch operations ===
    collectResults(entries: TaskResultEntry[]): CollectionReport;
    validateResults(entries: ValidationEntry[]): ValidationReport | Promise<ValidationReport>;

    // === Prompt integration ===
    renderTodoListForPrompt(options?: RenderOptions): string;
    getTaskContextSummary(taskIds?: string[]): TaskContextSummary;

    // === Configuration ===
    setDefaults(config: TaskModuleDefaults): void;
}

// ==================== Event Router Types ====================

/**
 * Payload from tool calls to be routed to Tasks
 */
export interface ToolCallPayload {
    toolName: string;
    result: unknown;
    metadata?: {
        callId?: string;
        confidence?: number;
        [key: string]: unknown;
    };
}

/**
 * Result from routing a tool call to a Task
 */
export interface RoutingResult {
    success: boolean;
    targetTaskId?: string;
    error?: string;
}

/**
 * Result from broadcasting to multiple Tasks
 */
export interface BroadcastResult {
    successCount: number;
    failureCount: number;
    details: Array<{ taskId: string; success: boolean; error?: string }>;
}

/**
 * Interface for event routing
 * Routes tool call results to appropriate Tasks based on task_id
 */
export interface IEventRouter {
    routeToTask(taskId: string, payload: ToolCallPayload): RoutingResult;
    broadcast(taskIds: string[], payload: ToolCallPayload): BroadcastResult;
}

// ==================== Task Errors ====================

/**
 * Base error class for Task-related errors
 */
export abstract class TaskError extends Error {
    abstract readonly code: string;

    constructor(message: string, public override readonly cause?: Error) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * Error thrown when Task is not found
 */
export class TaskNotFoundError extends TaskError {
    readonly code = 'TASK_NOT_FOUND';

    constructor(taskId: string, cause?: Error) {
        super(`Task '${taskId}' not found`, cause);
    }
}

/**
 * Error thrown when Task validation fails
 */
export class TaskValidationError extends TaskError {
    readonly code = 'TASK_VALIDATION_FAILED';

    constructor(taskId: string, errors: string[], cause?: Error) {
        super(`Task '${taskId}' validation failed: ${errors.join(', ')}`, cause);
    }
}

/**
 * Error thrown when Task creation fails
 */
export class TaskCreationError extends TaskError {
    readonly code = 'TASK_CREATION_FAILED';

    constructor(message: string, cause?: Error) {
        super(`Task creation failed: ${message}`, cause);
    }
}
