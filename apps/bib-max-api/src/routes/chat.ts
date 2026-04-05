import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getRuntime, getCopilotAgentId } from '../services/agent-runtime.js';
import { UpstreamError } from '../errors.js';

const SendMessageBodySchema = z.object({
  message: z.string().min(1).max(4000),
});

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.array(z.unknown()),
  ts: z.number().optional(),
});

const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
});

const ChatStatusResponseSchema = z.object({
  status: z.string().nullable(),
  agentId: z.string().nullable(),
});

const ChatMessageResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
});

export async function registerChatRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/chat/messages',
    {
      schema: {
        body: SendMessageBodySchema,
        response: { 200: ChatMessageResponseSchema },
        tags: ['Chat'],
        summary: 'Send message to copilot agent',
        description: 'Send a message to the AI copilot agent via A2A query. May take several seconds as the agent processes the request.',
      },
    },
    async (request) => {
      const { message } = request.body;

      try {
        const runtime = getRuntime();
        const agentId = getCopilotAgentId();
        const client = runtime.getRuntimeClient('bib-max-server');
        const result = await client.sendA2AQuery(agentId, message, {
          timeout: 60000,
        });

        return { success: true, data: result };
      } catch (err) {
        if (err instanceof UpstreamError) throw err;
        const msg = err instanceof Error ? err.message : 'Failed to get response from agent';
        throw new UpstreamError(msg);
      }
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/chat/history',
    {
      schema: {
        response: { 200: ChatHistoryResponseSchema },
        tags: ['Chat'],
        summary: 'Get chat history',
        description: 'Get the copilot agent conversation history.',
      },
    },
    async () => {
      const runtime = getRuntime();
      const agentId = getCopilotAgentId();
      const agent = (await runtime.getAgent(agentId)) as {
        getMemoryModule: () => {
          getAllMessages: () => Array<{
            role: 'user' | 'assistant' | 'system';
            content: unknown[];
            ts?: number;
          }>;
        };
      } | undefined;

      if (!agent) {
        return { messages: [] };
      }

      const messages = agent.getMemoryModule().getAllMessages();
      return { messages };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/chat/status',
    {
      schema: {
        response: { 200: ChatStatusResponseSchema },
        tags: ['Chat'],
        summary: 'Get copilot agent status',
      },
    },
    async () => {
      try {
        const runtime = getRuntime();
        const agentId = getCopilotAgentId();
        const metadata = runtime.getAgentMetadata(agentId);
        return { status: metadata?.status ?? null, agentId };
      } catch {
        return { status: null, agentId: null };
      }
    },
  );
}
