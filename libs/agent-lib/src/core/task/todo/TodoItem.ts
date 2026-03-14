/**
 * TodoItem Implementation
 * 
 * Implements the ITodoItem interface with support for hierarchical structure.
 * Level-1 items are auto-generated from Tasks, Level-2 items are created by LLM.
 */

import type {
    ITodoItem,
    Level2TodoItem,
    TodoStatus,
    TodoPriority,
    TodoItemMetadata,
} from '../types.js';

/**
 * Implementation of ITodoItem
 * Supports both Level-1 (auto-generated from Task) and Level-2 (LLM-created) items
 */
export class TodoItem implements ITodoItem {
    readonly id: string;
    readonly description: string;
    private _status: TodoStatus;
    readonly priority?: TodoPriority;
    readonly level: 1 | 2;
    readonly meta?: TodoItemMetadata;

    // For Level-1 items: manage Level-2 children
    private _children: Map<string, Level2TodoItem> = new Map();

    constructor(config: {
        id: string;
        description: string;
        status: TodoStatus;
        priority?: TodoPriority;
        level: 1 | 2;
        meta?: TodoItemMetadata;
    }) {
        this.id = config.id;
        this.description = config.description;
        this._status = config.status;
        this.priority = config.priority;
        this.level = config.level;
        this.meta = config.meta;
    }

    get status(): TodoStatus {
        return this._status;
    }

    set status(value: TodoStatus) {
        this._status = value;
    }

    /**
     * Add a Level-2 child item (only for Level-1 items)
     */
    addChild(item: Level2TodoItem): void {
        if (this.level !== 1) {
            throw new Error('Cannot add children to Level-2 TodoItem');
        }
        if (item.parentId !== this.id) {
            throw new Error(`Child item parentId '${item.parentId}' does not match parent id '${this.id}'`);
        }
        this._children.set(item.id, item);
    }

    /**
     * Get all Level-2 child items
     */
    getChildren(): Level2TodoItem[] {
        return Array.from(this._children.values());
    }

    /**
     * Get a specific Level-2 child item by id
     */
    getChild(id: string): Level2TodoItem | undefined {
        return this._children.get(id);
    }

    /**
     * Update the status of a Level-2 child item
     */
    updateChildStatus(id: string, status: TodoStatus): void {
        const child = this._children.get(id);
        if (!child) {
            throw new Error(`Child item with id '${id}' not found`);
        }
        child.status = status;

        // Optionally auto-update parent status based on children
        this._maybeAutoUpdateParentStatus();
    }

    /**
     * Auto-update parent status based on children status
     * This is called when a child's status changes
     */
    private _maybeAutoUpdateParentStatus(): void {
        if (this._children.size === 0) {
            return;
        }

        const children = Array.from(this._children.values());
        const allCompleted = children.every(c => c.status === 'completed');
        const anyFailed = children.some(c => c.status === 'failed');
        const anyInProgress = children.some(c => c.status === 'in_progress');

        if (anyFailed) {
            this._status = 'failed';
        } else if (allCompleted) {
            this._status = 'completed';
        } else if (anyInProgress) {
            this._status = 'in_progress';
        } else {
            this._status = 'pending';
        }
    }

    /**
     * Convert to plain object (for serialization)
     */
    toJSON(): {
        id: string;
        description: string;
        status: TodoStatus;
        priority?: TodoPriority;
        level: 1 | 2;
        meta?: TodoItemMetadata;
        children: Level2TodoItem[];
    } {
        return {
            id: this.id,
            description: this.description,
            status: this._status,
            priority: this.priority,
            level: this.level,
            meta: this.meta,
            children: this.getChildren(),
        };
    }

    /**
     * Create a Level-1 TodoItem from a Task config
     */
    static createLevel1(config: {
        id: string;
        description: string;
        priority?: TodoPriority;
    }): TodoItem {
        return new TodoItem({
            id: config.id,
            description: config.description,
            status: 'pending',
            priority: config.priority,
            level: 1,
            meta: {
                source: 'task_auto_generated',
                taskId: config.id,
                createdAt: Date.now(),
            },
        });
    }

    /**
     * Create a Level-2 TodoItem (for LLM-created subtasks)
     */
    static createLevel2(config: {
        id: string;
        description: string;
        parentId: string;
        priority?: TodoPriority;
    }): Level2TodoItem {
        return {
            id: config.id,
            description: config.description,
            status: 'pending',
            parentId: config.parentId,
            level: 2,
            priority: config.priority,
        };
    }
}

/**
 * Factory function to create a TodoItem
 */
export function createTodoItem(config: {
    id: string;
    description: string;
    priority?: TodoPriority;
    level?: 1 | 2;
    parentId?: string;
}): TodoItem | Level2TodoItem {
    if (config.level === 2) {
        return TodoItem.createLevel2({
            id: config.id,
            description: config.description,
            parentId: config.parentId!,
            priority: config.priority,
        });
    }
    return TodoItem.createLevel1({
        id: config.id,
        description: config.description,
        priority: config.priority,
    });
}
