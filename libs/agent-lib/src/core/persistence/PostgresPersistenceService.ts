/**
 * PostgreSQL 持久化服务实现
 */

import { injectable, inject, optional } from 'inversify';
import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  IPersistenceService,
  AgentSessionData,
  PersistenceConfig,
} from './types.js';
import pino from 'pino';

@injectable()
export class PostgresPersistenceService implements IPersistenceService {
  private config: PersistenceConfig;
  private logger: pino.Logger;

  constructor(
    @inject('PrismaClient') private prisma: PrismaClient,
    @inject('PersistenceConfig') @optional() config?: PersistenceConfig,
  ) {
    this.config = { enabled: true, autoCommit: true, ...config };
    this.logger = pino({ level: process.env['LOG_LEVEL'] || 'info' });
    this.logger.info('[PersistenceService] Initialized', {
      enabled: this.config.enabled,
    });
  }

  async createSession(data: AgentSessionData): Promise<string> {
    const session = await this.prisma.agentSession.create({
      data: {
        taskId: data.taskId,
        status: data.status,
        abortReason: data.abortReason,
        abortSource: data.abortSource,
        config: data.config as object,
        totalTokensIn: data.totalTokensIn,
        totalTokensOut: data.totalTokensOut,
        totalCost: data.totalCost,
        toolUsage: data.toolUsage as object,
        consecutiveMistakeCount: data.consecutiveMistakeCount,
        collectedErrors: data.collectedErrors,
        completedAt: data.completedAt,
      },
    });

    this.logger.info('[PersistenceService] Session created', {
      taskId: data.taskId,
    });
    return session.id;
  }

  async getSession(taskId: string): Promise<AgentSessionData | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { taskId },
    });

    if (!session) {
      return null;
    }

    return {
      taskId: session.taskId,
      status: session.status as AgentSessionData['status'],
      abortReason: session.abortReason ?? undefined,
      abortSource: session.abortSource ?? undefined,
      config: session.config as AgentSessionData['config'],
      totalTokensIn: session.totalTokensIn,
      totalTokensOut: session.totalTokensOut,
      totalCost: session.totalCost,
      toolUsage: session.toolUsage as AgentSessionData['toolUsage'],
      consecutiveMistakeCount: session.consecutiveMistakeCount,
      collectedErrors: session.collectedErrors as string[],
      completedAt: session.completedAt ?? undefined,
    };
  }

  async updateSession(
    taskId: string,
    data: Partial<AgentSessionData>,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.abortReason !== undefined)
      updateData.abortReason = data.abortReason;
    if (data.abortSource !== undefined)
      updateData.abortSource = data.abortSource;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.totalTokensIn !== undefined)
      updateData.totalTokensIn = data.totalTokensIn;
    if (data.totalTokensOut !== undefined)
      updateData.totalTokensOut = data.totalTokensOut;
    if (data.totalCost !== undefined) updateData.totalCost = data.totalCost;
    if (data.toolUsage !== undefined) updateData.toolUsage = data.toolUsage;
    if (data.consecutiveMistakeCount !== undefined)
      updateData.consecutiveMistakeCount = data.consecutiveMistakeCount;
    if (data.collectedErrors !== undefined)
      updateData.collectedErrors = data.collectedErrors;

    // 自动设置 completedAt
    if (data.status === 'completed' || data.status === 'aborted') {
      updateData.completedAt = new Date();
    }

    await this.prisma.agentSession.update({
      where: { taskId },
      data: updateData,
    });

    this.logger.debug('[PersistenceService] Session updated', {
      taskId,
      fields: Object.keys(updateData),
    });
  }

  async deleteSession(taskId: string): Promise<void> {
    await this.prisma.agentSession.delete({
      where: { taskId },
    });

    this.logger.info('[PersistenceService] Session deleted', { taskId });
  }

  async listSessions(options?: {
    status?: AgentSessionData['status'];
    limit?: number;
    offset?: number;
  }): Promise<AgentSessionData[]> {
    const sessions = await this.prisma.agentSession.findMany({
      where: options?.status ? { status: options.status } : undefined,
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => ({
      taskId: s.taskId,
      status: s.status as AgentSessionData['status'],
      abortReason: s.abortReason ?? undefined,
      abortSource: s.abortSource ?? undefined,
      config: s.config as AgentSessionData['config'],
      totalTokensIn: s.totalTokensIn,
      totalTokensOut: s.totalTokensOut,
      totalCost: s.totalCost,
      toolUsage: s.toolUsage as AgentSessionData['toolUsage'],
      consecutiveMistakeCount: s.consecutiveMistakeCount,
      collectedErrors: s.collectedErrors as string[],
      completedAt: s.completedAt ?? undefined,
    }));
  }

  async getStats(): Promise<{
    totalSessions: number;
    byStatus: Record<string, number>;
    totalCost: number;
  }> {
    const [total, statusGroups, costResult] = await Promise.all([
      this.prisma.agentSession.count(),
      this.prisma.agentSession.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.agentSession.aggregate({
        _sum: { totalCost: true },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      byStatus[group.status] = group._count.id;
    }

    return {
      totalSessions: total,
      byStatus,
      totalCost: costResult._sum.totalCost ?? 0,
    };
  }

  // ==================== Memory 持久化 (Phase 2) ====================

  async saveMemory(
    sessionId: string,
    memory: {
      messages: unknown[];
      workspaceContexts: unknown[];
      config: unknown;
    },
  ): Promise<void> {
    // First, get the internal session ID from taskId
    const session = await this.prisma.agentSession.findUnique({
      where: { taskId: sessionId },
    });

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.prisma.agentMemory.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        messages: memory.messages as object,
        workspaceContexts: memory.workspaceContexts as object,
        config: memory.config as object,
      },
      update: {
        messages: memory.messages as object,
        workspaceContexts: memory.workspaceContexts as object,
        config: memory.config as object,
      },
    });

    this.logger.debug('[PersistenceService] Memory saved', { sessionId });
  }

  async loadMemory(
    sessionId: string,
  ): Promise<{
    messages: unknown[];
    workspaceContexts: unknown[];
    config: unknown;
  } | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { taskId: sessionId },
      include: { memory: true },
    });

    if (!session?.memory) {
      return null;
    }

    return {
      messages: session.memory.messages as unknown[],
      workspaceContexts: session.memory.workspaceContexts as unknown[],
      config: session.memory.config,
    };
  }
}
