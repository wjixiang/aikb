/**
 * PostgreSQL 持久化服务实现
 */

import { injectable, inject, optional } from 'inversify';
import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  IPersistenceService,
  AgentSessionData,
  PersistenceConfig,
  InstanceMetadata,
} from './types.js';
import type { ApiMessage, WorkspaceContextEntry } from '../memory/types.js';
import { TYPES } from '../di/types.js';
import pino from 'pino';

@injectable()
export class PostgresPersistenceService implements IPersistenceService {
  private config: PersistenceConfig;
  private logger: pino.Logger;

  constructor(
    @inject(TYPES.PrismaClient) private prisma: PrismaClient,
    @inject(TYPES.PersistenceConfig) @optional() config?: PersistenceConfig,
  ) {
    this.config = { autoCommit: true, ...config };
    this.logger = pino({ level: process.env['LOG_LEVEL'] || 'info' });
    this.logger.info(
      '[PersistenceService] Initialized',
    );
  }

  async createSession(data: AgentSessionData): Promise<string> {
    const session = await this.prisma.agentSession.create({
      data: {
        instanceId: data.instanceId,
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

    this.logger.info(
      { instanceId: data.instanceId },
      '[PersistenceService] Session created',
    );
    return session.id;
  }

  async getSession(instanceId: string): Promise<AgentSessionData | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { instanceId },
    });

    if (!session) {
      return null;
    }

    return {
      instanceId: session.instanceId,
      status: session.status as AgentSessionData['status'],
      abortReason: session.abortReason ?? undefined,
      abortSource: session.abortSource ?? undefined,
      config: session.config as unknown as AgentSessionData['config'],
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
    instanceId: string,
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
      where: { instanceId },
      data: updateData,
    });

    this.logger.debug(
      { instanceId, fields: Object.keys(updateData) },
      '[PersistenceService] Session updated',
    );
  }

  async deleteSession(instanceId: string): Promise<void> {
    await this.prisma.agentSession.delete({
      where: { instanceId },
    });

    this.logger.info({ instanceId }, '[PersistenceService] Session deleted');
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
      instanceId: s.instanceId,
      status: s.status as AgentSessionData['status'],
      abortReason: s.abortReason ?? undefined,
      abortSource: s.abortSource ?? undefined,
      config: s.config as unknown as AgentSessionData['config'],
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
    instanceId: string,
    memory: {
      messages: ApiMessage[];
      workspaceContexts: WorkspaceContextEntry[];
      config: unknown;
    },
  ): Promise<void> {
    // Verify instance exists
    const instance = await this.prisma.agentInstance.findUnique({
      where: { instanceId },
    });

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    await this.prisma.agentMemory.upsert({
      where: { instanceId },
      create: {
        instanceId,
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

    this.logger.debug({ instanceId }, '[PersistenceService] Memory saved');
  }

  async loadMemory(instanceId: string): Promise<{
    messages: ApiMessage[];
    workspaceContexts: WorkspaceContextEntry[];
    config: unknown;
  } | null> {
    const memory = await this.prisma.agentMemory.findUnique({
      where: { instanceId },
    });

    if (!memory) {
      return null;
    }

    return {
      messages: memory.messages as unknown as ApiMessage[],
      workspaceContexts: memory.workspaceContexts as unknown as WorkspaceContextEntry[],
      config: memory.config,
    };
  }

  // ==================== AgentInstance 生命周期 ====================

  async saveInstanceMetadata(
    instanceId: string,
    data: Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    await this.prisma.agentInstance.create({
      data: {
        instanceId,
        status: data.status,
        config: data.config as object,
        name: data.name,
        agentType: data.agentType,
        completedAt: data.completedAt,
      },
    });

    this.logger.info(
      { instanceId, name: data.name, agentType: data.agentType },
      '[PersistenceService] Instance metadata saved',
    );
  }

  async getInstanceMetadata(
    instanceId: string,
  ): Promise<InstanceMetadata | null> {
    const instance = await this.prisma.agentInstance.findUnique({
      where: { instanceId },
    });

    if (!instance) {
      return null;
    }

    return {
      instanceId: instance.instanceId,
      status: instance.status as InstanceMetadata['status'],
      config: instance.config as unknown,
      name: instance.name ?? undefined,
      agentType: instance.agentType ?? undefined,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      completedAt: instance.completedAt ?? undefined,
    };
  }

  async updateInstanceMetadata(
    instanceId: string,
    data: Partial<Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.agentType !== undefined) updateData.agentType = data.agentType;

    // 自动设置 completedAt
    if (data.status === 'completed' || data.status === 'aborted') {
      updateData.completedAt = new Date();
    }

    await this.prisma.agentInstance.update({
      where: { instanceId },
      data: updateData,
    });

    this.logger.debug(
      { instanceId, fields: Object.keys(updateData) },
      '[PersistenceService] Instance metadata updated',
    );
  }

  // ==================== ComponentState 持久化 (Phase 3) ====================

  async saveComponentState(
    instanceId: string,
    componentId: string,
    stateData: unknown,
  ): Promise<void> {
    // First, get the internal session ID from instanceId
    const session = await this.prisma.agentSession.findUnique({
      where: { instanceId },
    });

    if (!session) {
      throw new Error(`Session not found for instance: ${instanceId}`);
    }

    await this.prisma.componentState.upsert({
      where: {
        sessionId_componentId: {
          sessionId: session.id,
          componentId,
        },
      },
      create: {
        sessionId: session.id,
        componentId,
        stateData: stateData as object,
      },
      update: {
        stateData: stateData as object,
      },
    });

    this.logger.debug(
      { instanceId, componentId },
      '[PersistenceService] Component state saved',
    );
  }

  async getComponentState(
    instanceId: string,
    componentId: string,
  ): Promise<unknown | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { instanceId },
      include: {
        componentStates: {
          where: { componentId },
        },
      },
    });

    const componentState = session?.componentStates[0];
    if (!componentState) {
      return null;
    }

    return componentState.stateData as unknown;
  }

  async getAllComponentStates(
    instanceId: string,
  ): Promise<Record<string, unknown>> {
    const session = await this.prisma.agentSession.findUnique({
      where: { instanceId },
      include: {
        componentStates: true,
      },
    });

    if (!session) {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const cs of session.componentStates) {
      result[cs.componentId] = cs.stateData as unknown;
    }

    return result;
  }

  async deleteComponentState(
    instanceId: string,
    componentId: string,
  ): Promise<void> {
    const session = await this.prisma.agentSession.findUnique({
      where: { instanceId },
    });

    if (!session) {
      throw new Error(`Session not found for instance: ${instanceId}`);
    }

    await this.prisma.componentState.deleteMany({
      where: {
        sessionId: session.id,
        componentId,
      },
    });

    this.logger.debug(
      { instanceId, componentId },
      '[PersistenceService] Component state deleted',
    );
  }

  // ==================== Result Export 持久化 (Phase 4) ====================

  async saveExportResult(
    instanceId: string,
    exportResult: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.agentSession.update({
      where: { instanceId },
      data: { exportResult: exportResult as object },
    });

    this.logger.debug(
      { instanceId, componentCount: Object.keys(exportResult).length },
      '[PersistenceService] Export result saved',
    );
  }
}
