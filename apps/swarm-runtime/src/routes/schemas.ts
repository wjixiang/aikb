/**
 * JSON Schema definitions for Fastify routes
 */

// ============================================
// Base Response Schemas
// ============================================
export const baseResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
    count: { type: 'number' },
    serverId: { type: 'string' },
    error: { type: 'string' },
  },
};

export const baseArrayResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
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
          metadata: { type: 'object' },
        },
      },
    },
    count: { type: 'number' },
    serverId: { type: 'string' },
    error: { type: 'string' },
  },
};

export const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    service: { type: 'string' },
    serverId: { type: 'string' },
    timestamp: { type: 'string' },
    uptime: { type: 'number' },
    message: { type: 'string' },
  },
};

export const metricsResponseSchema = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        port: { type: 'number' },
        uptime: { type: 'number' },
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number' },
            heapTotal: { type: 'number' },
            heapUsed: { type: 'number' },
            external: { type: 'number' },
            arrayBuffers: { type: 'number' },
          },
        },
        cpu: {
          type: 'object',
          properties: {
            usagePercent: { type: 'number' },
            cores: { type: 'number' },
            model: { type: 'string' },
            loadAvg: { type: 'array', items: { type: 'number' } },
          },
        },
        system: {
          type: 'object',
          properties: {
            hostname: { type: 'string' },
            platform: { type: 'string' },
            arch: { type: 'string' },
            totalMemory: { type: 'number' },
            freeMemory: { type: 'number' },
            usedMemory: { type: 'number' },
          },
        },
        timestamp: { type: 'string' },
      },
    },
    runtime: {
      type: 'object',
      properties: {
        agents: { type: 'object', additionalProperties: true },
        topology: { type: 'object', additionalProperties: true },
      },
      nullable: true,
    },
  },
};

// ============================================
// Agent Schemas
// ============================================
export const agentFilterSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    type: { type: 'string' },
    name: { type: 'string' },
  },
};

export const instanceIdParamsSchema = {
  type: 'object',
  properties: {
    instanceId: { type: 'string', description: 'Agent instance ID' },
  },
  required: ['instanceId'],
};

// ============================================
// Task Management Schemas
// ============================================
export const taskStatusSchema = {
  type: 'string',
  enum: ['pending', 'processing', 'completed', 'failed'],
};

export const taskPrioritySchema = {
  type: 'string',
  enum: ['low', 'normal', 'high', 'urgent'],
  description: '[Optional] Task priority level',
};

export const taskIdParamsSchema = {
  type: 'object',
  properties: {
    taskId: { type: 'string', description: 'Task ID' },
  },
  required: ['taskId'],
};

export const taskFilterSchema = {
  type: 'object',
  properties: {
    status: taskStatusSchema,
    targetInstanceId: { type: 'string' },
    priority: taskPrioritySchema,
    limit: { type: 'number', minimum: 1, maximum: 100 },
    offset: { type: 'number', minimum: 0 },
  },
};

export const createTaskBodySchema = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      minLength: 1,
      description: '[Required] Task description',
    },
    targetInstanceId: {
      type: 'string',
      minLength: 1,
      description: '[Required] Target agent instance ID',
    },
    input: {
      type: 'object',
      additionalProperties: true,
      description: '[Optional] Task input data (must be object)',
    },
    priority: {
      ...taskPrioritySchema,
      description: '[Optional] Task priority (default: normal)',
    },
  },
  required: ['description', 'targetInstanceId'],
};

export const taskRecordSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    taskId: { type: 'string' },
    description: { type: 'string' },
    input: { type: 'object', nullable: true },
    priority: taskPrioritySchema,
    status: taskStatusSchema,
    targetInstanceId: { type: 'string' },
    output: { type: 'object', nullable: true },
    error: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
    startedAt: { type: 'string', format: 'date-time', nullable: true },
    completedAt: { type: 'string', format: 'date-time', nullable: true },
    expiresAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

export const taskListResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: taskRecordSchema,
    },
    total: { type: 'number' },
    error: { type: 'string' },
  },
};

export const taskStatsDataSchema = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    byStatus: {
      type: 'object',
      properties: {
        pending: { type: 'number' },
        processing: { type: 'number' },
        completed: { type: 'number' },
        failed: { type: 'number' },
      },
    },
    byPriority: {
      type: 'object',
      properties: {
        low: { type: 'number' },
        normal: { type: 'number' },
        high: { type: 'number' },
        urgent: { type: 'number' },
      },
    },
  },
};

export const taskStatsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: taskStatsDataSchema,
    error: { type: 'string' },
  },
};

export const deleteTasksBodySchema = {
  type: 'object',
  properties: {
    status: taskStatusSchema,
    before: { type: 'string', format: 'date-time' },
  },
};
