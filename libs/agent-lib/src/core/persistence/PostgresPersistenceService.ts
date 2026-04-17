/**
 * PostgreSQL 持久化服务实现
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type {
  IPersistenceService,
  PersistenceConfig,
  InstanceMetadata,
} from './types.js';
import type { Message, WorkspaceContextEntry } from '../memory/types.js';
import { AgentStatus } from '../common/types.js';
import { getLogger } from '@shared/logger';

export class PostgresPersistenceService implements IPersistenceService {
  private config: PersistenceConfig;
  private logger = getLogger('PostgresPersistenceService');
  private prisma: PrismaClient;

  constructor(config?: PersistenceConfig) {
    this.config = { autoCommit: true, ...config };
    const databaseUrl =
      this.config.databaseUrl ||
      process.env['AGENT_DATABASE_URL'] ||
      process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error(
        'Database connection URL is required. Set AGENT_DATABASE_URL or DATABASE_URL environment variable.',
      );
    }
    this.logger.info({ databaseUrl: databaseUrl.replace(/\/\/.*:.*@/, '//***:***@') }, '[PersistenceService] Connecting to database');
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    this.prisma = new PrismaClient({ adapter });
    this.logger.info('[PersistenceService] Initialized');
  }

  // ==================== AgentInstance 生命周期 ====================

  async saveInstanceMetadata(
    instanceId: string,
    data: Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    try {
      const configJson = data.config != null ? JSON.parse(JSON.stringify(data.config)) : null;
      await this.prisma.agentInstance.create({
        data: {
          instanceId,
          status: data.status,
          abortReason: data.abortReason,
          abortSource: data.abortSource,
          config: configJson,
          name: data.name,
          agentType: data.agentType,
          totalTokensIn: data.totalTokensIn ?? 0,
          totalTokensOut: data.totalTokensOut ?? 0,
          totalCost: data.totalCost ?? 0,
          toolUsage: data.toolUsage as object,
          consecutiveMistakeCount: data.consecutiveMistakeCount ?? 0,
          collectedErrors: data.collectedErrors as object,
          exportResult: data.exportResult as object,
          completedAt: data.completedAt,
        },
      });
    } catch (error: any) {
      this.logger.error(
        {
          instanceId,
          status: data.status,
          name: data.name,
          agentType: data.agentType,
          completedAt: data.completedAt,
          configType: typeof data.config,
          errorCode: error?.code,
          errorMeta: error?.meta,
          errorMessage: error?.message,
          errorStack: error?.stack,
        },
        '[PersistenceService] Failed to create agentInstance',
      );
      throw error;
    }

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
      abortReason: instance.abortReason ?? undefined,
      abortSource: instance.abortSource ?? undefined,
      config: instance.config as unknown,
      name: instance.name ?? undefined,
      agentType: instance.agentType ?? undefined,
      totalTokensIn: instance.totalTokensIn,
      totalTokensOut: instance.totalTokensOut,
      totalCost: instance.totalCost,
      toolUsage: instance.toolUsage as InstanceMetadata['toolUsage'],
      consecutiveMistakeCount: instance.consecutiveMistakeCount,
      collectedErrors: instance.collectedErrors as string[],
      exportResult: instance.exportResult as Record<string, unknown>,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
      completedAt: instance.completedAt ?? undefined,
    };
  }

  async updateInstanceMetadata(
    instanceId: string,
    data: Partial<
      Omit<InstanceMetadata, 'instanceId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.abortReason !== undefined) updateData.abortReason = data.abortReason;
    if (data.abortSource !== undefined) updateData.abortSource = data.abortSource;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.agentType !== undefined) updateData.agentType = data.agentType;
    if (data.totalTokensIn !== undefined) updateData.totalTokensIn = data.totalTokensIn;
    if (data.totalTokensOut !== undefined) updateData.totalTokensOut = data.totalTokensOut;
    if (data.totalCost !== undefined) updateData.totalCost = data.totalCost;
    if (data.toolUsage !== undefined) updateData.toolUsage = data.toolUsage;
    if (data.consecutiveMistakeCount !== undefined) updateData.consecutiveMistakeCount = data.consecutiveMistakeCount;
    if (data.collectedErrors !== undefined) updateData.collectedErrors = data.collectedErrors;
    if (data.exportResult !== undefined) updateData.exportResult = data.exportResult;

    // 自动设置 completedAt for aborted instances
    if (data.status === AgentStatus.Aborted) {
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

  // ==================== Memory 持久化 (Phase 2) ====================

  async saveMemory(
    instanceId: string,
    memory: {
      messages: Message[];
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
    messages: Message[];
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
      messages: memory.messages as unknown as Message[],
      workspaceContexts:
        memory.workspaceContexts as unknown as WorkspaceContextEntry[],
      config: memory.config,
    };
  }

  // ==================== ComponentState 持久化 (Phase 3) ====================

  async saveComponentState(
    instanceId: string,
    componentId: string,
    stateData: unknown,
  ): Promise<void> {
    // Verify instance exists
    const instance = await this.prisma.agentInstance.findUnique({
      where: { instanceId },
    });

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    await this.prisma.componentState.upsert({
      where: {
        instanceId_componentId: {
          instanceId,
          componentId,
        },
      },
      create: {
        instanceId,
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
    const instance = await this.prisma.agentInstance.findUnique({
      where: { instanceId },
      include: {
        componentStates: {
          where: { componentId },
        },
      },
    });

    const componentState = instance?.componentStates[0];
    if (!componentState) {
      return null;
    }

    return componentState.stateData as unknown;
  }

  async getAllComponentStates(
    instanceId: string,
  ): Promise<Record<string, unknown>> {
    const instance = await this.prisma.agentInstance.findUnique({
      where: { instanceId },
      include: {
        componentStates: true,
      },
    });

    if (!instance) {
      return {};
    }

    const result: Record<string, unknown> = {};
    for (const cs of instance.componentStates) {
      result[cs.componentId] = cs.stateData as unknown;
    }

    return result;
  }

  async deleteComponentState(
    instanceId: string,
    componentId: string,
  ): Promise<void> {
    const instance = await this.prisma.agentInstance.findUnique({
      where: { instanceId },
    });

    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`);
    }

    await this.prisma.componentState.deleteMany({
      where: {
        instanceId,
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
    await this.prisma.agentInstance.update({
      where: { instanceId },
      data: { exportResult: exportResult as object },
    });

    this.logger.debug(
      { instanceId, componentCount: Object.keys(exportResult).length },
      '[PersistenceService] Export result saved',
    );
  }

  // ==================== Tool Result Blob 持久化 (Phase 5) ====================

  private readonly TOOL_RESULT_PREVIEW_SIZE = 2000;

  async saveToolResultBlob(
    instanceId: string,
    toolUseId: string,
    toolName: string,
    content: string,
  ): Promise<{ preview: string; originalSize: number }> {
    const preview = content.substring(0, this.TOOL_RESULT_PREVIEW_SIZE);
    const originalSize = content.length;

    await this.prisma.toolResultBlob.upsert({
      where: {
        instanceId_toolUseId: { instanceId, toolUseId },
      },
      create: {
        instanceId,
        toolUseId,
        toolName,
        content,
        preview,
        originalSize,
      },
      update: {
        content,
        preview,
        originalSize,
      },
    });

    this.logger.debug(
      { instanceId, toolUseId, toolName, originalSize, previewSize: preview.length },
      '[PersistenceService] Tool result blob saved',
    );

    return { preview, originalSize };
  }

  async getToolResultBlob(
    instanceId: string,
    toolUseId: string,
  ): Promise<string | null> {
    const blob = await this.prisma.toolResultBlob.findUnique({
      where: {
        instanceId_toolUseId: { instanceId, toolUseId },
      },
    });

    return blob?.content ?? null;
  }

  async deleteToolResultBlob(
    instanceId: string,
    toolUseId: string,
  ): Promise<void> {
    await this.prisma.toolResultBlob.delete({
      where: {
        instanceId_toolUseId: { instanceId, toolUseId },
      },
    }).catch(() => {
      // Ignore if not found
    });

    this.logger.debug(
      { instanceId, toolUseId },
      '[PersistenceService] Tool result blob deleted',
    );
  }

  async getToolResultBlobs(
    instanceId: string,
    toolUseIds: string[],
  ): Promise<Map<string, string>> {
    if (toolUseIds.length === 0) {
      return new Map();
    }

    const blobs = await this.prisma.toolResultBlob.findMany({
      where: {
        instanceId,
        toolUseId: { in: toolUseIds },
      },
    });

    const result = new Map<string, string>();
    for (const blob of blobs) {
      result.set(blob.toolUseId, blob.content);
    }

    return result;
  }
}
