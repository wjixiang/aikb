import type { FastifyInstance } from 'fastify';
import type { IAgentRuntime, AgentRuntimeConfig, RuntimeControlProviderSettings } from 'agent-lib/core';
import type { BibToolsDeps } from 'bib-copilot';
import type { ItemQuery, CreateItemInput, UpdateItemInput } from 'bib-item-plugin';
import { ItemService, AttachmentService } from 'bib-item-plugin';
import { config } from '../config.js';
import * as tagService from './tag.service.js';
import { createItemRepository } from '../adapters/item-repository.js';
import { createAttachmentRepository } from '../adapters/attachment-repository.js';
import { getStorage } from '../storage/instance.js';
import type { IStorageService } from '../storage/types.js';
import { NotFoundError } from '../errors.js';

// ============ Copilot SOP ============

const COPILOT_SOP = `You are a knowledgeable assistant for the Bib-Max bibliography management system. You help users search, create, update, and organize their literature collection.

## Workspace Context

Your Workspace is rendered in real-time and reflects the user's current browsing state. When a user is viewing an item or attachment, you will see this context automatically in the user's message — including the item title, authors, abstract, tags, DOI, PMID, and the currently opened attachment.

**IMPORTANT:** Do NOT call get_item or get_item_attachments to retrieve information that is already visible in the Workspace context. Only call these tools when you need data for a DIFFERENT item than the one currently being viewed.

## Answering Questions About Papers

The quality of your answers depends on reading the actual paper content. Follow this approach:

1. **Check the workspace context** — the user's current item metadata and abstract are already available to you.
2. **Read the full paper** using read_markdown — start from page 1 and read ALL pages until the end. Do not stop after one or two pages.
3. **Think deeply** about what you've read — analyze the methodology, findings, data, and conclusions.
4. **Provide thorough answers** — reference specific sections, data points, or quotes from the paper. Vague or generic answers based only on the abstract are unacceptable.

## Workflow

When you wake up and receive a message:
1. Use checkInbox to see the user's message
2. Review the Workspace context — it contains the user's current browsing state
3. If the question is about a specific paper, use read_markdown to read its full text
4. Process the request using the available KB tools
5. When done, call attempt_completion with your final response to the user
6. Then call sleep to wait for the next message

## Guidelines

- When searching, use reasonable page sizes (5-10 items)
- Always confirm with the user before destructive operations (deleting items)
- When creating items, gather required information (at minimum: title)
- If you need tag IDs, first use list_tags to find available tags
- Present search results in a clear, concise format
- Respond in the same language as the user
- ALWAYS use attempt_completion (not completeTask) to finish a task. completeTask does not exist.`;

// ============ State ============

let runtime: IAgentRuntime | null = null;
let copilotAgentId: string | null = null;

export function getRuntime(): IAgentRuntime {
  if (!runtime) throw new Error('Agent runtime not initialized');
  return runtime;
}

export function getCopilotAgentId(): string {
  if (!copilotAgentId) {
    const reason = !config.llm.clients.length
      ? 'No LLM client configured (set LLM_CLIENTS or LLM_API_KEY env var)'
      : !config.agent.databaseUrl
        ? 'AGENT_DATABASE_URL not configured'
        : 'Agent runtime initialization failed';
    throw new Error(`Copilot agent not created: ${reason}`);
  }
  return copilotAgentId;
}

// ============ Helpers ============

function resolveApiConfig(): RuntimeControlProviderSettings | undefined {
  const clients = config.llm.clients;
  if (clients.length === 0) return undefined;

  const client = clients[0]!;
  const settings: RuntimeControlProviderSettings = {
    apiProvider: client.provider as RuntimeControlProviderSettings['apiProvider'],
    apiKey: client.apiKey,
    apiModelId: client.modelId,
    apiTimeout: 120000,
  };

  if (client.baseUrl) {
    settings.apiBaseUrl = client.baseUrl;
  }

  return settings;
}

/**
 * Test that the database URL is reachable before handing it to agent-lib.
 */
async function testDatabaseConnection(url: string): Promise<boolean> {
  const pg = await import('pg');
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    client.end();
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AgentRuntime] Database connection test failed: ${msg}`);
    return false;
  }
}

// ============ Initialization ============

export async function initAgentRuntime(): Promise<void> {
  // 1. Validate prerequisites
  if (config.llm.clients.length === 0) {
    console.error('[AgentRuntime] ERROR: No LLM client configured. Set LLM_CLIENTS or LLM_API_KEY env var.');
    return;
  }

  const dbUrl = config.agent.databaseUrl;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('[AgentRuntime] ERROR: AGENT_DATABASE_URL not set or invalid. Agent runtime requires a PostgreSQL database URL.');
    return;
  }

  // 2. Pre-validate database connectivity
  console.log('[AgentRuntime] Testing database connection...');
  const dbOk = await testDatabaseConnection(dbUrl);
  if (!dbOk) {
    console.error('[AgentRuntime] ERROR: Cannot connect to AGENT_DATABASE_URL. Skipping agent runtime.');
    return;
  }

  // 3. Dynamic imports — defer module loading to avoid side effects at import time.
  //    agent-lib's PersistenceService auto-initializes on module import, which would
  //    try to connect to the database before we can validate it.
  const { createAgentRuntime } = await import('agent-lib/core');
  const { ClientPool } = await import('llm-api-client');
  const { BibToolsComponent } = await import('bib-copilot');
  const { LifecycleComponent } = await import('component-hub');

  // 4. Create and start runtime
  const apiConfig = resolveApiConfig();
  const runtimeConfig: AgentRuntimeConfig = {
    clientPool: ClientPool.getInstance(),
    defaultApiConfig: apiConfig,
    persistence: { databaseUrl: dbUrl },
    messageBus: { mode: 'memory' },
  };

  try {
    runtime = createAgentRuntime(runtimeConfig);
    await runtime.start();
  } catch (err) {
    console.error('[AgentRuntime] ERROR: Failed to create/start agent runtime:');
    console.error(err);
    return;
  }

  // 5. Create copilot agent with KB tools + A2A/lifecycle components
  try {
    const notFoundError = (entity: string, id: string) => new NotFoundError(entity, id);
    const itemSvc = new ItemService(createItemRepository(), getStorage(), notFoundError);
    const attachmentSvc = new AttachmentService(createAttachmentRepository(), getStorage(), {
      keyPrefix: 'attachments',
      presignTtl: 3600,
      notFoundError,
    });

    const bibTools = new BibToolsComponent({
      listItems: (query: Record<string, unknown>) => itemSvc.listItems(query as ItemQuery),
      getItemById: (id: string) => itemSvc.getItemById(id),
      createItem: (data: Record<string, unknown>) => itemSvc.createItem(data as unknown as CreateItemInput),
      updateItem: (id: string, data: Record<string, unknown>) => itemSvc.updateItem(id, data as UpdateItemInput),
      removeItem: (id: string) => itemSvc.removeItem(id),
      listTags: (query: Record<string, unknown>) => tagService.listTags(query as tagService.TagQuery),
      createTag: (data: Record<string, unknown>) => tagService.createTag(data as unknown as tagService.CreateTagInput),
      listAttachments: (itemId: string) => attachmentSvc.listAttachments(itemId),
      getAttachmentRecord: (itemId: string, attachmentId: string) =>
        attachmentSvc.getAttachment(itemId, attachmentId).then((r) =>
          r ? { id: r.id, fileName: r.fileName, fileType: r.fileType, s3Key: r.s3Key } : null,
        ),
      readAttachmentContent: async (s3Key: string) => {
        const storage = getStorage() as IStorageService;
        const stream = await storage.get(s3Key);
        return streamToString(stream);
      },
    });

    copilotAgentId = await runtime.createAgent(
      {
        agent: {
          name: 'bib-copilot',
          type: 'worker',
          sop: COPILOT_SOP,
        },
        components: [
          { componentInstance: bibTools },
          { componentClass: LifecycleComponent },
        ],
      },
      {},
    );

    console.log(`[AgentRuntime] Copilot agent created: ${copilotAgentId}`);

    // Agent starts in Sleeping state — A2A messages will auto-wake it.
    // No need to call startAgent(); the LifecycleComponent's sleep tool
    // keeps the agent idle until a message arrives via the message bus.
  } catch (err) {
    console.error('[AgentRuntime] ERROR: Failed to create copilot agent:');
    console.error(err);
  }
}

export async function shutdownAgentRuntime(): Promise<void> {
  if (copilotAgentId && runtime) {
    try {
      await runtime.destroyAgent(copilotAgentId);
    } catch {
      // Ignore errors during shutdown
    }
  }
  if (runtime) {
    await runtime.stop();
    runtime = null;
    copilotAgentId = null;
  }
}

/**
 * Register fastify lifecycle hooks for the agent runtime.
 */
export function registerRuntimeHooks(app: FastifyInstance): void {
  app.addHook('onClose', async () => {
    await shutdownAgentRuntime();
  });
}

// ============ Helpers ============

function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}
