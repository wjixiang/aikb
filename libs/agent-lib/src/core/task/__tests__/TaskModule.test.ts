/**
 * TaskModule Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskModule, createTaskModule } from '../TaskModule.js';
import { TextCollector, createTextCollector } from '../collector/TextCollector.js';
import { createSimpleValidator } from '../validator/CustomValidator.js';
import type { TaskCreationConfig, Level2TodoItem } from '../types.js';

describe('TaskModule', () => {
    let taskModule: TaskModule;
    let collector: TextCollector;
    let validator: ReturnType<typeof createSimpleValidator>;

    beforeEach(() => {
        taskModule = new TaskModule();
        collector = new TextCollector();
        validator = createSimpleValidator(
            'non-empty',
            (data) => data !== '' && data !== null && data !== undefined
        );
    });

    describe('createTask', () => {
        it('should create a new task', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            const task = taskModule.createTask(config);

            expect(task.id).toBe('task-1');
            expect(task.description).toBe('Test task');
        });

        it('should register task in registry', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            taskModule.createTask(config);

            expect(taskModule.getTask('task-1')).toBeDefined();
        });

        it('should throw error if task already exists', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            taskModule.createTask(config);

            expect(() => taskModule.createTask(config)).toThrow();
        });

        it('should create Level-1 TodoItem', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            const task = taskModule.createTask(config);

            expect(task.todoItem.level).toBe(1);
            expect(task.todoItem.id).toBe('task-1');
        });
    });

    describe('getTask', () => {
        it('should return task by id', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            const createdTask = taskModule.createTask(config);
            const retrievedTask = taskModule.getTask('task-1');

            expect(retrievedTask).toBe(createdTask);
        });

        it('should return undefined for non-existent task', () => {
            const task = taskModule.getTask('non-existent');

            expect(task).toBeUndefined();
        });
    });

    describe('getRootTasks', () => {
        it('should return all root tasks', () => {
            taskModule.createTask({
                id: 'task-1',
                description: 'Task 1',
                collector,
                validator,
            });

            taskModule.createTask({
                id: 'task-2',
                description: 'Task 2',
                collector,
                validator,
            });

            const tasks = taskModule.getRootTasks();

            expect(tasks).toHaveLength(2);
            expect(tasks.map(t => t.id)).toEqual(['task-1', 'task-2']);
        });

        it('should return empty array when no tasks', () => {
            const tasks = taskModule.getRootTasks();

            expect(tasks).toEqual([]);
        });
    });

    describe('destroyTask', () => {
        it('should destroy a task', () => {
            taskModule.createTask({
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            });

            taskModule.destroyTask('task-1');

            expect(taskModule.getTask('task-1')).toBeUndefined();
        });

        it('should throw error for non-existent task', () => {
            expect(() => taskModule.destroyTask('non-existent')).toThrow();
        });
    });

    describe('collectResults', () => {
        beforeEach(() => {
            taskModule.createTask({
                id: 'task-1',
                description: 'Task 1',
                collector,
                validator,
            });

            taskModule.createTask({
                id: 'task-2',
                description: 'Task 2',
                collector,
                validator,
            });
        });

        it('should batch collect results', () => {
            const report = taskModule.collectResults([
                { taskId: 'task-1', data: 'data 1' },
                { taskId: 'task-2', data: 'data 2' },
            ]);

            expect(report.success).toBe(true);
            expect(report.results['task-1']).toBeDefined();
            expect(report.results['task-2']).toBeDefined();
            expect(report.results['task-1'].data).toBe('data 1');
            expect(report.results['task-2'].data).toBe('data 2');
        });

        it('should handle non-existent tasks', () => {
            const report = taskModule.collectResults([
                { taskId: 'task-1', data: 'data 1' },
                { taskId: 'non-existent', data: 'data 2' },
            ]);

            expect(report.success).toBe(false);
            expect(report.errors).toBeDefined();
            expect(report.errors?.['non-existent']).toBeDefined();
        });

        it('should handle collection errors', () => {
            // Create a task that will fail
            const failingTask = taskModule.createTask({
                id: 'failing-task',
                description: 'Failing task',
                collector,
                validator,
            });

            // Make the task fail
            failingTask.fail(new Error('Task failed'));

            const report = taskModule.collectResults([
                { taskId: 'failing-task', data: 'data' },
            ]);

            expect(report.success).toBe(false);
            expect(report.errors).toBeDefined();
        });
    });

    describe('validateResults', () => {
        beforeEach(() => {
            taskModule.createTask({
                id: 'task-1',
                description: 'Task 1',
                collector,
                validator,
            });

            taskModule.createTask({
                id: 'task-2',
                description: 'Task 2',
                collector,
                validator,
            });
        });

        it('should batch validate results', async () => {
            const result1 = taskModule.getTask('task-1')!.collect('valid data');
            const result2 = taskModule.getTask('task-2')!.collect('more valid data');

            const report = await taskModule.validateResults([
                { taskId: 'task-1', result: result1 },
                { taskId: 'task-2', result: result2 },
            ]);

            expect(report.results['task-1'].isValid).toBe(true);
            expect(report.results['task-2'].isValid).toBe(true);
            expect(report.summary.valid).toBe(2);
            expect(report.summary.invalid).toBe(0);
        });

        it('should handle validation failures', async () => {
            const result1 = taskModule.getTask('task-1')!.collect(''); // Invalid
            const result2 = taskModule.getTask('task-2')!.collect('valid data');

            const report = await taskModule.validateResults([
                { taskId: 'task-1', result: result1 },
                { taskId: 'task-2', result: result2 },
            ]);

            expect(report.results['task-1'].isValid).toBe(false);
            expect(report.results['task-2'].isValid).toBe(true);
            expect(report.summary.valid).toBe(1);
            expect(report.summary.invalid).toBe(1);
        });

        it('should handle non-existent tasks', async () => {
            const result = taskModule.getTask('task-1')!.collect('data');

            const report = await taskModule.validateResults([
                { taskId: 'task-1', result },
                { taskId: 'non-existent', result },
            ]);

            expect(report.results['non-existent'].isValid).toBe(false);
            expect(report.results['non-existent'].errors).toContain("Task 'non-existent' not found");
        });
    });

    describe('renderTodoListForPrompt', () => {
        beforeEach(() => {
            taskModule.createTask({
                id: 'task-1',
                description: 'First task',
                collector,
                validator,
                priority: 'high',
            });

            taskModule.createTask({
                id: 'task-2',
                description: 'Second task',
                collector,
                validator,
                priority: 'low',
            });
        });

        it('should render as markdown by default', () => {
            const todoList = taskModule.renderTodoListForPrompt();

            expect(todoList).toContain('=== TODO LIST ===');
            expect(todoList).toContain('[ ] First task');
            expect(todoList).toContain('[ ] Second task');
        });

        it('should include status icons', () => {
            const task = taskModule.getTask('task-1')!;
            task.updateStatus('completed');

            const todoList = taskModule.renderTodoListForPrompt();

            expect(todoList).toContain('[✓] First task');
        });

        it('should render as plain text', () => {
            const todoList = taskModule.renderTodoListForPrompt({ format: 'plain' });

            expect(todoList).toContain('TODO LIST:');
            expect(todoList).toContain('- [pending] First task');
        });

        it('should render as JSON', () => {
            const todoList = taskModule.renderTodoListForPrompt({ format: 'json' });

            const parsed = JSON.parse(todoList);

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].description).toBe('First task');
        });

        it('should include Level-2 children when requested', () => {
            taskModule.addLevel2TodoItem({
                id: 'child-1',
                description: 'Child task',
                parentId: 'task-1',
                level: 2,
                status: 'pending',
            });

            const todoList = taskModule.renderTodoListForPrompt({ includeLevel2: true });

            expect(todoList).toContain('Child task');
        });

        it('should limit Level-2 children', () => {
            for (let i = 0; i < 15; i++) {
                taskModule.addLevel2TodoItem({
                    id: `child-${i}`,
                    description: `Child task ${i}`,
                    parentId: 'task-1',
                    level: 2,
                    status: 'pending',
                });
            }

            const todoList = taskModule.renderTodoListForPrompt({
                includeLevel2: true,
                maxLevel2Items: 5,
            });

            expect(todoList).toContain('... and 10 more subtasks');
        });
    });

    describe('getTaskContextSummary', () => {
        beforeEach(() => {
            taskModule.createTask({
                id: 'task-1',
                description: 'Task 1',
                collector,
                validator,
            });

            taskModule.createTask({
                id: 'task-2',
                description: 'Task 2',
                collector,
                validator,
            });

            taskModule.createTask({
                id: 'task-3',
                description: 'Task 3',
                collector,
                validator,
            });
        });

        it('should return summary of all tasks', () => {
            const summary = taskModule.getTaskContextSummary();

            expect(summary.totalTasks).toBe(3);
            expect(summary.pendingTasks).toBe(3);
            expect(summary.completedTasks).toBe(0);
            expect(summary.inProgressTasks).toBe(0);
            expect(summary.failedTasks).toBe(0);
        });

        it('should count tasks by status', () => {
            const task1 = taskModule.getTask('task-1')!;
            const task2 = taskModule.getTask('task-2')!;
            const task3 = taskModule.getTask('task-3')!;

            task1.updateStatus('completed');
            task2.updateStatus('in_progress');
            task3.updateStatus('failed');

            const summary = taskModule.getTaskContextSummary();

            expect(summary.completedTasks).toBe(1);
            expect(summary.inProgressTasks).toBe(1);
            expect(summary.failedTasks).toBe(1);
            expect(summary.pendingTasks).toBe(0);
        });

        it('should include task descriptions', () => {
            const summary = taskModule.getTaskContextSummary();

            expect(summary.taskDescriptions).toEqual(['Task 1', 'Task 2', 'Task 3']);
        });

        it('should filter by task IDs', () => {
            const summary = taskModule.getTaskContextSummary(['task-1', 'task-2']);

            expect(summary.totalTasks).toBe(2);
            expect(summary.taskDescriptions).toEqual(['Task 1', 'Task 2']);
        });
    });

    describe('setDefaults', () => {
        it('should set default collector and validator', () => {
            const defaultCollector = new TextCollector();
            const defaultValidator = createSimpleValidator('default', () => true);

            taskModule.setDefaults({
                collector: defaultCollector,
                validator: defaultValidator,
            });

            // Defaults are stored but not used unless specified in task creation
            expect((taskModule as any)._defaults.collector).toBe(defaultCollector);
            expect((taskModule as any)._defaults.validator).toBe(defaultValidator);
        });
    });

    describe('addLevel2TodoItem', () => {
        it('should add Level-2 todo item to parent task', () => {
            taskModule.createTask({
                id: 'parent-task',
                description: 'Parent task',
                collector,
                validator,
            });

            taskModule.addLevel2TodoItem({
                id: 'child-1',
                description: 'Child task',
                parentId: 'parent-task',
                level: 2,
                status: 'pending',
            });

            const parent = taskModule.getTask('parent-task')!;
            const children = parent.todoItem.getChildren();

            expect(children).toHaveLength(1);
            expect(children[0].id).toBe('child-1');
        });

        it('should throw error for non-existent parent', () => {
            expect(() => {
                taskModule.addLevel2TodoItem({
                    id: 'child-1',
                    description: 'Child task',
                    parentId: 'non-existent',
                    level: 2,
                    status: 'pending',
                });
            }).toThrow();
        });
    });

    describe('updateLevel2TodoItemStatus', () => {
        beforeEach(() => {
            taskModule.createTask({
                id: 'parent-task',
                description: 'Parent task',
                collector,
                validator,
            });

            taskModule.addLevel2TodoItem({
                id: 'child-1',
                description: 'Child task',
                parentId: 'parent-task',
                level: 2,
                status: 'pending',
            });
        });

        it('should update Level-2 todo item status', () => {
            taskModule.updateLevel2TodoItemStatus('parent-task', 'child-1', 'completed');

            const parent = taskModule.getTask('parent-task')!;
            const child = parent.todoItem.getChild('child-1');

            expect(child?.status).toBe('completed');
        });

        it('should throw error for non-existent parent', () => {
            expect(() => {
                taskModule.updateLevel2TodoItemStatus('non-existent', 'child-1', 'completed');
            }).toThrow();
        });
    });

    describe('getLevel2TodoItems', () => {
        beforeEach(() => {
            taskModule.createTask({
                id: 'parent-task',
                description: 'Parent task',
                collector,
                validator,
            });

            taskModule.addLevel2TodoItem({
                id: 'child-1',
                description: 'Child 1',
                parentId: 'parent-task',
                level: 2,
                status: 'pending',
            });

            taskModule.addLevel2TodoItem({
                id: 'child-2',
                description: 'Child 2',
                parentId: 'parent-task',
                level: 2,
                status: 'pending',
            });
        });

        it('should return all Level-2 items for parent', () => {
            const children = taskModule.getLevel2TodoItems('parent-task');

            expect(children).toHaveLength(2);
            expect(children.map(c => c.id)).toEqual(['child-1', 'child-2']);
        });

        it('should throw error for non-existent parent', () => {
            expect(() => {
                taskModule.getLevel2TodoItems('non-existent');
            }).toThrow();
        });
    });

    describe('createTaskModule factory', () => {
        it('should create a TaskModule instance', () => {
            const module = createTaskModule();

            expect(module).toBeInstanceOf(TaskModule);
        });
    });
});
