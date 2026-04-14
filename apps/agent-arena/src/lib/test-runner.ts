import 'reflect-metadata';
import { createAgentRuntime } from 'agent-lib/core';
import type { AgentBlueprint } from 'agent-lib/core';
import { PostgresPersistenceService } from 'agent-lib';
import { PrismaClient } from 'agent-lib';
import { ClientPool } from 'llm-api-client';
import type { ProviderSettings } from 'llm-api-client';
import { createAgentSoulByToken, getAllAgentSouls } from 'agent-soul-hub';
import { MockApiClient, DEFAULT_MOCK_RESPONSE, resetGlobalCallCounter } from './mock-llm.js';
import { TestEvaluator } from './test-evaluator.js';
import { getConfig, getLiveProviderSettings } from './config.js';
import type {
  AgentRunResult,
  ArenaMode,
  MockResponseDef,
  TestSuite,
  TestSuiteResult,
  ToolCallRecord,
} from '../types.js';

/**
 * Create an arena runtime with mock or live LLM configuration.
 */
export function createArenaRuntime(
  mode: ArenaMode,
  options?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    defaultMockResponse?: MockResponseDef;
    mockResponseQueue?: MockResponseDef[];
  },
) {
  ClientPool.resetInstance();
  resetGlobalCallCounter();

  const cfg = getConfig();
  const databaseUrl = process.env['AGENT_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? cfg.databaseUrl;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
  const persistenceService = new PostgresPersistenceService(prisma as any);

  const pool = ClientPool.getInstance();

  if (mode === 'mock') {
    const mockClient = new MockApiClient(
      options?.defaultMockResponse ?? DEFAULT_MOCK_RESPONSE,
      options?.mockResponseQueue,
    );
    pool._clientFactory = (_settings: ProviderSettings) => mockClient;
    pool.register({
      name: 'mock-default',
      settings: {
        apiProvider: 'openai',
        apiKey: 'mock-key',
        apiModelId: 'mock-model',
      },
    });
  } else {
    const overrides: { provider?: string; model?: string; apiKey?: string } = {};
    if (options?.provider) overrides.provider = options.provider;
    if (options?.model) overrides.model = options.model;
    if (options?.apiKey) overrides.apiKey = options.apiKey;
    const liveSettings = getLiveProviderSettings(overrides);
    pool.register({
      name: 'live-default',
      settings: liveSettings as unknown as ProviderSettings,
    });
  }

  return createAgentRuntime({ apiClient: pool, persistenceService });
}

/**
 * Resolve a soul token string to an AgentBlueprint.
 */
export function resolveBlueprint(soulOrPath: string): AgentBlueprint {
  try {
    return createAgentSoulByToken(soulOrPath);
  } catch {
    throw new Error(
      `Unknown agent soul: "${soulOrPath}". ` +
      `Available: ${getAllAgentSouls().map((s) => s.token).join(', ')}`,
    );
  }
}

/**
 * Extract tool call records from agent conversation history.
 * Message uses ExtendedContentBlock[] format with tool_use and tool_result blocks.
 */
function extractToolCallsFromHistory(
  messages: any[],
): ToolCallRecord[] {
  const toolCalls: ToolCallRecord[] = [];

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      // Anthropic tool_use block
      if (block.type === 'tool_use') {
        let args = {};
        try {
          args = typeof block.input === 'string' ? JSON.parse(block.input) : (block.input ?? {});
        } catch {
          // ignore
        }
        toolCalls.push({
          name: block.name ?? 'unknown',
          arguments: args,
          success: true,
          result: null,
          timestamp: msg.ts ?? Date.now(),
          turnId: msg.turnId ?? '',
          toolUseId: block.id,
        });
      }
    }
  }

  // Match tool results with their tool_use calls
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
    for (const block of msg.content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        const tc = toolCalls.find((t) => (t as any).toolUseId === block.tool_use_id);
        if (tc) {
          tc.result = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          tc.success = !block.is_error;
        }
      }
    }
  }

  return toolCalls;
}

/**
 * Count LLM rounds from messages (assistant turns).
 */
function countLlmRounds(messages: any[]): number {
  let rounds = 0;
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      rounds++;
    }
  }
  return rounds;
}

/**
 * Run a single agent with a prompt and collect results.
 */
export async function runAgent(
  blueprint: AgentBlueprint,
  prompt: string,
  options?: {
    mode?: ArenaMode;
    mockResponseQueue?: MockResponseDef[];
    defaultMockResponse?: MockResponseDef;
    provider?: string;
    model?: string;
    apiKey?: string;
    timeout?: number;
  },
): Promise<AgentRunResult> {
  const mode = options?.mode ?? 'mock';
  const timeout = options?.timeout ?? getConfig().defaultTimeout;
  const startTime = Date.now();

  const runtime = createArenaRuntime(mode, {
    ...(options?.provider && { provider: options.provider }),
    ...(options?.model && { model: options.model }),
    ...(options?.apiKey && { apiKey: options.apiKey }),
    ...(options?.defaultMockResponse && { defaultMockResponse: options.defaultMockResponse }),
    ...(options?.mockResponseQueue && { mockResponseQueue: options.mockResponseQueue }),
  });

  await runtime.start();

  let result: AgentRunResult;

  try {
    const instanceId = await runtime.createAgent(blueprint);

    const agent = await runtime.getAgent(instanceId);
    if (!agent) throw new Error('Failed to get agent instance');

    // Add user message to memory
    const memory = agent.getMemoryModule();
    await memory.addMessage({
      role: 'user',
      content: [{ type: 'text', text: prompt }],
      ts: Date.now(),
    });

    // Start agent (optionally with timeout)
    const startPromise = runtime.startAgent(instanceId);
    if (timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Agent timed out after ${timeout}ms`)),
          timeout,
        ),
      );
      await Promise.race([startPromise, timeoutPromise]);
    } else {
      await startPromise;
    }

    // Extract results from agent's memory
    const history = memory.getAllMessages();
    const messages = history.map((m) => {
      let content = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        // Render each block appropriately based on its type
        const parts: string[] = [];
        for (const block of m.content) {
          if (block.type === 'text') {
            parts.push(block.text ?? '');
          } else if (block.type === 'tool_use') {
            parts.push(`[tool_call: ${block.name}(${JSON.stringify(block.input)})]`);
          } else if (block.type === 'tool_result') {
            const resultText = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
            parts.push(`[tool_result: ${resultText}]`);
          }
        }
        content = parts.join('\n');
      } else {
        content = JSON.stringify(m.content);
      }
      return { role: m.role, content };
    });

    const toolCalls = extractToolCallsFromHistory(history);
    const llmCalls = countLlmRounds(history);

    const status = agent.status;

    result = {
      success: true,
      status,
      duration: Date.now() - startTime,
      messages,
      toolCalls,
      llmCalls,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  } catch (error) {
    result = {
      success: false,
      status: 'error',
      duration: Date.now() - startTime,
      messages: [],
      toolCalls: [],
      llmCalls: 0,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await runtime.stop();
  }

  return result;
}

/**
 * Run a complete test suite and return results.
 */
export async function runTestSuite(
  suite: TestSuite,
  options: {
    mode: ArenaMode;
    provider?: string;
    model?: string;
    apiKey?: string;
    timeout?: number;
  },
): Promise<TestSuiteResult> {
  const suiteStart = Date.now();
  const results: TestSuiteResult['results'] = [];
  const evaluator = new TestEvaluator();

  // Resolve blueprint once
  let blueprint: AgentBlueprint;
  if (suite.agent.soul) {
    blueprint = createAgentSoulByToken(suite.agent.soul);
  } else {
    blueprint = {
      agent: {
        sop: suite.agent.sop ?? '',
        name: suite.agent.name ?? 'test-agent',
        type: suite.agent.type ?? 'test',
        ...(suite.agent.description && { description: suite.agent.description }),
      },
      components: (suite.agent.components ?? []) as any,
    };
  }

  for (const testCase of suite.cases) {
    const caseStart = Date.now();

    // Build mock queue: case-specific mock + default completion
    const mockQueue: MockResponseDef[] = [];
    if (testCase.mock) {
      mockQueue.push(testCase.mock);
    }
    mockQueue.push(DEFAULT_MOCK_RESPONSE);

    const runResult = await runAgent(blueprint, testCase.prompt, {
      mode: options.mode,
      mockResponseQueue: mockQueue,
      ...(options.provider && { provider: options.provider }),
      ...(options.model && { model: options.model }),
      ...(options.apiKey && { apiKey: options.apiKey }),
      ...(options.timeout && { timeout: options.timeout }),
    });

    const failures = evaluator.evaluate(testCase.expect, runResult);

    results.push({
      testCase,
      passed: failures.length === 0,
      result: runResult,
      failures,
      duration: Date.now() - caseStart,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    suiteName: suite.name,
    agentToken: suite.agent.soul ?? suite.agent.type ?? 'inline',
    total: results.length,
    passed,
    failed: results.length - passed,
    duration: Date.now() - suiteStart,
    results,
  };
}
