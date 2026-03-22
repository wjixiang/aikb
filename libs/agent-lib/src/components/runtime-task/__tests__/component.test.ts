import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RuntimeTaskComponent,
  createRuntimeTaskComponent,
} from '../runtimeTaskComponent.js';
import { InMemoryTaskStorage } from '../storage.js';
import type { ICentralTaskQueue } from '../../../core/runtime/index.js';
import type { HookModule } from '../../../core/hooks/HookModule.js';
import { HookType } from '../../../core/hooks/types.js';

describe('RuntimeTaskComponent', () => {
  let component: RuntimeTaskComponent;
  let mockCentralTaskQueue: ICentralTaskQueue;
  let mockHookModule: HookModule;

  const createMockCentralTaskQueue = (): ICentralTaskQueue => ({
    getForAgent: vi.fn(() => Promise.resolve([])),
    getStats: vi.fn(() => Promise.resolve({ pending: 0, processing: 0 })),
    complete: vi.fn(() => Promise.resolve()),
    fail: vi.fn(() => Promise.resolve()),
  });

  const createMockHookModule = (): HookModule => ({
    executeHooks: vi.fn(() => Promise.resolve()),
    getHookHandlers: vi.fn(() => []),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCentralTaskQueue = createMockCentralTaskQueue();
    mockHookModule = createMockHookModule();
    component = createRuntimeTaskComponent({
      instanceId: 'test-instance',
    });
  });

  describe('constructor', () => {
    it('should create component with correct id', () => {
      expect(component.componentId).toBe('runtime-task');
    });

    it('should initialize with empty tool set', () => {
      expect(component.toolSet.size).toBe(5);
    });

    it('should use default maxQueueSize of 100', () => {
      const comp = createRuntimeTaskComponent({ instanceId: 'test' });
      expect(comp).toBeDefined();
    });

    it('should accept custom storage', () => {
      const customStorage = new InMemoryTaskStorage();
      const comp = createRuntimeTaskComponent({
        instanceId: 'test',
        storage: customStorage,
      });
      expect(comp).toBeDefined();
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

    it('should set correct default values', async () => {
      const taskId = await component.submitTask({
        description: 'Test task',
        priority: 'normal',
      });

      const task = await component.handleToolCall('getTaskById', { taskId });
      expect(task.data.status).toBe('pending');
      expect(task.data.receiver).toBe('test-instance');
    });

    it('should include sender if provided', async () => {
      const taskId = await component.submitTask({
        description: 'Test task',
        priority: 'normal',
        sender: 'sender-instance',
      });

      const task = await component.handleToolCall('getTaskById', { taskId });
      expect(task.data.sender).toBe('sender-instance');
    });

    it('should trigger TASK_SUBMITTED hook', async () => {
      const compWithHook = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        hookModule: mockHookModule,
      });

      await compWithHook.submitTask({
        description: 'Test task',
        priority: 'normal',
      });

      expect(mockHookModule.executeHooks).toHaveBeenCalledWith(
        HookType.TASK_SUBMITTED,
        expect.objectContaining({
          type: HookType.TASK_SUBMITTED,
          instanceId: 'test-instance',
        }),
      );
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

    it('should sort urgent tasks first', async () => {
      await component.submitTask({ description: 'Normal task', priority: 'normal' });
      await component.submitTask({ description: 'Urgent task', priority: 'urgent' });
      await component.submitTask({ description: 'High task', priority: 'high' });

      const result = await component.handleToolCall('getPendingTasks', {
        limit: 10,
      });
      expect(result.data.tasks[0].priority).toBe('urgent');
    });

    it('should merge tasks from central queue', async () => {
      const compWithQueue = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        centralTaskQueue: mockCentralTaskQueue,
      });

      const centralTasks = [
        {
          taskId: 'central_task_1',
          description: 'Central task',
          input: {},
          priority: 'normal' as const,
          status: 'pending' as const,
          targetInstanceId: 'test-instance',
          createdAt: new Date(),
        },
      ];
      vi.mocked(mockCentralTaskQueue.getForAgent).mockResolvedValue(centralTasks);

      const result = await compWithQueue.handleToolCall('getPendingTasks', {
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(mockCentralTaskQueue.getForAgent).toHaveBeenCalledWith('test-instance');
    });

    it('should handle central queue error gracefully', async () => {
      const compWithQueue = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        centralTaskQueue: mockCentralTaskQueue,
      });

      mockCentralTaskQueue.getForAgent = vi.fn(() =>
        Promise.reject(new Error('Queue unavailable')),
      );

      const result = await compWithQueue.handleToolCall('getPendingTasks', {
        limit: 10,
      });

      expect(result.success).toBe(false);
      expect(result.summary).toContain('Failed to get pending tasks');
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

  describe('getTaskById tool', () => {
    it('should return task when found', async () => {
      const taskId = await component.submitTask({
        description: 'Task to find',
        priority: 'normal',
      });

      const result = await component.handleToolCall('getTaskById', { taskId });

      expect(result.success).toBe(true);
      expect(result.data.description).toBe('Task to find');
      expect(result.data.taskId).toBe(taskId);
    });

    it('should return error when task not found', async () => {
      const result = await component.handleToolCall('getTaskById', {
        taskId: 'non-existent-id',
      });

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.summary).toContain('Task not found');
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

    it('should use normal priority by default', async () => {
      const result = await component.handleToolCall('sendTaskToExpert', {
        receiverExpertId: 'other-expert',
        description: 'Delegated task',
      });

      expect(result.success).toBe(true);
      const taskId = result.data.taskId;
      const task = await component.handleToolCall('getTaskById', { taskId });
      expect(task.data.priority).toBe('normal');
    });

    it('should set sender to current instance', async () => {
      const result = await component.handleToolCall('sendTaskToExpert', {
        receiverExpertId: 'other-expert',
        description: 'Delegated task',
      });

      const taskId = result.data.taskId;
      const task = await component.handleToolCall('getTaskById', { taskId });
      expect(task.data.sender).toBe('test-instance');
      expect(task.data.receiver).toBe('other-expert');
    });
  });

  describe('sendToExpert method', () => {
    it('should send task to expert and return taskId', async () => {
      const taskId = await component.sendToExpert('receiver-1', {
        description: 'Direct send test',
        input: { key: 'value' },
        priority: 'high',
        sender: 'sender-instance',
      });

      expect(taskId).toMatch(/^task_/);
      const task = await component.handleToolCall('getTaskById', { taskId });
      expect(task.data.receiver).toBe('receiver-1');
      expect(task.data.sender).toBe('sender-instance');
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

    it('should return error for non-existent task', async () => {
      const result = await component.handleToolCall('markTaskProcessing', {
        taskId: 'non-existent',
      });

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
    });
  });

  describe('getTaskResult method', () => {
    it('should return result after task completion', async () => {
      const taskId = await component.submitTask({
        description: 'Task with result',
        priority: 'normal',
      });

      await component.handleToolCall('reportTaskResult', {
        taskId,
        success: true,
        output: { answer: 42 },
      });

      const result = await component.getTaskResult(taskId);
      expect(result?.success).toBe(true);
      expect(result?.output).toEqual({ answer: 42 });
    });

    it('should return undefined for non-existent task', async () => {
      const result = await component.getTaskResult('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('centralTaskQueue getter/setter', () => {
    it('should get central task queue', () => {
      const compWithQueue = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        centralTaskQueue: mockCentralTaskQueue,
      });
      expect(compWithQueue.centralTaskQueue).toBeDefined();
    });

    it('should set central task queue', () => {
      component.centralTaskQueue = mockCentralTaskQueue;
      expect(component.centralTaskQueue).toBeDefined();
    });

    it('should return undefined when no queue set', () => {
      expect(component.centralTaskQueue).toBeUndefined();
    });
  });

  describe('unknown tool handling', () => {
    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknownTool' as any, {});

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
      expect(result.summary).toContain('Unknown tool');
    });
  });

  describe('exportData', () => {
    it('should export component data', async () => {
      await component.submitTask({
        description: 'Task 1',
        priority: 'normal',
      });
      await component.submitTask({
        description: 'Task 2',
        priority: 'high',
      });

      const result = await component.exportData();

      expect(result.format).toBe('json');
      expect(result.data).toHaveProperty('config');
      expect(result.data).toHaveProperty('activeTasks');
      expect(result.data).toHaveProperty('totalTasks');
      expect(result.metadata).toHaveProperty('componentId');
      expect(result.metadata).toHaveProperty('exportedAt');
    });

    it('should respect format option', async () => {
      const result = await component.exportData({ format: 'yaml' });
      expect(result.format).toBe('yaml');
    });
  });

  describe('hook integration', () => {
    it('should trigger TASK_COMPLETED hook on success', async () => {
      const compWithHook = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        hookModule: mockHookModule,
      });

      const taskId = await compWithHook.submitTask({
        description: 'Task to complete',
        priority: 'normal',
      });

      await compWithHook.handleToolCall('reportTaskResult', {
        taskId,
        success: true,
        output: { result: 'done' },
      });

      expect(mockHookModule.executeHooks).toHaveBeenCalledWith(
        HookType.TASK_COMPLETED,
        expect.objectContaining({
          type: HookType.TASK_COMPLETED,
          taskId,
        }),
      );
    });

    it('should trigger TASK_FAILED hook on failure', async () => {
      const compWithHook = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        hookModule: mockHookModule,
      });

      const taskId = await compWithHook.submitTask({
        description: 'Task to fail',
        priority: 'normal',
      });

      await compWithHook.handleToolCall('reportTaskResult', {
        taskId,
        success: false,
        error: 'Test failure',
      });

      expect(mockHookModule.executeHooks).toHaveBeenCalledWith(
        HookType.TASK_FAILED,
        expect.objectContaining({
          type: HookType.TASK_FAILED,
          taskId,
        }),
      );
    });

    it('should handle central task completion', async () => {
      const compWithQueue = createRuntimeTaskComponent({
        instanceId: 'test-instance',
        centralTaskQueue: mockCentralTaskQueue,
        hookModule: mockHookModule,
      });

      const result = await compWithQueue.handleToolCall('reportTaskResult', {
        taskId: 'task_12345_abc',
        success: true,
        output: { result: 'central done' },
      });

      expect(result.success).toBe(true);
      expect(mockCentralTaskQueue.complete).toHaveBeenCalledWith(
        'task_12345_abc',
        expect.objectContaining({
          taskId: 'task_12345_abc',
          success: true,
        }),
      );
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
