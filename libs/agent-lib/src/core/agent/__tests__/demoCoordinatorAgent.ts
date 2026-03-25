/**
 * demoCoordinatorAgent.ts - Literature Survey Coordinator Demo
 *
 * This demo showcases a coordinator agent that autonomously:
 * 1. Discovers available agent types via listAgentSouls
 * 2. Creates specialized child agents via createAgentByType
 * 3. Registers agents in topology
 * 4. Sends A2A tasks to child agents
 * 5. Collects and aggregates results
 *
 * The demo only manually creates and starts the coordinator;
 * all child agent management is done autonomously by the coordinator.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import pino from 'pino';

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

async function main() {
  logger.info('[Coordinator Demo] Starting...');

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

  runtime.on('agent:created', (event: RuntimeEvent) => {
    logger.info({ payload: event.payload }, '[Coordinator Demo] Agent created');
  });

  runtime.on('agent:started', (event: RuntimeEvent) => {
    logger.info({ payload: event.payload }, '[Coordinator Demo] Agent started');
  });

  runtime.on('agent:idle', (event: RuntimeEvent) => {
    logger.debug({ payload: event.payload }, '[Coordinator Demo] Agent idle');
  });

  logger.info('[Coordinator Demo] Creating coordinator agent...');
  const coordinatorId = await runtime.createAgent(createCoordinatorAgentSoul());
  logger.info(
    { coordinatorId },
    '[Coordinator Demo] Coordinator agent created',
  );

  logger.info('[Coordinator Demo] Starting coordinator agent...');
  await runtime.startAgent(coordinatorId);
  logger.info(
    { coordinatorId },
    '[Coordinator Demo] Coordinator agent started',
  );

  const coordinatorAgent = await runtime.getAgent(coordinatorId);
  if (!coordinatorAgent) {
    throw new Error('Failed to get coordinator agent');
  }

  const a2aClient = coordinatorAgent.getA2AClient();
  if (!a2aClient) {
    throw new Error('Coordinator does not have A2A client');
  }

  logger.info(
    '[Coordinator Demo] Sending literature survey task to coordinator...',
  );

  const taskResult = await a2aClient.sendTask(
    coordinatorId,
    `task-coordinator-${Date.now()}`,
    '请对椎间盘突出症(lumbar disc herniation)进行系统性文献调查，协调多个专业Agent完成流行病学、病理机制、诊断方法等领域的文献检索，并汇总结果。',
    { query: 'lumbar disc herniation', limit: 10 },
    { priority: 'high' },
  );

  logger.info(
    { status: taskResult.status, taskId: taskResult.taskId },
    '[Coordinator Demo] Coordinator task result',
  );

  if (taskResult.status === 'completed' && taskResult.output) {
    logger.info(
      { result: JSON.stringify(taskResult.output, null, 2) },
      '[Coordinator Demo] Survey results',
    );
  }

  logger.info('[Coordinator Demo] Stopping runtime...');
  await runtime.stop();

  logger.info('[Coordinator Demo] Demo completed successfully');
}

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
