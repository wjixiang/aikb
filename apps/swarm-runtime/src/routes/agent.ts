/**
 * Agent Routes
 *
 * HTTP API for individual agent operations.
 */

import type { FastifyPluginAsync } from 'fastify';

const responseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
    count: { type: 'number' },
    error: { type: 'string' },
  },
};

const arrayResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    count: { type: 'number' },
    error: { type: 'string' },
  },
};

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/:instanceId',
    {
      schema: {
        tags: ['agents'],
        description: 'Get details of a specific agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 404: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const agent = await fastify.agentRuntime.getAgent(resolvedId);
        if (!agent)
          return reply
            .code(404)
            .send({ success: false, error: 'Agent not found' });
        const metadata = fastify.agentRuntime.getAgentMetadata(resolvedId);
        return {
          success: true,
          data: {
            instanceId: agent.instanceId,
            alias: metadata?.alias,
            status: agent.status,
            name: metadata?.name,
            type: metadata?.agentType,
          },
        };
      } catch {
        return reply
          .code(404)
          .send({ success: false, error: 'Agent not found' });
      }
    },
  );

  fastify.post(
    '/:instanceId/start',
    {
      schema: {
        tags: ['agents'],
        description: 'Start a stopped agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        await fastify.agentRuntime.startAgent(resolvedId);
        return {
          success: true,
          data: { instanceId: resolvedId, status: 'started' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.post(
    '/:instanceId/stop',
    {
      schema: {
        tags: ['agents'],
        description: 'Stop a running agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        await fastify.agentRuntime.stopAgent(resolvedId);
        return {
          success: true,
          data: { instanceId: resolvedId, status: 'stopped' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.delete(
    '/:instanceId',
    {
      schema: {
        tags: ['agents'],
        description: 'Destroy an agent completely',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        await fastify.agentRuntime.destroyAgent(resolvedId);
        return {
          success: true,
          data: { instanceId: resolvedId, status: 'destroyed' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/:instanceId/children',
    {
      schema: {
        tags: ['agents'],
        description: 'List all child agents spawned by this agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: arrayResponseSchema, 400: arrayResponseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const children = await fastify.agentRuntime.listChildAgents(resolvedId);
        return { success: true, data: children, count: children.length };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/:instanceId/logs',
    {
      schema: {
        tags: ['agents'],
        description: 'Retrieve agent execution logs',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      return {
        success: true,
        data: { logs: [], message: 'Log retrieval not yet implemented' },
      };
    },
  );

  fastify.get(
    '/:instanceId/memory',
    {
      schema: {
        tags: ['agents'],
        description:
          'Get agent memory (conversation messages and workspace contexts)',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              default: 50,
              description: 'Max messages to return',
            },
          },
        },
        response: { 200: responseSchema, 404: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      const { limit = 50 } = request.query ?? {};
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const agent = await fastify.agentRuntime.getAgent(resolvedId);
        if (!agent)
          return reply
            .code(404)
            .send({ success: false, error: 'Agent not found' });

        const memoryModule = agent.getMemoryModule();
        const allMessages = memoryModule.getAllMessages();
        const workspaceContexts = memoryModule.getWorkspaceContexts();

        const messages = allMessages.slice(-limit).map((msg) => ({
          role: msg.role,
          content: msg.content.map((block: any) => {
            if (block.type === 'text')
              return { type: 'text', text: block.text };
            if (block.type === 'tool_use')
              return { type: 'tool_use', name: block.name, id: block.id };
            if (block.type === 'tool_result')
              return {
                type: 'tool_result',
                tool_use_id: block.tool_use_id,
                ...(block.toolName ? { toolName: block.toolName } : {}),
                ...(block.is_error ? { is_error: block.is_error } : {}),
                content:
                  typeof block.content === 'string'
                    ? block.content.slice(0, 500)
                    : block.content,
              };
            if (block.type === 'thinking')
              return {
                type: 'thinking',
                thinking: block.thinking?.slice(0, 300),
              };
            return { type: block.type };
          }),
          ts: msg.ts,
        }));

        return {
          success: true,
          data: {
            messages,
            totalMessages: allMessages.length,
            workspaceContextCount: workspaceContexts.length,
            config: memoryModule.getConfig(),
          },
        };
      } catch {
        return reply
          .code(404)
          .send({ success: false, error: 'Agent not found' });
      }
    },
  );

  fastify.get(
    '/:instanceId/workspace-contexts',
    {
      schema: {
        tags: ['agents'],
        description: 'Get agent workspace context history',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              default: 50,
              description: 'Max entries to return',
            },
          },
        },
        response: { 200: responseSchema, 404: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      const { limit = 50 } = request.query ?? {};
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const agent = await fastify.agentRuntime.getAgent(resolvedId);
        if (!agent)
          return reply
            .code(404)
            .send({ success: false, error: 'Agent not found' });

        const memoryModule = agent.getMemoryModule();
        const allContexts = memoryModule.getWorkspaceContexts();
        const contexts = allContexts.slice(-limit).map((ctx: any) => ({
          content: ctx.content,
          ts: ctx.ts,
          iteration: ctx.iteration,
          isDiff: ctx.isDiff ?? false,
          diff: ctx.diff ?? undefined,
        }));

        return {
          success: true,
          data: {
            contexts,
            totalEntries: allContexts.length,
          },
        };
      } catch {
        return reply
          .code(404)
          .send({ success: false, error: 'Agent not found' });
      }
    },
  );
};
