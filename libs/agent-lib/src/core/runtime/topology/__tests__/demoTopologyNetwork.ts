/**
 * demoTopologyNetwork.ts - Multi-Agent Topology Network Demonstration
 *
 * This demo showcases the AgentTopologyNetwork system:
 * 1. Creates a topology network with router and worker agents
 * 2. Sets up hierarchical topology
 * 3. Demonstrates two-phase response (ACK + async result)
 * 4. Shows message subscription
 * 5. Shows broadcast communication
 */

import pino from 'pino';

const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

import {
  createAgentTopologyNetwork,
  type IAgentTopologyNetwork,
  type TopologyMessage,
} from '../index.js';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  logger.info('[Topology Demo] Starting...');

  // ============================================================
  // Step 1: Create AgentTopologyNetwork
  // ============================================================
  const network = createAgentTopologyNetwork({
    defaultAckTimeout: 3000,
    maxRetries: 2,
  });

  logger.info('[Topology Demo] Network created');

  // ============================================================
  // Step 2: Subscribe to events
  // ============================================================
  network.onEvent((event) => {
    logger.info(
      { type: event.type, payload: event.payload },
      '[Topology Demo] Event received',
    );
  });

  // ============================================================
  // Step 3: Register agents
  // ============================================================
  logger.info('[Topology Demo] Registering agents...');

  network.registerAgent('central-router', 'router', ['routing']);
  network.registerAgent('epidemiology-agent', 'worker', [
    'search',
    'epidemiology',
  ]);
  network.registerAgent('pathophysiology-agent', 'worker', [
    'search',
    'pathophysiology',
  ]);
  network.registerAgent('diagnosis-agent', 'worker', ['search', 'diagnosis']);
  network.registerAgent('treatment-agent', 'worker', ['search', 'treatment']);

  logger.info('[Topology Demo] All agents registered');

  // ============================================================
  // Step 4: Build topology - star with central router
  // ============================================================
  logger.info('[Topology Demo] Building star topology...');

  network.connect('central-router', 'epidemiology-agent', 'parent-child');
  network.connect('central-router', 'pathophysiology-agent', 'parent-child');
  network.connect('central-router', 'diagnosis-agent', 'parent-child');
  network.connect('central-router', 'treatment-agent', 'parent-child');

  const graph = network.getGraph();
  logger.info(
    {
      nodes: graph.getAllNodes().length,
      edges: graph.size.edges,
    },
    '[Topology Demo] Topology built',
  );

  // ============================================================
  // Step 5: Subscribe agents to receive messages
  // ============================================================
  logger.info('[Topology Demo] Setting up message handlers...');

  network.subscribe('epidemiology-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology Demo] Epidemiology agent received message',
    );

    if (msg.messageType === 'request') {
      logger.info('[Topology Demo] Epidemiology agent processing task...');
    }
  });

  network.subscribe('pathophysiology-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology Demo] Pathophysiology agent received message',
    );
  });

  network.subscribe('diagnosis-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology Demo] Diagnosis agent received message',
    );
  });

  network.subscribe('treatment-agent', (msg: TopologyMessage) => {
    logger.info(
      { from: msg.from, content: msg.content },
      '[Topology Demo] Treatment agent received message',
    );
  });

  // ============================================================
  // Step 6: Send messages via the topology
  // ============================================================
  logger.info('[Topology Demo] Sending messages...');

  // Direct send to specific agent
  await network.send('epidemiology-agent', {
    task: 'search',
    query: '椎间盘突出的发病率研究',
  });

  await sleep(500);

  // Send to pathophysiology agent
  await network.send('pathophysiology-agent', {
    task: 'search',
    query: '椎间盘突出的病理机制',
  });

  await sleep(500);

  // ============================================================
  // Step 7: Demonstrate broadcast
  // ============================================================
  logger.info('[Topology Demo] Broadcasting to all workers...');

  await network.broadcast('central-router', {
    task: 'status-check',
    message: '所有agent报告状态',
  });

  await sleep(500);

  // ============================================================
  // Step 8: Demonstrate two-phase response
  // ============================================================
  logger.info('[Topology Demo] Testing two-phase response (request)...');

  const requestPromise = network.request(
    'epidemiology-agent',
    {
      task: 'search',
      query: '椎间盘突出危险因素',
    },
    'external-client',
  );

  logger.info('[Topology Demo] Request submitted, waiting for ACK...');

  try {
    const { ack, result } = await requestPromise;
    logger.info(
      {
        ackConversationId: ack.conversationId,
        ackMessageType: ack.messageType,
      },
      '[Topology Demo] ACK received',
    );

    logger.info('[Topology Demo] Waiting for result...');

    // Note: In real usage, the result would come asynchronously
    // Here we just demonstrate the interface
    logger.info(
      { resultPromise: result },
      '[Topology Demo] Result promise obtained',
    );
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : error },
      '[Topology Demo] Request failed or timed out',
    );
  }

  await sleep(500);

  // ============================================================
  // Step 9: Query topology
  // ============================================================
  logger.info('[Topology Demo] Querying topology...');

  const children = graph.getChildren('central-router');
  logger.info(
    { children: children.map((c) => c.instanceId) },
    '[Topology Demo] Children of central-router',
  );

  const parent = graph.getParent('epidemiology-agent');
  logger.info(
    { parent: parent?.instanceId },
    '[Topology Demo] Parent of epidemiology-agent',
  );

  // ============================================================
  // Step 10: Get statistics
  // ============================================================
  const stats = network.getStats();
  logger.info({ stats }, '[Topology Demo] Network statistics');

  logger.info('[Topology Demo] Demo completed successfully!');
  logger.info('');
  logger.info('=== Summary ===');
  logger.info('1. Created topology network with 5 agents');
  logger.info('2. Built star topology with central-router');
  logger.info('3. Demonstrated direct message sending');
  logger.info('4. Demonstrated broadcast to all workers');
  logger.info('5. Demonstrated two-phase request/response');
  logger.info('6. Queried topology structure');
  logger.info('');
  logger.info('Key concepts demonstrated:');
  logger.info('- Agent registration with capabilities');
  logger.info('- Hierarchical connections (parent-child)');
  logger.info('- Message subscription per agent');
  logger.info('- Broadcast to children');
  logger.info('- Two-phase response (ACK + async result)');
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
    '[Topology Demo] Error',
  );
  process.exit(1);
});
