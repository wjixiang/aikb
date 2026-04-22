import type { FastifySchema } from 'fastify';

export const CreateAgentBodySchema = {
  type: 'object',
  required: ['agent'],
  properties: {
    agent: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string' },
        sop: { type: 'string' },
        version: { type: 'string' },
        capabilities: { type: 'array', items: { type: 'string' } },
        skills: { type: 'array', items: { type: 'string' } },
        endpoint: { type: 'string' },
        metadata: { type: 'object' },
      },
      additionalProperties: true,
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          componentClass: { type: 'string' },
        },
      },
    },
  },
} as const;

export const InjectMessageBodySchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1 },
  },
} as const;

export const ListAgentsQuerySchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    agentType: { type: 'string' },
    name: { type: 'string' },
  },
} as const;

export const AgentIdParamSchema = {
  type: 'object',
  required: ['instanceId'],
  properties: {
    instanceId: { type: 'string' },
  },
} as const;

export const createAgentSchema: FastifySchema = {
  body: CreateAgentBodySchema,
  response: {
    201: {
      type: 'object',
      properties: {
        instanceId: { type: 'string' },
      },
    },
  },
};

export const injectMessageSchema: FastifySchema = {
  params: AgentIdParamSchema,
  body: InjectMessageBodySchema,
  response: {
    200: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
      },
    },
  },
};

export const listAgentsSchema: FastifySchema = {
  querystring: ListAgentsQuerySchema,
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          instanceId: { type: 'string' },
          alias: { type: 'string' },
          status: { type: 'string' },
          name: { type: 'string' },
          agentType: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
        },
      },
    },
  },
};

export const agentActionSchema: FastifySchema = {
  params: AgentIdParamSchema,
  response: {
    200: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
      },
    },
  },
};

export const getStatsSchema: FastifySchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        totalAgents: { type: 'number' },
        agentsByStatus: {
          type: 'object',
          properties: {
            sleeping: { type: 'number' },
            running: { type: 'number' },
            aborted: { type: 'number' },
          },
        },
      },
    },
  },
};
