/**
 * A2AConversationLogService - Persisted A2A conversation tracking
 *
 * Event-sourced from TopologyEvent via MessageBus.onEvent().
 * Records conversation lifecycle to database for topology visualization.
 */

import { AgentPrismaService } from 'agent-lib/core';

export interface EdgeActivity {
  from: string;
  to: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'failed';
  conversationCount: number;
  lastActivityAt: number;
}

export class A2AConversationLogService {
  private prisma: AgentPrismaService;

  constructor(prisma: AgentPrismaService) {
    this.prisma = prisma;
  }

  async create(
    conversationId: string,
    fromInstanceId: string,
    toInstanceId: string,
    runtimeTaskId?: string,
  ): Promise<void> {
    await this.prisma.a2AConversationLog.upsert({
      where: { conversationId },
      create: {
        conversationId,
        fromInstanceId,
        toInstanceId,
        ...(runtimeTaskId ? { runtimeTaskId } : {}),
      },
      update: {},
    });
  }

  async updateStatus(
    conversationId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    const data: Record<string, unknown> = { status };
    if (status === 'acknowledged') {
      data.ackAt = new Date();
    } else if (status === 'completed' || status === 'failed' || status === 'timeout') {
      data.completedAt = new Date();
    }
    if (error) {
      data.error = error;
    }

    await this.prisma.a2AConversationLog.update({
      where: { conversationId },
      data,
    }).catch(() => {
      // conversation:started event may not have been processed yet — ignore
    });
  }

  async getActiveEdges(): Promise<EdgeActivity[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    const logs = await this.prisma.a2AConversationLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });

    // Group by edge
    const edgeMap = new Map<
      string,
      {
        from: string;
        to: string;
        count: number;
        latestStatus: string;
        latestAt: Date;
      }
    >();

    for (const log of logs) {
      const key = `${log.fromInstanceId}->${log.toInstanceId}`;
      let entry = edgeMap.get(key);
      if (!entry) {
        entry = {
          from: log.fromInstanceId,
          to: log.toInstanceId,
          count: 0,
          latestStatus: log.status,
          latestAt: log.createdAt,
        };
        edgeMap.set(key, entry);
      }
      entry.count++;

      // First log is latest (ordered desc)
      if (entry.count === 1) {
        entry.latestStatus = log.status;
        entry.latestAt = log.createdAt;
      }
    }

    return Array.from(edgeMap.values()).map((entry) => {
      let status: 'pending' | 'acknowledged' | 'completed' | 'failed';
      if (entry.latestStatus === 'pending') {
        status = 'pending';
      } else if (entry.latestStatus === 'acknowledged') {
        status = 'acknowledged';
      } else if (entry.latestStatus === 'completed') {
        status = 'completed';
      } else {
        status = 'failed';
      }

      return {
        from: entry.from,
        to: entry.to,
        status,
        conversationCount: entry.count,
        lastActivityAt: entry.latestAt.getTime(),
      };
    });
  }

  async cleanup(maxAgeDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.a2AConversationLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }
}

export function createA2AConversationLogService(
  prisma: AgentPrismaService,
): A2AConversationLogService {
  return new A2AConversationLogService(prisma);
}
