/**
 * TaskService - Task management service
 *
 * Provides CRUD operations for runtime tasks using Prisma
 */

import { AgentPrismaService } from 'agent-lib/core';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateTaskInput {
  description: string;
  targetInstanceId: string;
  input?: unknown;
  priority?: TaskPriority;
}

export interface TaskFilter {
  status?: TaskStatus;
  targetInstanceId?: string;
  priority?: TaskPriority;
  limit?: number;
  offset?: number;
}

export interface TaskRecord {
  id: string;
  taskId: string;
  description: string;
  input: unknown;
  priority: string;
  status: string;
  targetInstanceId: string;
  output: unknown;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
}

export class TaskService {
  private prisma: AgentPrismaService;

  constructor(prisma: AgentPrismaService) {
    this.prisma = prisma;
  }

  /**
   * Create a new task
   */
  async create(input: CreateTaskInput): Promise<TaskRecord> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const task = await this.prisma.runtimeTask.create({
      data: {
        taskId,
        description: input.description,
        targetInstanceId: input.targetInstanceId,
        input: input.input as any,
        priority: input.priority ?? 'normal',
        status: 'pending',
      },
    });
    return task as TaskRecord;
  }

  /**
   * Get a task by taskId
   */
  async getByTaskId(taskId: string): Promise<TaskRecord | null> {
    const task = await this.prisma.runtimeTask.findUnique({
      where: { taskId },
    });
    return task as TaskRecord | null;
  }

  /**
   * Get a task by internal id
   */
  async getById(id: string): Promise<TaskRecord | null> {
    const task = await this.prisma.runtimeTask.findUnique({
      where: { id },
    });
    return task as TaskRecord | null;
  }

  /**
   * List tasks with optional filtering
   */
  async list(
    filter: TaskFilter = {},
  ): Promise<{ tasks: TaskRecord[]; total: number }> {
    const where: any = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.targetInstanceId) {
      where.targetInstanceId = filter.targetInstanceId;
    }
    if (filter.priority) {
      where.priority = filter.priority;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.runtimeTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      }),
      this.prisma.runtimeTask.count({ where }),
    ]);

    return {
      tasks: tasks as TaskRecord[],
      total,
    };
  }

  /**
   * Update task status to processing
   */
  async markProcessing(taskId: string): Promise<TaskRecord | null> {
    const task = await this.prisma.runtimeTask.update({
      where: { taskId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });
    return task as TaskRecord | null;
  }

  /**
   * Update task status to completed with result
   */
  async markCompleted(
    taskId: string,
    output: unknown,
  ): Promise<TaskRecord | null> {
    const task = await this.prisma.runtimeTask.update({
      where: { taskId },
      data: {
        status: 'completed',
        output: output as any,
        completedAt: new Date(),
      },
    });
    return task as TaskRecord | null;
  }

  /**
   * Update task status to failed with error
   */
  async markFailed(taskId: string, error: string): Promise<TaskRecord | null> {
    const task = await this.prisma.runtimeTask.update({
      where: { taskId },
      data: {
        status: 'failed',
        error,
        completedAt: new Date(),
      },
    });
    return task as TaskRecord | null;
  }

  /**
   * Delete a task
   */
  async delete(taskId: string): Promise<boolean> {
    try {
      await this.prisma.runtimeTask.delete({
        where: { taskId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete multiple tasks by filter
   */
  async deleteMany(filter: {
    status?: TaskStatus;
    before?: Date;
  }): Promise<number> {
    const where: any = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.before) {
      where.createdAt = { lt: filter.before };
    }

    const result = await this.prisma.runtimeTask.deleteMany({ where });
    return result.count;
  }

  /**
   * Get task statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
    byPriority: Record<TaskPriority, number>;
  }> {
    const [total, statusCounts, priorityCounts] = await Promise.all([
      this.prisma.runtimeTask.count(),
      this.prisma.runtimeTask.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.runtimeTask.groupBy({
        by: ['priority'],
        _count: true,
      }),
    ]);

    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    const byPriority: Record<TaskPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
    };

    for (const item of statusCounts) {
      if (item.status in byStatus) {
        byStatus[item.status as TaskStatus] = item._count;
      }
    }

    for (const item of priorityCounts) {
      if (item.priority in byPriority) {
        byPriority[item.priority as TaskPriority] = item._count;
      }
    }

    return { total, byStatus, byPriority };
  }
}

/**
 * Create TaskService instance
 */
export function createTaskService(prisma: AgentPrismaService): TaskService {
  return new TaskService(prisma);
}
