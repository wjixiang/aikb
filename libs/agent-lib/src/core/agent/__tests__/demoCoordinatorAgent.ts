/**
 * demoCoordinatorAgent.ts - Literature Survey Coordinator Demo
 *
 * This demo showcases a coordinator agent that:
 * 1. Creates specialized child agents for different literature domains
 * 2. Sends A2A tasks to child agents
 * 3. Collects and aggregates results from child agents
 *
 * Workflow:
 * - Coordinator receives a complex literature survey task
 * - Creates child agents for each domain (epidemiology, pathophysiology, etc.)
 * - Sends A2A tasks to each child agent
 * - Waits for results and aggregates them
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import pino from 'pino';

// Load .env BEFORE importing souls (they use process.env at module level)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: join(__dirname, '..', '..', '..', '..', '.env') });

import { createAgentRuntime } from '../../runtime';
import type { RuntimeEvent } from '../../runtime/types.js';
import { createCoordinatorAgentSoul } from '../../agent-soul/coordinator/index.js';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Demo: Coordinator Agent - Literature Survey
 */
async function main() {
  logger.info('[Coordinator Demo] Starting...');

  // ============================================================
  // Step 1: Create AgentRuntime instance
  // ============================================================
  const runtime = createAgentRuntime({
    maxAgents: 20,
    defaultApiConfig: {
      apiProvider: 'openai',
      apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      apiKey: process.env['OPENAI_API_KEY'],
      apiModelId: 'glm-4.7',
    },
  });

  logger.info('[Coordinator Demo] Runtime created');

  // ============================================================
  // Step 2: Subscribe to runtime events
  // ============================================================
  runtime.on('agent:created', (event: RuntimeEvent) => {
    logger.info({ payload: event.payload }, '[Coordinator Demo] Agent created');
  });

  runtime.on('agent:started', (event: RuntimeEvent) => {
    logger.info({ payload: event.payload }, '[Coordinator Demo] Agent started');
  });

  runtime.on('agent:idle', (event: RuntimeEvent) => {
    logger.debug({ payload: event.payload }, '[Coordinator Demo] Agent idle');
  });

  // ============================================================
  // Step 3: Create Coordinator Agent
  // ============================================================
  logger.info('[Coordinator Demo] Creating coordinator agent...');
  const coordinatorId = await runtime.createAgent(createCoordinatorAgentSoul());
  logger.info(
    { coordinatorId },
    '[Coordinator Demo] Coordinator agent created',
  );

  // ============================================================
  // Step 4: Start Coordinator Agent
  // ============================================================
  await runtime.startAgent(coordinatorId);
  logger.info(
    { coordinatorId },
    '[Coordinator Demo] Coordinator agent started',
  );

  // ============================================================
  // Step 5: Get coordinator's runtime client to create child agents
  // ============================================================
  const coordinatorAgent = await runtime.getAgent(coordinatorId);
  if (!coordinatorAgent) {
    throw new Error('Failed to get coordinator agent');
  }

  const runtimeClient = coordinatorAgent.getRuntimeClient();
  if (!runtimeClient) {
    throw new Error('Coordinator does not have runtime client');
  }

  logger.info('[Coordinator Demo] Got coordinator runtime client');

  // ============================================================
  // Step 6: Coordinator creates child agents for each domain
  // ============================================================
  const childAgentTypes = [
    { type: 'epidemiology', name: 'Epidemiology Agent' },
    { type: 'pathophysiology', name: 'Pathophysiology Agent' },
    { type: 'diagnosis', name: 'Diagnosis Agent' },
  ];

  const childAgentIds: Record<string, string> = {};

  logger.info('[Coordinator Demo] Creating child agents...');
  for (const { type, name } of childAgentTypes) {
    const agentId = await runtimeClient.createAgent({
      agent: {
        name,
        type,
        description: `${name} for literature search`,
      },
      api: {
        apiProvider: 'openai',
        apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        apiKey: process.env['OPENAI_API_KEY'],
        apiModelId: 'glm-4.7',
      },
    });
    childAgentIds[type] = agentId;
    logger.info({ agentId, type }, `[Coordinator Demo] Created ${name}`);
  }

  // ============================================================
  // Step 7: Start all child agents
  // ============================================================
  logger.info('[Coordinator Demo] Starting child agents...');
  for (const [type, agentId] of Object.entries(childAgentIds)) {
    await runtimeClient.startAgent(agentId);
    logger.info({ agentId, type }, `[Coordinator Demo] Started ${type} agent`);
  }

  // ============================================================
  // Step 8: Register agents in topology
  // ============================================================
  logger.info('[Coordinator Demo] Registering agents in topology...');

  // Register coordinator
  runtimeClient.registerInTopology(coordinatorId, 'router', ['coordinator']);

  // Register children and connect them to coordinator
  for (const [type, agentId] of Object.entries(childAgentIds)) {
    runtimeClient.registerInTopology(agentId, 'worker', [type]);
    runtimeClient.connectAgents(coordinatorId, agentId, 'parent-child');
  }

  logger.info('[Coordinator Demo] Topology setup complete');

  // ============================================================
  // Step 9: Coordinator sends A2A tasks to child agents
  // ============================================================
  const a2aClient = coordinatorAgent.getA2AClient();
  if (!a2aClient) {
    throw new Error('Coordinator does not have A2A client');
  }

  logger.info('[Coordinator Demo] Sending A2A tasks to child agents...');

  const taskDescriptions = [
    {
      type: 'epidemiology',
      task: '检索椎间盘突出的流行病学与危险因素文献',
      input: {
        query: 'lumbar disc herniation epidemiology risk factors',
        limit: 5,
      },
    },
    {
      type: 'pathophysiology',
      task: '检索椎间盘突出的病理机制文献',
      input: { query: 'disc herniation pathophysiology mechanism', limit: 5 },
    },
    {
      type: 'diagnosis',
      task: '检索椎间盘突出的诊断方法文献',
      input: { query: 'disc herniation diagnosis MRI', limit: 5 },
    },
  ];

  const taskResults: Record<string, unknown> = {};

  for (const { type, task, input } of taskDescriptions) {
    const targetAgentId = childAgentIds[type];
    logger.info({ targetAgentId, task }, '[Coordinator Demo] Sending task');

    try {
      const result = await a2aClient.sendTask(
        targetAgentId,
        `task-${type}-${Date.now()}`,
        task,
        input,
        { priority: 'normal' },
      );

      taskResults[type] = result;
      logger.info(
        { type, status: result.status, taskId: result.taskId },
        '[Coordinator Demo] Task completed',
      );
    } catch (error) {
      logger.error({ error, type }, '[Coordinator Demo] Task failed');
      taskResults[type] = { error: String(error) };
    }
  }

  // ============================================================
  // Step 10: Aggregate results
  // ============================================================
  logger.info('[Coordinator Demo] Aggregating results...');
  logger.info(
    { results: JSON.stringify(taskResults, null, 2) },
    '[Coordinator Demo] All task results',
  );

  // ============================================================
  // Step 11: Get topology info
  // ============================================================
  const topologyGraph = runtimeClient.getTopologyGraph();
  const nodes = topologyGraph.getAllNodes();
  const edges = topologyGraph.getAllEdges();

  logger.info(
    { nodes: nodes.length, edges: edges.length },
    '[Coordinator Demo] Topology info',
  );

  // ============================================================
  // Step 12: Cleanup - destroy child agents
  // ============================================================
  logger.info('[Coordinator Demo] Cleaning up child agents...');
  for (const [type, agentId] of Object.entries(childAgentIds)) {
    try {
      await runtimeClient.destroyAgent(agentId, { cascade: true });
      logger.info({ agentId, type }, '[Coordinator Demo] Destroyed agent');
    } catch (error) {
      logger.warn(
        { error, agentId, type },
        '[Coordinator Demo] Failed to destroy agent',
      );
    }
  }

  // ============================================================
  // Step 13: Stop runtime
  // ============================================================
  logger.info('[Coordinator Demo] Stopping runtime...');
  await runtime.stop();

  logger.info('[Coordinator Demo] Demo completed successfully');
}

// Run the demo
main().catch((error) => {
  logger.error(
    {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    },
    '[Coordinator Demo] Error',
  );
  process.exit(1);
});
