/**
 * TaskModule Implementation
 *
 * Container for managing multiple Task instances with their dedicated
 * collectors and validators. Handles task lifecycle, batch operations,
 * and prompt integration.
 */

import type {
    ITaskModule,
    ITask,
    TaskCreationConfig,
    TaskResultEntry,
    ValidationEntry,
    CollectionReport,
    ValidationReport,
    RenderOptions,
    TaskContextSummary,
    TaskModuleDefaults,
    TaskNotFoundError,
    CollectedResult,
    ValidationResult,
    ITodoItem,
    Level2TodoItem,
    TodoStatus,
} from './types.js';
import { Task } from './Task.js';

/**
 * Implementation of ITaskModule
 * Manages multiple Task instances with their dedicated collectors and validators
 */
export class TaskModule implements ITaskModule {
    // Task registry
    private _tasks: Map<string, ITask> = new Map();

    // Default configuration
    private _defaults: TaskModuleDefaults = {};

    /**
     * Create a new Task with dedicated collector and validator
     * Automatically registers as Level-1 TodoItem
     */
    createTask(config: TaskCreationConfig): ITask {
        if (this._tasks.has(config.id)) {
            throw new Error(`Task with id '${config.id}' already exists`);
        }

        // Create task instance
        const task = new Task(config);

        // Register task
        this._tasks.set(config.id, task);

        return task;
    }

    /**
     * Get a task by id
     */
    getTask(taskId: string): ITask | undefined {
        return this._tasks.get(taskId);
    }

    /**
     * Get all root tasks (Level-1)
     */
    getRootTasks(): ITask[] {
        return Array.from(this._tasks.values());
    }

    /**
     * Destroy a task (removes associated TodoItem)
     */
    destroyTask(taskId: string): void {
        const task = this._tasks.get(taskId);
        if (!task) {
            throw new Error(`Task '${taskId}' not found`);
        }

        // Cleanup task resources
        this._tasks.delete(taskId);
    }

    /**
     * Batch collect results (routes to respective task collectors)
     */
    collectResults(entries: TaskResultEntry[]): CollectionReport {
        const results: Record<string, CollectedResult> = {};
        const errors: Record<string, string> = {};
        let success = true;

        for (const entry of entries) {
            const task = this._tasks.get(entry.taskId);
            if (!task) {
                errors[entry.taskId] = `Task '${entry.taskId}' not found`;
                success = false;
                continue;
            }

            try {
                const result = task.collect(entry.data, entry.context);
                results[entry.taskId] = result;
            } catch (error) {
                errors[entry.taskId] = error instanceof Error ? error.message : String(error);
                success = false;
            }
        }

        return { success, results, errors };
    }

    /**
     * Batch validate results (routes to respective task validators)
     */
    async validateResults(entries: ValidationEntry[]): Promise<ValidationReport> {
        const results: Record<string, ValidationResult> = {};
        let valid = 0;
        let invalid = 0;

        for (const entry of entries) {
            const task = this._tasks.get(entry.taskId);
            if (!task) {
                results[entry.taskId] = {
                    isValid: false,
                    errors: [`Task '${entry.taskId}' not found`],
                };
                invalid++;
                continue;
            }

            const validation = await task.validate(entry.result);
            results[entry.taskId] = validation;

            if (validation.isValid) {
                valid++;
            } else {
                invalid++;
            }
        }

        return { results, summary: { valid, invalid } };
    }

    /**
     * Render TODO list for LLM prompt
     */
    renderTodoListForPrompt(options: RenderOptions = {}): string {
        const {
            includeLevel2 = true,
            format = 'markdown',
            maxLevel2Items = 10,
        } = options;

        const tasks = Array.from(this._tasks.values());

        if (format === 'json') {
            return this._renderAsJson(tasks, includeLevel2);
        }

        if (format === 'plain') {
            return this._renderAsPlain(tasks, includeLevel2, maxLevel2Items);
        }

        return this._renderAsMarkdown(tasks, includeLevel2, maxLevel2Items);
    }

    /**
     * Get task context summary
     */
    getTaskContextSummary(taskIds?: string[]): TaskContextSummary {
        let tasks: ITask[];

        if (taskIds) {
            tasks = taskIds
                .map(id => this._tasks.get(id))
                .filter((t): t is ITask => t !== undefined);
        } else {
            tasks = Array.from(this._tasks.values());
        }

        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
        const failedTasks = tasks.filter(t => t.status === 'failed').length;

        return {
            totalTasks: tasks.length,
            completedTasks,
            pendingTasks,
            inProgressTasks,
            failedTasks,
            taskDescriptions: tasks.map(t => t.description),
        };
    }

    /**
     * Set default collector/validator
     */
    setDefaults(config: TaskModuleDefaults): void {
        this._defaults = { ...this._defaults, ...config };
    }

    /**
     * Add a Level-2 TodoItem to a parent task
     */
    addLevel2TodoItem(item: Level2TodoItem): void {
        const parentTask = this._tasks.get(item.parentId);
        if (!parentTask) {
            throw new Error(`Parent task '${item.parentId}' not found`);
        }

        parentTask.todoItem.addChild(item);
    }

    /**
     * Update Level-2 TodoItem status
     */
    updateLevel2TodoItemStatus(parentTaskId: string, itemId: string, status: TodoStatus): void {
        const parentTask = this._tasks.get(parentTaskId);
        if (!parentTask) {
            throw new Error(`Parent task '${parentTaskId}' not found`);
        }

        parentTask.todoItem.updateChildStatus(itemId, status);
    }

    /**
     * Get all Level-2 TodoItems for a parent task
     */
    getLevel2TodoItems(parentTaskId: string): Level2TodoItem[] {
        const parentTask = this._tasks.get(parentTaskId);
        if (!parentTask) {
            throw new Error(`Parent task '${parentTaskId}' not found`);
        }

        return parentTask.todoItem.getChildren();
    }

    // ==================== Private Methods ====================

    /**
     * Render TODO list as markdown
     */
    private _renderAsMarkdown(tasks: ITask[], includeLevel2: boolean, maxLevel2: number): string {
        const lines: string[] = ['=== TODO LIST ===\n'];

        const statusIcon = (status: string) => {
            switch (status) {
                case 'completed': return '[✓]';
                case 'in_progress': return '[→]';
                case 'failed': return '[✗]';
                default: return '[ ]';
            }
        };

        for (const task of tasks) {
            const todoItem = task.todoItem;
            lines.push(`${statusIcon(todoItem.status)} ${todoItem.description}`);

            if (includeLevel2) {
                const children = todoItem.getChildren().slice(0, maxLevel2);
                for (const child of children) {
                    lines.push(`  ${statusIcon(child.status)} ${child.description}`);
                }

                const remainingChildren = todoItem.getChildren().length - maxLevel2;
                if (remainingChildren > 0) {
                    lines.push(`  ... and ${remainingChildren} more subtasks`);
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * Render TODO list as plain text
     */
    private _renderAsPlain(tasks: ITask[], includeLevel2: boolean, maxLevel2: number): string {
        const lines: string[] = ['TODO LIST:'];

        for (const task of tasks) {
            const todoItem = task.todoItem;
            lines.push(`- [${todoItem.status}] ${todoItem.description}`);

            if (includeLevel2) {
                const children = todoItem.getChildren().slice(0, maxLevel2);
                for (const child of children) {
                    lines.push(`  - [${child.status}] ${child.description}`);
                }
            }
        }

        return lines.join('\n');
    }

    /**
     * Render TODO list as JSON
     */
    private _renderAsJson(tasks: ITask[], includeLevel2: boolean): string {
        const data = tasks.map(task => {
            const todoItem = task.todoItem.toJSON();
            return {
                ...todoItem,
                children: includeLevel2 ? todoItem.children : [],
            };
        });

        return JSON.stringify(data, null, 2);
    }
}

/**
 * Factory function to create a TaskModule
 */
export function createTaskModule(): TaskModule {
    return new TaskModule();
}
