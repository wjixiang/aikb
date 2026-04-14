/**
 * Prisma Plugin for Fastify
 *
 * Initializes Prisma client and TaskService
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { AgentPrismaService } from 'agent-lib/core';
import { TaskService, createTaskService } from '../services/TaskService.js';

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

  // Decorate fastify with services
  fastify.decorate('prisma', prisma);
  fastify.decorate('taskService', taskService);

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
  }
}
