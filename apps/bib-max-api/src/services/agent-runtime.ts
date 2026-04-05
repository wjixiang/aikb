import type { FastifyInstance } from 'fastify';
import type { IAgentRuntime, AgentRuntimeConfig, RuntimeControlProviderSettings } from 'agent-lib/core';
import type { BibToolsDeps } from 'bib-copilot';
import { config } from '../config.js';

// ============ Copilot SOP ============

const COPILOT_SOP = `You are a knowledgeable assistant for the Bib-Max bibliography management system. You help users search, create, update, and organize their literature collection.

## Workflow

When you wake up and receive a message:
1. Use checkInbox to see the user's message
2. Process the request using the available KB tools
3. Use completeTask to send your response back to the user
4. Call sleep to wait for the next message

## Guidelines

- When searching, use reasonable page sizes (5-10 items)
- Always confirm with the user before destructive operations (deleting items)
- When creating items, gather required information (at minimum: title)
- If you need tag IDs, first use list_tags to find available tags
- Present search results in a clear, concise format
- Respond in the same language as the user
- NEVER call attempt_completion — always use completeTask + sleep instead`;

// ============ State ============

let runtime: IAgentRuntime | null = null;
let copilotAgentId: string | null = null;

export function getRuntime(): IAgentRuntime {
  if (!runtime) throw new Error('Agent runtime not initialized');
  return runtime;
}

export function getCopilotAgentId(): string {
  if (!copilotAgentId) throw new Error('Copilot agent not created');
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
  const { BibToolsComponent } = await import('bib-copilot');
  const { LineageControlComponent, LifecycleComponent } = await import('component-hub');

  // 4. Create and start runtime
  const apiConfig = resolveApiConfig();
  const runtimeConfig: AgentRuntimeConfig = {
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
    const bibTools = new BibToolsComponent({
      listItems: (query: Record<string, unknown>) => itemService.listItems(query as itemService.ItemQuery),
      getItemById: (id: string) => itemService.getItemById(id),
      createItem: (data: Record<string, unknown>) => itemService.createItem(data as unknown as itemService.CreateItemInput),
      updateItem: (id: string, data: Record<string, unknown>) => itemService.updateItem(id, data as itemService.UpdateItemInput),
      removeItem: (id: string) => itemService.removeItem(id),
      listTags: (query: Record<string, unknown>) => tagService.listTags(query as tagService.TagQuery),
      createTag: (data: Record<string, unknown>) => tagService.createTag(data as unknown as tagService.CreateTagInput),
      listAttachments: (itemId: string) => attachmentService.listAttachments(itemId),
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
          { componentClass: LineageControlComponent },
          { componentClass: LifecycleComponent },
        ],
      },
      {},
    );

    console.log(`[AgentRuntime] Copilot agent created: ${copilotAgentId}`);

    // 6. Skip initial LLM call — agent goes directly to sleep and waits for A2A messages
    const agent = await runtime.getAgent(copilotAgentId);
    agent.setSkipInitialTurn(true);

    // 7. Start agent in background (don't await — agent will sleep immediately)
    runtime.startAgent(copilotAgentId).catch((err) => {
      console.error('[AgentRuntime] Copilot agent crashed:', err);
    });
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
