/**
 * CentralTaskQueue - Central task queue for multi-agent task distribution
 *
 * Manages task lifecycle and distribution to specific agents by instanceId.
 */

import type {
  RuntimeTask,
  RuntimeTaskResult,
  TaskSubmission,
  TaskPriority,
  TaskStatus,
  ExportResult,
} from './types.js';
import { generateTaskId, isTaskExpired, getDefaultPriority } from './types.js';
import type { IPersistenceService } from '../persistence/types.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { TYPES } from '../di/types.js';
import type { Container } from 'inversify';

/**
 * ICentralTaskQueue - Interface for central task queue
 */
export interface ICentralTaskQueue {
  /**
   * Submit a new task
   * Returns the generated taskId
   */
  submit(task: TaskSubmission): Promise<string>;

  /**
   * Get all pending tasks
   */
  getPending(): Promise<RuntimeTask[]>;

  /**
   * Get pending tasks for a specific agent
   */
  getForAgent(instanceId: string): Promise<RuntimeTask[]>;

  /**
   * Get task by ID
   */
  getById(taskId: string): Promise<RuntimeTask | undefined>;

  /**
   * Mark task as processing
   */
  markProcessing(taskId: string, instanceId: string): Promise<void>;

  /**
   * Complete a task with results
   */
  complete(taskId: string, result: RuntimeTaskResult): Promise<void>;

  /**
   * Mark a task as failed
   */
  fail(taskId: string, error: string): Promise<void>;

  /**
   * Get task count by status
   */
  getTaskCount(status?: TaskStatus): Promise<number>;

  /**
   * Clean up expired tasks
   */
  cleanupExpired(): Promise<number>;
}

/**
 * CentralTaskQueue - Implementation of ICentralTaskQueue
 *
 * Uses database for persistence and maintains in-memory cache for performance.
 */
export class CentralTaskQueue implements ICentralTaskQueue {
  private prisma: PrismaClient;
  private cache: Map<string, RuntimeTask> = new Map();

  constructor(container: Container) {
    this.prisma = container.get<PrismaClient>(TYPES.PrismaClient);
  }

  async submit(task: TaskSubmission): Promise<string> {
    const taskId = generateTaskId();
    const now = new Date();

    const runtimeTask: RuntimeTask = {
      taskId,
      description: task.description,
      input: task.input,
      priority: task.priority ?? getDefaultPriority(),
      status: 'pending',
      targetInstanceId: task.targetInstanceId,
      createdAt: now,
      expiresAt: task.expiresAt,
    };

    // Persist to database
    await this.prisma.runtimeTask.create({
      data: {
        taskId,
        description: task.description,
        input: task.input ?? {},
        priority: runtimeTask.priority,
        status: 'pending',
        targetInstanceId: task.targetInstanceId,
        createdAt: now,
        expiresAt: task.expiresAt,
      },
    });

    // Update cache
    this.cache.set(taskId, runtimeTask);

    return taskId;
  }

  async getPending(): Promise<RuntimeTask[]> {
    // Try cache first
    const cached = Array.from(this.cache.values()).filter(
      (t) => t.status === 'pending' && !isTaskExpired(t),
    );

    if (cached.length > 0) {
      return cached;
    }

    // Fall back to database
    const tasks = await this.prisma.runtimeTask.findMany({
      where: {
        status: 'pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return tasks.map(this.dbToRuntimeTask);
  }

  async getForAgent(instanceId: string): Promise<RuntimeTask[]> {
    // Try cache first
    const cached = Array.from(this.cache.values()).filter(
      (t) =>
        t.status === 'pending' &&
        t.targetInstanceId === instanceId &&
        !isTaskExpired(t),
    );

    if (cached.length > 0) {
      return cached;
    }

    // Fall back to database
    const tasks = await this.prisma.runtimeTask.findMany({
      where: {
        status: 'pending',
        targetInstanceId: instanceId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return tasks.map(this.dbToRuntimeTask);
  }

  async getById(taskId: string): Promise<RuntimeTask | undefined> {
    // Try cache first
    const cached = this.cache.get(taskId);
    if (cached) {
      return cached;
    }

    // Fall back to database
    const task = await this.prisma.runtimeTask.findUnique({
      where: { taskId },
    });

    if (!task) {
      return undefined;
    }

    const runtimeTask = this.dbToRuntimeTask(task);
    this.cache.set(taskId, runtimeTask);
    return runtimeTask;
  }

  async markProcessing(taskId: string, instanceId: string): Promise<void> {
    const now = new Date();

    await this.prisma.runtimeTask.update({
      where: { taskId },
      data: {
        status: 'processing',
        startedAt: now,
      },
    });

    // Update cache
    const cached = this.cache.get(taskId);
    if (cached) {
      cached.status = 'processing';
      cached.startedAt = now;
    }
  }

  async complete(taskId: string, result: RuntimeTaskResult): Promise<void> {
    const now = new Date();

    await this.prisma.runtimeTask.update({
      where: { taskId },
      data: {
        status: 'completed',
        output: result.output ?? {},
        completedAt: now,
      },
    });

    // Update cache
    const cached = this.cache.get(taskId);
    if (cached) {
      cached.status = 'completed';
      cached.output = result.output;
      cached.completedAt = now;
    }
  }

  async fail(taskId: string, error: string): Promise<void> {
    const now = new Date();

    await this.prisma.runtimeTask.update({
      where: { taskId },
      data: {
        status: 'failed',
        error,
        completedAt: now,
      },
    });

    // Update cache
    const cached = this.cache.get(taskId);
    if (cached) {
      cached.status = 'failed';
      cached.error = error;
      cached.completedAt = now;
    }
  }

  async getTaskCount(status?: TaskStatus): Promise<number> {
    if (status) {
      return this.prisma.runtimeTask.count({
        where: { status },
      });
    }

    return this.prisma.runtimeTask.count();
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();

    const result = await this.prisma.runtimeTask.deleteMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
      },
    });

    // Clear expired from cache
    for (const [taskId, task] of this.cache) {
      if (task.status === 'pending' && isTaskExpired(task)) {
        this.cache.delete(taskId);
      }
    }

    return result.count;
  }

  /**
   * Convert database record to RuntimeTask
   */
  private dbToRuntimeTask(db: any): RuntimeTask {
    return {
      taskId: db.taskId,
      description: db.description,
      input: db.input,
      priority: db.priority as TaskPriority,
      status: db.status as TaskStatus,
      targetInstanceId: db.targetInstanceId,
      output: db.output as Record<string, ExportResult> | undefined,
      error: db.error ?? undefined,
      createdAt: db.createdAt,
      startedAt: db.startedAt ?? undefined,
      completedAt: db.completedAt ?? undefined,
      expiresAt: db.expiresAt ?? undefined,
    };
  }
}

/**
 * Create a CentralTaskQueue instance
 */
export function createCentralTaskQueue(container: Container): ICentralTaskQueue {
  return new CentralTaskQueue(container);
}
