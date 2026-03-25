import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const baseResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({}).passthrough().optional(),
  count: z.number().optional(),
  serverId: z.string().optional(),
  error: z.string().optional(),
});

export const baseArrayResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({}).passthrough()),
  count: z.number().optional(),
  error: z.string().optional(),
});

export const healthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  serverId: z.string(),
  timestamp: z.string(),
  uptime: z.number().optional(),
  message: z.string().optional(),
});

export const metricsResponseSchema = z.object({
  server: z.object({
    id: z.string(),
    port: z.number(),
    uptime: z.number(),
    memory: z.object({}).passthrough(),
    timestamp: z.string(),
  }),
  runtime: z
    .object({
      agents: z.object({}).passthrough(),
      topology: z.object({}).passthrough(),
    })
    .nullable(),
});

export const agentFilterSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
});

export const createAgentBodySchema = z.object({
  agent: z
    .object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
      sop: z.string().optional(),
    })
    .optional(),
  api: z
    .object({
      provider: z.string(),
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
      modelId: z.string().optional(),
    })
    .optional(),
  components: z.array(z.any()).optional(),
});

export const taskBodySchema = z.object({
  targetAgentId: z.string(),
  taskId: z.string(),
  description: z.string(),
  input: z.object({}).passthrough().optional(),
  priority: z.number().optional(),
});

export const queryBodySchema = z.object({
  targetAgentId: z.string(),
  query: z.string(),
  expectedFormat: z.string().optional(),
});

export const eventBodySchema = z.object({
  targetAgentId: z.string(),
  eventType: z.string(),
  data: z.object({}).passthrough().optional(),
});

export function toFastifySchema(schema: z.ZodType): any {
  return zodToJsonSchema(schema as any);
}
