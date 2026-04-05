import type { FastifyInstance } from 'fastify';
import { createAgentRuntime, type IAgentRuntime, type AgentRuntimeConfig, type RuntimeControlProviderSettings } from 'agent-lib/core';
import { BibToolsComponent } from 'bib-copilot';
import { LineageControlComponent, LifecycleComponent } from 'component-hub';
import { config, type LlmClientConfig } from '../config.js';
import * as itemService from './item.service.js';
import * as tagService from './tag.service.js';
import * as attachmentService from './attachment.service.js';

// ============ Copilot SOP ============

const COPILOT_SOP = `You are a knowledgeable assistant for the Bib-Max bibliography management system. You help users search, create, update, and organize their literature collection.

## Workflow

When you receive a message:
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

/**
 * Map the first LLM client config from bib-max-api's config
 * to the RuntimeControlProviderSettings format expected by AgentRuntime.
 */
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

// ============ Initialization ============

export async function initAgentRuntime(): Promise<void> {
  const apiConfig = resolveApiConfig();

  if (!apiConfig) {
    console.warn('[AgentRuntime] No LLM client configured, skipping copilot agent initialization');
    return;
  }

  const runtimeConfig: AgentRuntimeConfig = {
    defaultApiConfig: apiConfig,
    messageBus: { mode: 'memory' },
  };

  // 1. Create and start runtime
  runtime = createAgentRuntime(runtimeConfig);
  await runtime.start();

  // 2. Create copilot agent with KB tools + A2A/lifecycle components
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

  // 3. Start agent in background (don't await — agent will sleep and wait for A2A messages)
  runtime.startAgent(copilotAgentId).catch((err) => {
    console.error('[AgentRuntime] Copilot agent crashed:', err);
  });
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
