/**
 * TodoItem Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TodoItem, createTodoItem } from '../todo/TodoItem.js';
import type { Level2TodoItem } from '../types.js';

describe('TodoItem', () => {
    describe('Level-1 TodoItem', () => {
        it('should create a Level-1 TodoItem with correct properties', () => {
            const todoItem = TodoItem.createLevel1({
                id: 'task-1',
                description: 'Test task',
                priority: 'high',
            });

            expect(todoItem.id).toBe('task-1');
            expect(todoItem.description).toBe('Test task');
            expect(todoItem.status).toBe('pending');
            expect(todoItem.priority).toBe('high');
            expect(todoItem.level).toBe(1);
            expect(todoItem.meta).toBeDefined();
            expect(todoItem.meta?.source).toBe('task_auto_generated');
            expect(todoItem.meta?.taskId).toBe('task-1');
        });

        it('should allow status updates', () => {
            const todoItem = TodoItem.createLevel1({
                id: 'task-1',
                description: 'Test task',
            });

            expect(todoItem.status).toBe('pending');

            todoItem.status = 'in_progress';
            expect(todoItem.status).toBe('in_progress');

            todoItem.status = 'completed';
            expect(todoItem.status).toBe('completed');
        });

        it('should manage Level-2 children', () => {
            const parent = TodoItem.createLevel1({
                id: 'parent-task',
                description: 'Parent task',
            });

            const child1: Level2TodoItem = {
                id: 'child-1',
                description: 'Child task 1',
                status: 'pending',
                parentId: 'parent-task',
                level: 2,
            };

            const child2: Level2TodoItem = {
                id: 'child-2',
                description: 'Child task 2',
                status: 'pending',
                parentId: 'parent-task',
                level: 2,
            };

            parent.addChild(child1);
            parent.addChild(child2);

            expect(parent.getChildren()).toHaveLength(2);
            expect(parent.getChild('child-1')).toEqual(child1);
            expect(parent.getChild('child-2')).toEqual(child2);
        });

        it('should prevent adding children with wrong parent ID', () => {
            const parent = TodoItem.createLevel1({
                id: 'parent-task',
                description: 'Parent task',
            });

            const wrongChild: Level2TodoItem = {
                id: 'child-1',
                description: 'Wrong child',
                status: 'pending',
                parentId: 'other-parent',
                level: 2,
            };

            expect(() => parent.addChild(wrongChild)).toThrow();
        });

        it('should update child status', () => {
            const parent = TodoItem.createLevel1({
                id: 'parent-task',
                description: 'Parent task',
            });

            const child: Level2TodoItem = {
                id: 'child-1',
                description: 'Child task',
                status: 'pending',
                parentId: 'parent-task',
                level: 2,
            };

            parent.addChild(child);
            parent.updateChildStatus('child-1', 'completed');

            expect(parent.getChild('child-1')?.status).toBe('completed');
        });

        it('should auto-update parent status based on children', () => {
            const parent = TodoItem.createLevel1({
                id: 'parent-task',
                description: 'Parent task',
            });

            const child1: Level2TodoItem = {
                id: 'child-1',
                description: 'Child 1',
                status: 'pending',
                parentId: 'parent-task',
                level: 2,
            };

            const child2: Level2TodoItem = {
                id: 'child-2',
                description: 'Child 2',
                status: 'pending',
                parentId: 'parent-task',
                level: 2,
            };

            const child3: Level2TodoItem = {
                id: 'child-3',
                description: 'Child 3',
                status: 'pending',
                parentId: 'parent-task',
                level: 2,
            };

            parent.addChild(child1);
            parent.addChild(child2);
            parent.addChild(child3);

            // All pending -> parent pending
            expect(parent.status).toBe('pending');

            // One in progress -> parent in progress
            parent.updateChildStatus('child-1', 'in_progress');
            expect(parent.status).toBe('in_progress');

            // All completed -> parent completed
            parent.updateChildStatus('child-1', 'completed');
            parent.updateChildStatus('child-2', 'completed');
            parent.updateChildStatus('child-3', 'completed');
            expect(parent.status).toBe('completed');

            // One failed -> parent failed (update status to trigger auto-update)
            parent.updateChildStatus('child-3', 'failed');
            expect(parent.status).toBe('failed');
        });

        it('should serialize to JSON correctly', () => {
            const parent = TodoItem.createLevel1({
                id: 'parent-task',
                description: 'Parent task',
                priority: 'medium',
            });

            const child: Level2TodoItem = {
                id: 'child-1',
                description: 'Child task',
                status: 'completed',
                parentId: 'parent-task',
                level: 2,
            };

            parent.addChild(child);

            const json = parent.toJSON();

            expect(json).toEqual({
                id: 'parent-task',
                description: 'Parent task',
                status: 'pending',
                priority: 'medium',
                level: 1,
                meta: {
                    source: 'task_auto_generated',
                    taskId: 'parent-task',
                    createdAt: expect.any(Number),
                },
                children: [child],
            });
        });
    });

    describe('createTodoItem factory', () => {
        it('should create Level-1 TodoItem by default', () => {
            const item = createTodoItem({
                id: 'task-1',
                description: 'Test task',
            });

            expect(item).toBeInstanceOf(TodoItem);
            expect(item.level).toBe(1);
        });

        it('should create Level-2 TodoItem when specified', () => {
            const item = createTodoItem({
                id: 'child-1',
                description: 'Child task',
                level: 2,
                parentId: 'parent-1',
            });

            expect('id' in item && 'level' in item).toBe(true);
            if ('level' in item) {
                expect(item.level).toBe(2);
            }
        });
    });
});
