/**
 * demoTopologyWithRuntime.ts - Multi-Agent Topology Network with AgentRuntime Demo
 *
 * This demo showcases the AgentTopologyNetwork integrated with AgentRuntime:
 * 1. Creates an AgentRuntime with built-in topology network
 * 2. Registers agents (automatically added to topology)
 * 3. Connects agents in hierarchical topology
 * 4. Demonstrates two-phase response communication
 * 5. Shows message subscription
 * 6. Shows broadcast communication
 */

import pino from 'pino';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

import { createAgentRuntime } from '../../index.js';
import type { TopologyMessage } from '../types.js';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  logger.info('[Topology+Runtime Demo] Starting...');

  // ============================================================
  // Step 1: Create AgentRuntime (includes topology network)
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

  logger.info('[Topology+Runtime Demo] Runtime created with topology network');

  // ============================================================
  // Step 2: Subscribe to runtime events (including topology events)
  // ============================================================
  runtime.on('agent:created' as any, (event) => {
    logger.info(
      { payload: event.payload },
      '[Topology+Runtime Demo] Agent created',
    );
  });

  // ============================================================
  // Step 3: Start the runtime
  // ============================================================
  await runtime.start();
  logger.info('[Topology+Runtime Demo] Runtime started');

  // ============================================================
  // Step 4: Agents are automatically registered in topology
  // when created via runtime.createAgent()
  // For this demo, we'll use pre-defined IDs
  // ============================================================

  // Manually register agents in topology for demonstration
  runtime.registerInTopology('central-router', 'router', ['routing']);
  runtime.registerInTopology('epidemiology-agent', 'worker', [
    'search',
    'epidemiology',
  ]);
  runtime.registerInTopology('pathophysiology-agent', 'worker', [
    'search',
    'pathophysiology',
  ]);
  runtime.registerInTopology('diagnosis-agent', 'worker', [
    'search',
    'diagnosis',
  ]);
  runtime.registerInTopology('treatment-agent', 'worker', [
    'search',
    'treatment',
  ]);

  logger.info('[Topology+Runtime Demo] All agents registered in topology');

  // ============================================================
  // Step 5: Build topology - star with central router
  // ============================================================
  logger.info('[Topology+Runtime Demo] Building star topology...');

  runtime.connectAgents('central-router', 'epidemiology-agent', 'parent-child');
  runtime.connectAgents(
    'central-router',
    'pathophysiology-agent',
    'parent-child',
  );
  runtime.connectAgents('central-router', 'diagnosis-agent', 'parent-child');
  runtime.connectAgents('central-router', 'treatment-agent', 'parent-child');

  const graph = runtime.getTopologyGraph();
  logger.info(
    {
      nodes: graph.getAllNodes().length,
      edges: graph.size.edges,
    },
    '[Topology+Runtime Demo] Topology built',
  );

  // ============================================================
  // Step 6: Subscribe agents to receive messages
  // ============================================================
  logger.info('[Topology+Runtime Demo] Setting up message handlers...');

  runtime.subscribeToAgent('epidemiology-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology+Runtime Demo] Epidemiology agent received message',
    );

    if (msg.messageType === 'request') {
      logger.info(
        '[Topology+Runtime Demo] Epidemiology agent processing task...',
      );
    }
  });

  runtime.subscribeToAgent('pathophysiology-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology+Runtime Demo] Pathophysiology agent received message',
    );
  });

  runtime.subscribeToAgent('diagnosis-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology+Runtime Demo] Diagnosis agent received message',
    );
  });

  runtime.subscribeToAgent('treatment-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology+Runtime Demo] Treatment agent received message',
    );
  });

  // ============================================================
  // Step 7: Send messages via the topology
  // ============================================================
  logger.info('[Topology+Runtime Demo] Sending messages...');

  await runtime.sendToAgent('epidemiology-agent', {
    task: 'search',
    query: '椎间盘突出的发病率研究',
  });

  await sleep(500);

  await runtime.sendToAgent('pathophysiology-agent', {
    task: 'search',
    query: '椎间盘突出的病理机制',
  });

  await sleep(500);

  // ============================================================
  // Step 8: Demonstrate broadcast
  // ============================================================
  logger.info('[Topology+Runtime Demo] Broadcasting to all workers...');

  await runtime.broadcastToChildren('central-router', {
    task: 'status-check',
    message: '所有agent报告状态',
  });

  await sleep(500);

  // ============================================================
  // Step 9: Demonstrate two-phase response
  // ============================================================
  logger.info(
    '[Topology+Runtime Demo] Testing two-phase response (request)...',
  );

  const requestPromise = runtime.requestFromAgent(
    'epidemiology-agent',
    {
      task: 'search',
      query: '椎间盘突出危险因素',
    },
    'external-client',
  );

  logger.info('[Topology+Runtime Demo] Request submitted, waiting for ACK...');

  try {
    const { ack, result } = await requestPromise;
    logger.info(
      {
        ackConversationId: ack.conversationId,
        ackMessageType: ack.messageType,
      },
      '[Topology+Runtime Demo] ACK received',
    );

    logger.info('[Topology+Runtime Demo] Waiting for result...');

    logger.info(
      { resultPromise: result },
      '[Topology+Runtime Demo] Result promise obtained (will timeout without handler)',
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      '[Topology+Runtime Demo] Request failed or timed out (expected without handler)',
    );
  }

  await sleep(500);

  // ============================================================
  // Step 10: Query topology
  // ============================================================
  logger.info('[Topology+Runtime Demo] Querying topology...');

  const children = graph.getChildren('central-router');
  logger.info(
    { children: children.map((c) => c.instanceId) },
    '[Topology+Runtime Demo] Children of central-router',
  );

  const parent = graph.getParent('epidemiology-agent');
  logger.info(
    { parent: parent?.instanceId },
    '[Topology+Runtime Demo] Parent of epidemiology-agent',
  );

  // ============================================================
  // Step 11: Get statistics
  // ============================================================
  const stats = await runtime.getStats();
  logger.info({ stats }, '[Topology+Runtime Demo] Runtime statistics');

  const topologyStats = runtime.getTopologyStats();
  logger.info({ topologyStats }, '[Topology+Runtime Demo] Topology statistics');

  // ============================================================
  // Cleanup
  // ============================================================
  logger.info('[Topology+Runtime Demo] Stopping runtime...');
  await runtime.stop();

  logger.info('[Topology+Runtime Demo] Demo completed successfully!');
  logger.info('');
  logger.info('=== Summary ===');
  logger.info('1. Created AgentRuntime with integrated topology network');
  logger.info('2. Agents automatically registered in topology on creation');
  logger.info('3. Built star topology with central-router');
  logger.info('4. Demonstrated direct message sending via sendToAgent()');
  logger.info('5. Demonstrated broadcast via broadcastToChildren()');
  logger.info('6. Demonstrated two-phase request/response');
  logger.info('7. Queried topology structure');
  logger.info('');
  logger.info('Key concepts demonstrated:');
  logger.info('- AgentRuntime now includes topology network as sub-module');
  logger.info('- Agent registration auto-adds to topology');
  logger.info('- Hierarchical connections (parent-child) via connectAgents()');
  logger.info('- Message subscription per agent via subscribeToAgent()');
  logger.info('- Broadcast to children via broadcastToChildren()');
  logger.info('- Two-phase response via requestFromAgent()');
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
    '[Topology+Runtime Demo] Error',
  );
  process.exit(1);
});
