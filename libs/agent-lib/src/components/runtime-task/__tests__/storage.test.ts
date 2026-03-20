import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTaskStorage } from '../storage.js';
import type { RuntimeTask } from '../types.js';

describe('InMemoryTaskStorage', () => {
  let storage: InMemoryTaskStorage;

  const createTask = (overrides: Partial<RuntimeTask> = {}): RuntimeTask => ({
    taskId: `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    description: 'Test task',
    priority: 'normal',
    status: 'pending',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    storage = new InMemoryTaskStorage();
  });

  describe('add and get', () => {
    it('should add and retrieve a task', async () => {
      const task = createTask({ taskId: 'test-1' });
      await storage.add(task);

      const retrieved = await storage.get('test-1');
      expect(retrieved).toEqual(task);
    });

    it('should return undefined for non-existent task', async () => {
      const retrieved = await storage.get('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const task = createTask({ taskId: 'test-1' });
      await storage.add(task);

      await storage.update('test-1', { status: 'processing' });

      const updated = await storage.get('test-1');
      expect(updated?.status).toBe('processing');
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        storage.update('non-existent', { status: 'processing' }),
      ).rejects.toThrow('Task not found');
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      const task = createTask({ taskId: 'test-1' });
      await storage.add(task);

      await storage.delete('test-1');

      const retrieved = await storage.get('test-1');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('query', () => {
    it('should filter by status', async () => {
      await storage.add(createTask({ taskId: 't1', status: 'pending' }));
      await storage.add(createTask({ taskId: 't2', status: 'processing' }));
      await storage.add(createTask({ taskId: 't3', status: 'completed' }));

      const pending = await storage.query({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].taskId).toBe('t1');
    });

    it('should filter by receiver', async () => {
      await storage.add(createTask({ taskId: 't1', receiver: 'expert-a' }));
      await storage.add(createTask({ taskId: 't2', receiver: 'expert-b' }));

      const forA = await storage.query({ receiver: 'expert-a' });
      expect(forA).toHaveLength(1);
      expect(forA[0].taskId).toBe('t1');
    });

    it('should apply limit', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.add(createTask({ taskId: `t${i}` }));
      }

      const limited = await storage.query({ limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe('getPending', () => {
    it('should return only pending tasks', async () => {
      await storage.add(
        createTask({ taskId: 't1', status: 'pending', receiver: 'expert-a' }),
      );
      await storage.add(
        createTask({
          taskId: 't2',
          status: 'processing',
          receiver: 'expert-a',
        }),
      );
      await storage.add(
        createTask({ taskId: 't3', status: 'pending', receiver: 'expert-b' }),
      );

      const pending = await storage.getPending('expert-a');
      expect(pending).toHaveLength(1);
      expect(pending[0].taskId).toBe('t1');
    });
  });

  describe('results', () => {
    it('should save and retrieve result', async () => {
      const task = createTask({ taskId: 'test-1' });
      await storage.add(task);

      await storage.saveResult({
        taskId: 'test-1',
        success: true,
        output: { result: 'done' },
        completedAt: new Date(),
      });

      const result = await storage.getResult('test-1');
      expect(result?.success).toBe(true);
      expect(result?.output).toEqual({ result: 'done' });
    });

    it('should return undefined for non-existent result', async () => {
      const result = await storage.getResult('non-existent');
      expect(result).toBeUndefined();
    });
  });
});
