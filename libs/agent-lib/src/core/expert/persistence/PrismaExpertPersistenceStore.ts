/**
 * Prisma Expert Persistence Store
 *
 * PostgreSQL-backed implementation using Prisma
 */

import type { ExpertInstanceState, IExpertPersistenceStore } from './ExpertPersistenceStore.js';
import type { AgentPrismaService } from '../../prisma/AgentPrismaService.js';
import type { AgentStatus } from '../../common/types.js';

export class PrismaExpertPersistenceStore implements IExpertPersistenceStore {
  constructor(private prisma: AgentPrismaService) {}

  async saveInstance(state: ExpertInstanceState): Promise<void> {
    const { expertClassId, instanceId, status } = state;

    await this.prisma.expertInstance.upsert({
      where: {
        expertClassId_instanceId: {
          expertClassId,
          instanceId,
        },
      },
      update: {
        status,
        agentStatus: status,
      },
      create: {
        expertClassId,
        instanceId,
        status,
        agentStatus: status,
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
    agentStatus: string;
  }): ExpertInstanceState {
    return {
      expertClassId: record.expertClassId,
      instanceId: record.instanceId,
      status: record.status as AgentStatus,
    };
  }
}