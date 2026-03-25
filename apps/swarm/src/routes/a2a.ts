/**
 * A2A Routes
 *
 * HTTP API for Agent-to-Agent communication.
 * Maps HTTP endpoints to RuntimeControlClient A2A methods.
 *
 * Endpoints:
 * - POST /api/a2a/task          - Send A2A task
 * - POST /api/a2a/query         - Send A2A query
 * - POST /api/a2a/event         - Send A2A event
 * - GET  /api/a2a/conversations - List A2A conversations
 * - GET  /api/a2a/conversations/:id - Get conversation details
 */

import type { FastifyPluginAsync } from 'fastify';

const SERVER_INSTANCE_ID = 'swarm-server';

export const a2aRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================
  // POST /api/a2a/task - Send A2A task
  // ============================================================
  fastify.post('/task', async (request, reply) => {
    const body = request.body as {
      targetAgentId: string;
      taskId: string;
      description: string;
      input?: Record<string, unknown>;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      timeout?: number;
    };

    const { targetAgentId, taskId, description, input = {}, priority } = body;

    try {
      // Resolve agent ID
      const resolvedId = fastify.agentRuntime.resolveAgentId(targetAgentId);

      // Get runtime client for server
      const client = fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);

      const result = await client.sendA2ATask(
        resolvedId,
        taskId,
        description,
        input,
        priority ? { priority } : undefined,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // POST /api/a2a/query - Send A2A query
  // ============================================================
  fastify.post('/query', async (request, reply) => {
    const body = request.body as {
      targetAgentId: string;
      query: string;
      expectedFormat?: string;
    };

    const { targetAgentId, query, expectedFormat } = body;

    try {
      const resolvedId = fastify.agentRuntime.resolveAgentId(targetAgentId);
      const client = fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);

      const result = await client.sendA2AQuery(
        resolvedId,
        query,
        expectedFormat ? { expectedFormat } : undefined,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // POST /api/a2a/event - Send A2A event
  // ============================================================
  fastify.post('/event', async (request, reply) => {
    const body = request.body as {
      targetAgentId: string;
      eventType: string;
      data?: unknown;
    };

    const { targetAgentId, eventType, data } = body;

    try {
      const resolvedId = fastify.agentRuntime.resolveAgentId(targetAgentId);
      const client = fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);

      await client.sendA2AEvent(resolvedId, eventType, data);

      return {
        success: true,
        data: {
          message: 'Event sent successfully',
        },
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /api/a2a/conversations - List A2A conversations
  // ============================================================
  fastify.get('/conversations', async (request, reply) => {
    const { status } = request.query as { status?: string };

    // TODO: Get conversations from MessageBus
    // For now, return empty list
    return {
      success: true,
      data: [],
      count: 0,
    };
  });

  // ============================================================
  // GET /api/a2a/conversations/:id - Get conversation details
  // ============================================================
  fastify.get<{ Params: { id: string } }>(
    '/conversations/:id',
    async (request, reply) => {
      const { id } = request.params;

      // TODO: Get conversation from MessageBus
      return reply.code(404).send({
        success: false,
        error: 'Conversation not found',
      });
    },
  );
};
