/**
 * Prisma Expert Persistence Store
 *
 * PostgreSQL-backed implementation using Prisma
 */

import type { ExpertInstanceState, IExpertPersistenceStore } from './ExpertPersistenceStore.js';
import type { AgentPrismaService } from '../../prisma/AgentPrismaService.js';
import type { ExpertStatus } from '../types.js';

export class PrismaExpertPersistenceStore implements IExpertPersistenceStore {
  constructor(private prisma: AgentPrismaService) {}

  async saveInstance(state: ExpertInstanceState): Promise<void> {
    const { expertClassId, instanceId, status, lastUnreadCount, lastCheckTimestamp, pollInterval, consecutiveErrors } = state;

    await this.prisma.expertInstance.upsert({
      where: {
        expertClassId_instanceId: {
          expertClassId,
          instanceId,
        },
      },
      update: {
        status,
        lastUnreadCount,
        lastCheckTimestamp,
        pollInterval,
        consecutiveErrors,
      },
      create: {
        expertClassId,
        instanceId,
        status,
        lastUnreadCount,
        lastCheckTimestamp,
        pollInterval,
        consecutiveErrors,
      },
    });
  }

  async loadInstance(expertClassId: string, instanceId: string): Promise<ExpertInstanceState | null> {
    const result = await this.prisma.expertInstance.findUnique({
      where: {
        expertClassId_instanceId: {
          expertClassId,
          instanceId,
        },
      },
    });

    if (!result) {
      return null;
    }

    return this.mapToState(result);
  }

  async listInstances(expertClassId?: string): Promise<ExpertInstanceState[]> {
    const where = expertClassId ? { expertClassId } : {};

    const results = await this.prisma.expertInstance.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return results.map(this.mapToState);
  }

  async deleteInstance(expertClassId: string, instanceId: string): Promise<void> {
    await this.prisma.expertInstance.delete({
      where: {
        expertClassId_instanceId: {
          expertClassId,
          instanceId,
        },
      },
    });
  }

  async listRunningInstances(): Promise<ExpertInstanceState[]> {
    const results = await this.prisma.expertInstance.findMany({
      where: {
        status: 'running',
      },
      orderBy: { createdAt: 'asc' },
    });

    return results.map(this.mapToState);
  }

  private mapToState(record: {
    expertClassId: string;
    instanceId: string;
    status: string;
    lastUnreadCount: number;
    lastCheckTimestamp: Date;
    pollInterval: number;
    consecutiveErrors: number;
  }): ExpertInstanceState {
    return {
      expertClassId: record.expertClassId,
      instanceId: record.instanceId,
      status: record.status as ExpertStatus,
      lastUnreadCount: record.lastUnreadCount,
      lastCheckTimestamp: record.lastCheckTimestamp,
      pollInterval: record.pollInterval,
      consecutiveErrors: record.consecutiveErrors,
    };
  }
}