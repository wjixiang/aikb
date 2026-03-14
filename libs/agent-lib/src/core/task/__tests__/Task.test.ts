/**
 * Task Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Task, createTask } from '../Task.js';
import { TextCollector, createTextCollector } from '../collector/TextCollector.js';
import { createSimpleValidator } from '../validator/CustomValidator.js';
import type { TaskCreationConfig, CollectionContext } from '../types.js';

describe('Task', () => {
    let collector: TextCollector;
    let validator: ReturnType<typeof createSimpleValidator>;

    beforeEach(() => {
        collector = new TextCollector();
        validator = createSimpleValidator(
            'non-empty',
            (data) => data !== '' && data !== null && data !== undefined
        );
    });

    describe('constructor', () => {
        it('should create a task with correct properties', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
                priority: 'high',
            };

            const task = new Task(config);

            expect(task.id).toBe('task-1');
            expect(task.description).toBe('Test task');
            expect(task.status).toBe('pending');
            expect(task.collector).toBe(collector);
            expect(task.validator).toBe(validator);
            expect(task.todoItem).toBeDefined();
            expect(task.todoItem.id).toBe('task-1');
            expect(task.todoItem.description).toBe('Test task');
            expect(task.todoItem.priority).toBe('high');
        });

        it('should create unique timestamp for each task', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            const task1 = new Task(config);
            const task2 = new Task({ ...config, id: 'task-2' });

            expect(task1.getStats().createdAt).toBeLessThanOrEqual(task2.getStats().createdAt);
        });
    });

    describe('collect', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        it('should collect data using the dedicated collector', () => {
            const result = task.collect('test data');

            expect(result.type).toBe('text');
            expect(result.data).toBe('test data');
            expect(result.timestamp).toBeDefined();
        });

        it('should trigger result callbacks on collection', () => {
            const callback = vi.fn();
            task.onResult(callback);

            task.collect('test data');

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(task, expect.objectContaining({
                data: 'test data',
            }));
        });

        it('should update timestamp on collection', async () => {
            const statsBefore = task.getStats();

            // Add a small delay to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 1));

            task.collect('data');
            const statsAfter = task.getStats();

            expect(statsAfter.updatedAt).toBeGreaterThanOrEqual(statsBefore.updatedAt);
        });

        it('should throw error if task is failed', () => {
            task.fail(new Error('Task failed'));

            expect(() => task.collect('data')).toThrow('Task');
        });
    });

    describe('validate', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        it('should validate collected result', async () => {
            const result = task.collect('test data');
            const validation = await task.validate(result);

            expect(validation.isValid).toBe(true);
        });

        it('should return validation errors for invalid data', async () => {
            const result = task.collect(''); // Empty string
            const validation = await task.validate(result);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toBeDefined();
        });
    });

    describe('process', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        it('should collect and validate atomically', async () => {
            const processed = await task.process('test data');

            expect(processed.collected.data).toBe('test data');
            expect(processed.validation.isValid).toBe(true);
            expect(processed.taskStatus).toBe('pending');
        });

        it('should mark task as failed on validation failure', async () => {
            const processed = await task.process(''); // Invalid data

            expect(processed.validation.isValid).toBe(false);
            expect(task.status).toBe('failed');
            expect(task.todoItem.status).toBe('failed');
        });

        it('should trigger error callbacks on validation failure', async () => {
            const callback = vi.fn();
            task.onError(callback);

            await task.process('');

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateStatus', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        it('should update task status', () => {
            expect(task.status).toBe('pending');

            task.updateStatus('in_progress');
            expect(task.status).toBe('in_progress');

            task.updateStatus('completed');
            expect(task.status).toBe('completed');
        });

        it('should sync status with todoItem', () => {
            task.updateStatus('in_progress');

            expect(task.todoItem.status).toBe('in_progress');
        });

        it('should trigger completion callbacks when status becomes completed', () => {
            const callback = vi.fn();
            task.onComplete(callback);

            task.updateStatus('completed');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should trigger error callbacks when status becomes failed', () => {
            const callback = vi.fn();
            task.onError(callback);

            task.updateStatus('failed', 'Test failure');

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not trigger callbacks if status is same', () => {
            const callback = vi.fn();
            task.onComplete(callback);

            task.updateStatus('pending'); // Already pending
            task.updateStatus('pending');

            expect(callback).not.toHaveBeenCalled();
        });

        it('should set completedAt timestamp when completed', () => {
            task.updateStatus('completed');

            expect(task.getStats().completedAt).toBeDefined();
            expect(task.getStats().duration).toBeDefined();
        });
    });

    describe('complete', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        it('should mark task as completed', () => {
            task.complete('final result');

            expect(task.status).toBe('completed');
            expect(task.getFinalResult()).toBe('final result');
        });

        it('should sync with todoItem', () => {
            task.complete();

            expect(task.todoItem.status).toBe('completed');
        });

        it('should trigger completion callbacks', () => {
            const callback = vi.fn();
            task.onComplete(callback);

            task.complete('result');

            expect(callback).toHaveBeenCalledWith(task, 'result');
        });
    });

    describe('fail', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        it('should mark task as failed', () => {
            const error = new Error('Task failed');
            task.fail(error);

            expect(task.status).toBe('failed');
        });

        it('should sync with todoItem', () => {
            const error = new Error('Task failed');
            task.fail(error);

            expect(task.todoItem.status).toBe('failed');
        });

        it('should trigger error callbacks', () => {
            const callback = vi.fn();
            task.onError(callback);

            const error = new Error('Task failed');
            task.fail(error);

            expect(callback).toHaveBeenCalledWith(task, error);
        });
    });

    describe('event subscriptions', () => {
        let task: Task;

        beforeEach(() => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            task = new Task(config);
        });

        describe('onResult', () => {
            it('should subscribe to result events', () => {
                const callback = vi.fn();
                const subscription = task.onResult(callback);

                task.collect('data');

                expect(callback).toHaveBeenCalled();

                subscription.unsubscribe();
                task.collect('more data');

                expect(callback).toHaveBeenCalledTimes(1);
            });
        });

        describe('onComplete', () => {
            it('should subscribe to completion events', () => {
                const callback = vi.fn();
                const subscription = task.onComplete(callback);

                task.complete();

                expect(callback).toHaveBeenCalled();

                subscription.unsubscribe();
                task.complete();

                expect(callback).toHaveBeenCalledTimes(1);
            });
        });

        describe('onError', () => {
            it('should subscribe to error events', () => {
                const callback = vi.fn();
                const subscription = task.onError(callback);

                task.fail(new Error('error'));

                expect(callback).toHaveBeenCalled();

                subscription.unsubscribe();
                task.fail(new Error('another error'));

                expect(callback).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('getStats', () => {
        it('should return task statistics', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            const task = new Task(config);

            const stats = task.getStats();

            expect(stats.createdAt).toBeDefined();
            expect(stats.updatedAt).toBeDefined();
            expect(stats.completedAt).toBeUndefined();
            expect(stats.duration).toBeUndefined();
        });

        it('should include duration when completed', async () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            const task = new Task(config);

            // Add a small delay to ensure duration > 0
            await new Promise(resolve => setTimeout(resolve, 2));
            task.complete();

            const stats = task.getStats();

            expect(stats.completedAt).toBeDefined();
            expect(stats.duration).toBeDefined();
            expect(stats.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getFinalResult', () => {
        it('should return undefined before completion', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            const task = new Task(config);

            expect(task.getFinalResult()).toBeUndefined();
        });

        it('should return final result after completion', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };
            const task = new Task(config);
            task.complete('final result');

            expect(task.getFinalResult()).toBe('final result');
        });
    });

    describe('toJSON', () => {
        it('should serialize task to JSON', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
                priority: 'high',
                metadata: { custom: 'value' },
            };
            const task = new Task(config);

            const json = task.toJSON();

            expect(json).toEqual({
                id: 'task-1',
                description: 'Test task',
                status: 'pending',
                collector: 'text',
                validator: 'non-empty',
                todoItem: expect.any(Object),
                metadata: { custom: 'value' },
                stats: expect.any(Object),
            });
        });
    });

    describe('createTask factory', () => {
        it('should create a Task instance', () => {
            const config: TaskCreationConfig = {
                id: 'task-1',
                description: 'Test task',
                collector,
                validator,
            };

            const task = createTask(config);

            expect(task).toBeInstanceOf(Task);
        });
    });
});
