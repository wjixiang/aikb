import { describe, it, expect, beforeEach } from 'vitest';
import {
  RuntimeTaskComponent,
  createRuntimeTaskComponent,
} from '../runtimeTaskComponent.js';

describe('RuntimeTaskComponent', () => {
  let component: RuntimeTaskComponent;

  beforeEach(() => {
    component = createRuntimeTaskComponent({
      expertId: 'test-expert',
    });
  });

  describe('constructor', () => {
    it('should create component with correct id', () => {
      expect(component.componentId).toBe('runtime-task');
    });

    it('should initialize with empty tool set', () => {
      expect(component.toolSet.size).toBe(5);
    });
  });

  describe('submitTask', () => {
    it('should submit a task and return taskId', async () => {
      const taskId = await component.submitTask({
        description: 'Test task',
        priority: 'normal',
      });

      expect(taskId).toMatch(/^task_/);
    });
  });

  describe('getPendingTasks tool', () => {
    it('should return empty array when no tasks', async () => {
      const result = await component.handleToolCall('getPendingTasks', {
        limit: 10,
      });
      expect(result.success).toBe(true);
      expect(result.data.tasks).toEqual([]);
    });

    it('should return submitted tasks', async () => {
      await component.submitTask({ description: 'Task 1', priority: 'normal' });
      await component.submitTask({ description: 'Task 2', priority: 'high' });

      const result = await component.handleToolCall('getPendingTasks', {
        limit: 10,
      });
      expect(result.success).toBe(true);
      expect(result.data.tasks).toHaveLength(2);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        await component.submitTask({
          description: `Task ${i}`,
          priority: 'normal',
        });
      }

      const result = await component.handleToolCall('getPendingTasks', {
        limit: 3,
      });
      expect(result.data.tasks).toHaveLength(3);
    });
  });

  describe('reportTaskResult tool', () => {
    it('should report task completion', async () => {
      const taskId = await component.submitTask({
        description: 'Task to complete',
        priority: 'normal',
      });

      const result = await component.handleToolCall('reportTaskResult', {
        taskId,
        success: true,
        output: { answer: 42 },
      });

      expect(result.success).toBe(true);

      const storedResult = await component.getTaskResult(taskId);
      expect(storedResult?.success).toBe(true);
      expect(storedResult?.output).toEqual({ answer: 42 });
    });

    it('should report task failure', async () => {
      const taskId = await component.submitTask({
        description: 'Task to fail',
        priority: 'normal',
      });

      const result = await component.handleToolCall('reportTaskResult', {
        taskId,
        success: false,
        error: 'Something went wrong',
      });

      expect(result.success).toBe(true);

      const storedResult = await component.getTaskResult(taskId);
      expect(storedResult?.success).toBe(false);
      expect(storedResult?.error).toBe('Something went wrong');
    });

    it('should return error for non-existent task', async () => {
      const result = await component.handleToolCall('reportTaskResult', {
        taskId: 'non-existent',
        success: true,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('sendTaskToExpert tool', () => {
    it('should send task to another expert', async () => {
      const result = await component.handleToolCall('sendTaskToExpert', {
        receiverExpertId: 'other-expert',
        description: 'Delegated task',
        priority: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.data.taskId).toMatch(/^task_/);
    });
  });

  describe('markTaskProcessing tool', () => {
    it('should mark task as processing', async () => {
      const taskId = await component.submitTask({
        description: 'Task to process',
        priority: 'normal',
      });

      const result = await component.handleToolCall('markTaskProcessing', {
        taskId,
      });

      expect(result.success).toBe(true);

      const taskResult = await component.handleToolCall('getTaskById', {
        taskId,
      });
      expect(taskResult.data.status).toBe('processing');
    });
  });

  describe('renderImply', () => {
    it('should render component state', async () => {
      await component.submitTask({
        description: 'Render test',
        priority: 'high',
      });

      const elements = await component.renderImply();
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});
