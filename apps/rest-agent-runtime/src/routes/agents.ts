import type { FastifyPluginAsync } from 'fastify';
import { AgentRuntime, type AgentFilter } from 'agent-lib';
import {
  createAgentSchema,
  injectMessageSchema,
  listAgentsSchema,
  agentActionSchema,
  getStatsSchema,
} from '../schemas/agents.js';

function badRequest(message: string): Error {
  const err = new Error(message);
  Object.defineProperty(err, 'statusCode', { value: 400, writable: false });
  return err;
}

function notFound(message: string): Error {
  const err = new Error(message);
  Object.defineProperty(err, 'statusCode', { value: 404, writable: false });
  return err;
}

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  const runtime: AgentRuntime = fastify.agentRuntime;

  fastify.post('/agents', { schema: createAgentSchema }, async (request, reply) => {
    const body = request.body as {
      agent?: Record<string, unknown>;
      components?: Array<Record<string, unknown>>;
    };

    const instanceId = await runtime.createAgent({
      agent: body.agent as any,
      components: body.components as any,
    });

    return reply.status(201).send({ instanceId });
  });

  fastify.get('/agents', { schema: listAgentsSchema }, async (request) => {
    const query = request.query as AgentFilter;
    const agents = await runtime.listAgents(query);
    return agents.map((a) => ({
      instanceId: a.instanceId,
      alias: a.alias,
      status: a.status,
      name: a.name,
      agentType: a.agentType,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  });

  fastify.get(
    '/agents/:instanceId',
    { schema: agentActionSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      const metadata = runtime.getAgentMetadata(instanceId);
      if (!metadata) {
        throw notFound(`Not found: ${instanceId}`);
      }
      return {
        instanceId: metadata.instanceId,
        alias: metadata.alias,
        status: metadata.status,
        name: metadata.name,
        agentType: metadata.agentType,
        description: metadata.description,
        createdAt: metadata.createdAt.toISOString(),
        updatedAt: metadata.updatedAt.toISOString(),
      };
    },
  );

  fastify.post(
    '/agents/:instanceId/start',
    { schema: agentActionSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await runtime.startAgent(instanceId);
        return { ok: true };
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : String(error));
      }
    },
  );

  fastify.post(
    '/agents/:instanceId/stop',
    { schema: agentActionSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await runtime.stopAgent(instanceId);
        return { ok: true };
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : String(error));
      }
    },
  );

  fastify.post(
    '/agents/:instanceId/sleep',
    { schema: agentActionSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await runtime.sleepAgent(instanceId);
        return { ok: true };
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : String(error));
      }
    },
  );

  fastify.post(
    '/agents/:instanceId/restore',
    { schema: agentActionSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await runtime.restoreAgent(instanceId);
        return { ok: true };
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : String(error));
      }
    },
  );

  fastify.delete(
    '/agents/:instanceId',
    { schema: agentActionSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await runtime.destroyAgent(instanceId);
        return { ok: true };
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : String(error));
      }
    },
  );

  fastify.post(
    '/agents/:instanceId/message',
    { schema: injectMessageSchema },
    async (request) => {
      const { instanceId } = request.params as { instanceId: string };
      const { message } = request.body as { message: string };
      try {
        await runtime.injectMessage(instanceId, message);
        return { ok: true };
      } catch (error) {
        throw badRequest(error instanceof Error ? error.message : String(error));
      }
    },
  );

  fastify.get('/stats', { schema: getStatsSchema }, async () => {
    return runtime.getStats();
  });
};
