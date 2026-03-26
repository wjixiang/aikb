/**
 * Prisma Plugin for Fastify
 *
 * Initializes Prisma client, TaskService, and A2A conversation logging
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { AgentPrismaService } from 'agent-lib/core';
import { TaskService, createTaskService } from '../services/TaskService.js';
import {
  A2AConversationLogService,
  createA2AConversationLogService,
} from '../services/A2AConversationLogService.js';

interface ConversationTaskInfo {
  runtimeTaskId: string;
  taskId: string;
}

interface TaskCallbacks {
  onTaskProcessing?: (info: ConversationTaskInfo) => void;
  onTaskCompleted?: (info: ConversationTaskInfo, result: unknown) => void;
  onTaskFailed?: (info: ConversationTaskInfo, error: string) => void;
}

export interface PrismaPluginOptions {
  databaseUrl?: string;
}

const prismaPluginFunc = async (
  fastify: any,
  options: PrismaPluginOptions,
): Promise<void> => {
  // Set database URL if provided
  if (options.databaseUrl) {
    process.env['AGENT_DATABASE_URL'] = options.databaseUrl;
  }

  // Check if database is configured
  const databaseUrl = process.env['AGENT_DATABASE_URL'];
  if (!databaseUrl) {
    fastify.log.warn(
      'AGENT_DATABASE_URL not set - Task persistence disabled. ' +
        'Set AGENT_DATABASE_URL to enable task management.',
    );
    fastify.decorate('prisma', null);
    fastify.decorate('taskService', null);
    fastify.decorate('a2aLogService', null);
    return;
  }

  // Initialize Prisma
  const prisma = new AgentPrismaService();
  await prisma.$connect();

  fastify.log.info(
    { databaseUrl: databaseUrl.replace(/:[^:@]+@/, ':****@') },
    'Prisma connected',
  );

  // Initialize services
  const taskService = createTaskService(prisma);
  const a2aLogService = createA2AConversationLogService(prisma);

  // Decorate fastify with services
  fastify.decorate('prisma', prisma);
  fastify.decorate('taskService', taskService);
  fastify.decorate('a2aLogService', a2aLogService);

  // Set up TaskCallbacks on AgentRuntime for automatic task state updates
  if (fastify.agentRuntime && taskService) {
    const taskCallbacks: TaskCallbacks = {
      onTaskProcessing: async (info: ConversationTaskInfo) => {
        try {
          await taskService.markProcessing(info.runtimeTaskId);
        } catch (error) {
          fastify.log.error(
            { error, runtimeTaskId: info.runtimeTaskId },
            'Failed to mark task as processing',
          );
        }
      },
      onTaskCompleted: async (info: ConversationTaskInfo, result: unknown) => {
        try {
          await taskService.markCompleted(info.runtimeTaskId, result);
        } catch (error) {
          fastify.log.error(
            { error, runtimeTaskId: info.runtimeTaskId },
            'Failed to mark task as completed',
          );
        }
      },
      onTaskFailed: async (info: ConversationTaskInfo, errorMsg: string) => {
        try {
          await taskService.markFailed(info.runtimeTaskId, errorMsg);
        } catch (error) {
          fastify.log.error(
            { error, runtimeTaskId: info.runtimeTaskId },
            'Failed to mark task as failed',
          );
        }
      },
    };
    fastify.agentRuntime.setTaskCallbacks(taskCallbacks);
    fastify.log.info('Task callbacks registered on AgentRuntime');

    // Subscribe to MessageBus events for A2A conversation logging
    const messageBus = fastify.agentRuntime.getMessageBus();
    messageBus.onEvent(async (event: any) => {
      try {
        switch (event.type) {
          case 'conversation:started': {
            const conv = event.payload;
            await a2aLogService.create(
              conv.conversationId,
              conv.request.from,
              conv.request.to,
            );
            break;
          }
          case 'conversation:ack':
            await a2aLogService.updateStatus(
              event.payload.conversationId,
              'acknowledged',
            );
            break;
          case 'conversation:completed':
            await a2aLogService.updateStatus(
              event.payload.conversationId,
              'completed',
            );
            break;
          case 'conversation:failed':
            await a2aLogService.updateStatus(
              event.payload.conversationId,
              'failed',
              event.payload.error,
            );
            break;
          case 'conversation:timeout':
            await a2aLogService.updateStatus(
              event.payload.conversationId,
              'timeout',
            );
            break;
        }
      } catch (error) {
        fastify.log.error(
          { error, eventType: event.type },
          'Failed to log A2A conversation',
        );
      }
    });
    fastify.log.info('A2A conversation logging enabled');
  }

  // Cleanup on close
  fastify.addHook('onClose', async (instance: any) => {
    if (instance.prisma) {
      await instance.prisma.$disconnect();
      instance.log.info('Prisma disconnected');
    }
  });
};

export const prismaPlugin = fp(
  prismaPluginFunc,
) as unknown as FastifyPluginAsync<PrismaPluginOptions>;

declare module 'fastify' {
  interface FastifyInstance {
    prisma: AgentPrismaService | null;
    taskService: TaskService | null;
    a2aLogService: A2AConversationLogService | null;
  }
}
