/**
 * demoAgentRuntime.ts - Multi-Agent Runtime Demonstration
 *
 * This demo showcases the AgentRuntime system managing multiple agents:
 * 1. Creates an AgentRuntime instance
 * 2. Creates multiple agents with different types (specialized literature search agents)
 * 3. Starts the runtime
 * 4. Submits tasks to specific agents via targetInstanceId
 * 5. Listens for task completion events
 * 6. Demonstrates workspace.exportResult() result collection
 *
 * Agents:
 * - epidemiology: 流行病学与危险因素检索
 * - pathophysiology: 病理机制与疼痛通路检索
 * - diagnosis: 诊断、筛查与预防检索
 * - management: 疾病管理与治疗检索
 * - quality-of-life: 生活质量与社会负担检索
 * - emerging-treatments: 展望与新兴疗法检索
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
import {
  createEpidemiologyAgentSoul,
  createPathophysiologyAgentSoul,
  createDiagnosisAgentSoul,
  createManagementAgentSoul,
  createQualityOfLifeAgentSoul,
  createEmergingTreatmentsAgentSoul,
  type AgentSoulType,
} from '../../agent-soul';

// Setup logger
const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Agent configuration with task description
 */
interface AgentConfig {
  type: AgentSoulType;
  name: string;
  taskDescription: string;
  createSoul: () => ReturnType<typeof createEpidemiologyAgentSoul>;
}

/**
 * All specialized literature search agents
 */
const AGENT_CONFIGS: AgentConfig[] = [
  {
    type: 'epidemiology',
    name: 'Epidemiology Agent',
    taskDescription:
      '检索椎间盘突出的流行病学与危险因素文献，包括发病率、患病率、遗传因素、职业风险等。',
    createSoul: createEpidemiologyAgentSoul,
  },
  // {
  //     type: 'pathophysiology',
  //     name: 'Pathophysiology Agent',
  //     taskDescription: '检索椎间盘突出的病理机制与疼痛通路文献，包括分子机制、炎症反应、神经敏化等。',
  //     createSoul: createPathophysiologyAgentSoul,
  // },
  // {
  //     type: 'diagnosis',
  //     name: 'Diagnosis Agent',
  //     taskDescription: '检索椎间盘突出的诊断、筛查与预防文献，包括MRI诊断、体格检查、鉴别诊断、预防策略等。',
  //     createSoul: createDiagnosisAgentSoul,
  // },
  // {
  //     type: 'management',
  //     name: 'Management Agent',
  //     taskDescription: '检索椎间盘突出的疾病管理与治疗文献，包括保守治疗、药物治疗、手术治疗、临床指南等。',
  //     createSoul: createManagementAgentSoul,
  // },
  // {
  //     type: 'quality-of-life',
  //     name: 'Quality of Life Agent',
  //     taskDescription: '检索椎间盘突出的生活质量与社会负担文献，包括疾病负担、经济学成本、心理健康等。',
  //     createSoul: createQualityOfLifeAgentSoul,
  // },
  // {
  //     type: 'emerging-treatments',
  //     name: 'Emerging Treatments Agent',
  //     taskDescription: '检索椎间盘突出的展望与新兴疗法文献，包括再生医学、干细胞治疗、组织工程等。',
  //     createSoul: createEmergingTreatmentsAgentSoul,
  // },
];

/**
 * Demo: Multi-Agent Runtime with Specialized Literature Search Agents
 */
async function main() {
  logger.info('[AgentRuntime Demo] Starting...');

  // ============================================================
  // Step 1: Create AgentRuntime instance
  // ============================================================
  const runtime = createAgentRuntime({
    maxAgents: 10,
    defaultApiConfig: {
      apiProvider: 'openai',
      apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      apiKey: process.env['OPENAI_API_KEY'],
      apiModelId: 'glm-4.7',
    },
  });

  logger.info({ maxAgents: 10 }, '[AgentRuntime Demo] Runtime created');

  // ============================================================
  // Step 2: Subscribe to runtime events
  // ============================================================
  runtime.on('agent:created', (event: RuntimeEvent) => {
    logger.info(
      { payload: event.payload },
      '[AgentRuntime Demo] Agent created',
    );
  });

  runtime.on('task:submitted', (event: RuntimeEvent) => {
    logger.info(
      { payload: event.payload },
      '[AgentRuntime Demo] Task submitted',
    );
  });

  runtime.on('task:assigned', (event: RuntimeEvent) => {
    logger.info(
      { payload: event.payload },
      '[AgentRuntime Demo] Task assigned to agent',
    );
  });

  runtime.on('task:completed', (event: RuntimeEvent) => {
    const payload = event.payload as {
      taskId: string;
      instanceId: string;
      results: unknown;
    };
    logger.info(
      {
        taskId: payload.taskId,
        instanceId: payload.instanceId,
        results: payload.results,
      },
      '[AgentRuntime Demo] Task completed',
    );
  });

  runtime.on('task:failed', (event: RuntimeEvent) => {
    const payload = event.payload as {
      taskId: string;
      instanceId: string;
      error: string;
    };
    logger.error(
      {
        taskId: payload.taskId,
        instanceId: payload.instanceId,
        error: payload.error,
      },
      '[AgentRuntime Demo] Task failed',
    );
  });

  // ============================================================
  // Step 3: Create all specialized agents
  // ============================================================
  const agentIds: Record<AgentSoulType, string> = {} as Record<
    AgentSoulType,
    string
  >;

  for (const config of AGENT_CONFIGS) {
    logger.info(`[AgentRuntime Demo] Creating ${config.name}...`);
    const agentId = await runtime.createAgent(config.createSoul());
    agentIds[config.type] = agentId;
    logger.info(
      { agentId, type: config.type },
      `[AgentRuntime Demo] ${config.name} created`,
    );
  }

  // ============================================================
  // Step 4: List all agents
  // ============================================================
  const allAgents = await runtime.listAgents();
  logger.info(
    {
      count: allAgents.length,
      agents: allAgents.map((a) => ({
        instanceId: a.instanceId,
        name: a.name,
        type: a.agentType,
        status: a.status,
      })),
    },
    '[AgentRuntime Demo] All agents registered',
  );

  // ============================================================
  // Step 5: Start the runtime (enables task polling)
  // ============================================================
  await runtime.start();
  logger.info('[AgentRuntime Demo] Runtime started - task polling enabled');

  // ============================================================
  // Step 6: Submit tasks to all agents
  // ============================================================
  const taskIds: Record<AgentSoulType, string> = {} as Record<
    AgentSoulType,
    string
  >;

  for (const config of AGENT_CONFIGS) {
    logger.info(`[AgentRuntime Demo] Submitting task to ${config.name}...`);
    const taskId = await runtime.submitTask({
      description: config.taskDescription,
      priority: 'high',
      targetInstanceId: agentIds[config.type],
    });
    taskIds[config.type] = taskId;
    logger.info(
      { taskId, agentId: agentIds[config.type], type: config.type },
      `[AgentRuntime Demo] Task submitted to ${config.name}`,
    );
  }

  // ============================================================
  // Step 7: Monitor task status
  // ============================================================
  // Wait a bit for tasks to be assigned
  await new Promise((resolve) => setTimeout(resolve, 3000));

  logger.info('[AgentRuntime Demo] Checking task statuses...');
  for (const config of AGENT_CONFIGS) {
    const taskId = taskIds[config.type];
    const status = await runtime.getTaskStatus(taskId);
    logger.info(
      {
        type: config.type,
        taskId,
        status: status?.status,
        description: status?.description,
      },
      `[AgentRuntime Demo] ${config.name} task status`,
    );
  }

  // ============================================================
  // Step 8: Get runtime statistics
  // ============================================================
  const stats = await runtime.getStats();
  logger.info(
    {
      totalAgents: stats.totalAgents,
      agentsByStatus: stats.agentsByStatus,
      totalPendingTasks: stats.totalPendingTasks,
      totalProcessingTasks: stats.totalProcessingTasks,
    },
    '[AgentRuntime Demo] Runtime statistics',
  );

  // ============================================================
  // Step 9: Keep the demo running to observe task execution
  // ============================================================
  logger.info('[AgentRuntime Demo] Demo running... Press Ctrl+C to exit');
  logger.info(
    '[AgentRuntime Demo] Monitoring agents: ' +
      AGENT_CONFIGS.map((c) => c.type).join(', '),
  );

  // Wait for tasks to complete (or timeout after 10 minutes)
  const timeout = 10 * 60 * 10000; // 100 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const currentStats = await runtime.getStats();
    logger.info(
      {
        processingTasks: currentStats.totalProcessingTasks,
        pendingTasks: currentStats.totalPendingTasks,
        agentsByStatus: currentStats.agentsByStatus,
      },
      '[AgentRuntime Demo] Current status',
    );

    // Check if all tasks are done
    if (
      currentStats.totalProcessingTasks === 0 &&
      currentStats.totalPendingTasks === 0
    ) {
      logger.info('[AgentRuntime Demo] All tasks completed!');
      break;
    }
  }

  // ============================================================
  // Step 10: Cleanup
  // ============================================================
  logger.info('[AgentRuntime Demo] Stopping runtime...');
  await runtime.stop();

  logger.info('[AgentRuntime Demo] Demo completed');
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
    '[AgentRuntime Demo] Error',
  );
  process.exit(1);
});
