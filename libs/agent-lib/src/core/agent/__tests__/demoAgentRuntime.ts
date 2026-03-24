/**
 * demoAgentRuntime.ts - Multi-Agent Runtime Demonstration with A2A
 *
 * This demo showcases the AgentRuntime system managing multiple agents:
 * 1. Creates an AgentRuntime instance
 * 2. Creates multiple agents with different types (specialized literature search agents)
 * 3. Starts the runtime
 * 4. Uses A2A for agent-to-agent communication
 * 5. Demonstrates sending tasks between agents via A2A
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
 * Agent configuration
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
  {
    type: 'pathophysiology',
    name: 'Pathophysiology Agent',
    taskDescription:
      '检索椎间盘突出的病理机制与疼痛通路文献，包括分子机制、炎症反应、神经敏化等。',
    createSoul: createPathophysiologyAgentSoul,
  },
  {
    type: 'diagnosis',
    name: 'Diagnosis Agent',
    taskDescription:
      '检索椎间盘突出的诊断、筛查与预防文献，包括MRI诊断，体格检查、鉴别诊断、预防策略等。',
    createSoul: createDiagnosisAgentSoul,
  },
  {
    type: 'management',
    name: 'Management Agent',
    taskDescription:
      '检索椎间盘突出的疾病管理与治疗文献，包括保守治疗、药物治疗、手术治疗、临床指南等。',
    createSoul: createManagementAgentSoul,
  },
  {
    type: 'quality-of-life',
    name: 'Quality of Life Agent',
    taskDescription:
      '检索椎间盘突出的生活质量与社会负担文献，包括疾病负担、经济学成本、心理健康等。',
    createSoul: createQualityOfLifeAgentSoul,
  },
  {
    type: 'emerging-treatments',
    name: 'Emerging Treatments Agent',
    taskDescription:
      '检索椎间盘突出的展望与新兴疗法文献，包括再生医学、干细胞治疗、组织工程等。',
    createSoul: createEmergingTreatmentsAgentSoul,
  },
];

/**
 * Demo: Multi-Agent Runtime with A2A Communication
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

  runtime.on('agent:started', (event: RuntimeEvent) => {
    logger.info(
      { payload: event.payload },
      '[AgentRuntime Demo] Agent started',
    );
  });

  runtime.on('agent:idle', (event: RuntimeEvent) => {
    logger.info(
      { payload: event.payload },
      '[AgentRuntime Demo] Agent idle',
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
  // Step 5: Start all agents
  // ============================================================
  logger.info('[AgentRuntime Demo] Starting all agents...');
  for (const config of AGENT_CONFIGS) {
    const agentId = agentIds[config.type];
    await runtime.startAgent(agentId);
    logger.info(
      { agentId },
      `[AgentRuntime Demo] ${config.name} started`,
    );
  }

  // ============================================================
  // Step 6: User Context - User as Agent
  // ============================================================
  // Create a UserContext - treats the external user as an Agent
  // The user can now use all Agent methods (createAgent, sendA2ATask, etc.)
  // Note: timeout should be longer than A2AHandler's handlerTimeout (60s) + API processing time
  const user = runtime.createUserContext({
    userId: 'demo-user-001',
    defaultTimeout: 120000, // 2 minutes - longer than handler timeout + API time
  });

  logger.info(
    { userId: user.instanceId },
    '[User Context] User context created - user acts as an Agent',
  );

  // User can manage agents using RuntimeClient
  const userAgents = await user.getRuntimeClient().listAgents();
  logger.info(
    { agentCount: userAgents.length },
    '[User Context] User can list all agents',
  );

  // User can send A2A tasks to agents
  const epidemiologyAgentId = agentIds['epidemiology'];
  const pathophysiologyAgentId = agentIds['pathophysiology'];

  logger.info(
    { targetAgentId: pathophysiologyAgentId },
    '[User Context] User sending task to agent via publishTask',
  );

  // Use simplified publishTask - wraps as Agent
  const result = await user.publishTask(
    pathophysiologyAgentId,     // Target agent
    '检索椎间盘突出病理机制文献', // Task description
    {                          // Input data
      query: 'lumbar disc herniation pathophysiology',
      limit: 10,
    },
    { priority: 'high', timeout: 120000 } // 2 minutes timeout
  );
  logger.info({ result }, '[User Context] Task result received');

  // User can also send queries (via A2A client)
  const response = await user.getA2AClient().sendQuery(
    pathophysiologyAgentId,
    'What is your current status?',
    { expectedFormat: 'json' }
  );
  logger.info({ response }, '[User Context] Query response received');

  // Or fire-and-forget events
  await user.getA2AClient().sendEvent(
    pathophysiologyAgentId,
    'user:connected',
    { userId: user.instanceId, timestamp: Date.now() }
  );

  logger.info('[User Context] User can send tasks/queries/events to agents');
  logger.info('[User Context] User context demo complete');

  // ============================================================
  // Step 7: Get runtime statistics
  // ============================================================
  const stats = await runtime.getStats();
  logger.info(
    {
      totalAgents: stats.totalAgents,
      agentsByStatus: stats.agentsByStatus,
    },
    '[AgentRuntime Demo] Runtime statistics',
  );

  // ============================================================
  // Step 8: Keep the demo running to observe agent behavior
  // ============================================================
  logger.info('[AgentRuntime Demo] Demo running... Press Ctrl+C to exit');
  logger.info(
    '[AgentRuntime Demo] Monitoring agents: ' +
      AGENT_CONFIGS.map((c) => c.type).join(', '),
  );

  // Wait for a while to observe agents
  const timeout = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const currentStats = await runtime.getStats();
    logger.info(
      {
        agentsByStatus: currentStats.agentsByStatus,
      },
      '[AgentRuntime Demo] Current status',
    );
  }

  // ============================================================
  // Step 9: Cleanup
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
