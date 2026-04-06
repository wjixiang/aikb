import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getRuntime, getCopilotAgentId } from '../services/agent-runtime.js';
import { UpstreamError } from '../errors.js';
import { prisma } from '../db.js';
import { streamAgentEvents } from '../services/agent-events.js';

const UserContextSchema = z.object({
  route: z.string(),
  itemId: z.string().optional(),
  attId: z.string().optional(),
});

const SendMessageBodySchema = z.object({
  message: z.string().min(1).max(4000),
  context: UserContextSchema.optional(),
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

async function buildContextBlock(context: z.infer<typeof UserContextSchema>): Promise<string> {
  const parts: string[] = [];
  parts.push(`[User Context]`);
  parts.push(`- Page: ${context.route}`);

  if (context.itemId) {
    const item = await prisma.item.findUnique({
      where: { id: context.itemId },
      include: { tags: { include: { tag: true } } },
    });
    if (item) {
      const authors = item.authors?.join(', ') || 'Unknown';
      const year = item.year ?? '';
      parts.push(`- Viewing: "${item.title}"${year ? ` (${year})` : ''} by ${authors}`);
      if (item.abstract) {
        parts.push(`- Abstract: ${item.abstract.length > 300 ? item.abstract.slice(0, 300) + '...' : item.abstract}`);
      }
      if (item.tags.length > 0) {
        parts.push(`- Tags: ${item.tags.map((t) => (t as { tag: { name: string } }).tag.name).join(', ')}`);
      }
      if (item.doi) parts.push(`- DOI: ${item.doi}`);
      if (item.pmid) parts.push(`- PMID: ${String(item.pmid)}`);
    }
  }

  if (context.attId) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: context.attId },
    });
    if (attachment) {
      parts.push(`- Attachment: ${attachment.fileName}`);
    }
  }

  return parts.join('\n') + '\n';
}

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
      const { message, context } = request.body;

      try {
        const runtime = getRuntime();
        const agentId = getCopilotAgentId();
        const client = runtime.getRuntimeClient('bib-max-server');

        const enrichedMessage = context
          ? `${await buildContextBlock(context)}\n${message}`
          : message;

        const result = await client.sendA2AQuery(agentId, enrichedMessage, {
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

  app.withTypeProvider<ZodTypeProvider>().post(
    '/chat/messages/stream',
    {
      schema: {
        body: SendMessageBodySchema,
        tags: ['Chat'],
        summary: 'Stream copilot agent response via SSE',
        description: 'Send a message and receive real-time SSE events: agent.status, message.added, tool.started, tool.completed, completed, error.',
      },
    },
    async (request, reply) => {
      const { message, context } = request.body;

      try {
        const runtime = getRuntime();
        const agentId = getCopilotAgentId();

        const enrichedMessage = context
          ? `${await buildContextBlock(context)}\n${message}`
          : message;

        await streamAgentEvents({
          runtime,
          agentId,
          message: enrichedMessage,
          reply,
        });
      } catch (err) {
        if (err instanceof UpstreamError) throw err;
        const msg = err instanceof Error ? err.message : 'Failed to stream agent events';
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
