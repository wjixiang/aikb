/**
 * demoA2ACommunication.ts - A2A (Agent-to-Agent) Communication Demonstration
 *
 * This demo showcases how to use the A2A protocol for agent-to-agent communication:
 *
 * ## Two Integration Modes
 *
 * ### Mode 1: Low-Level A2A (This Demo)
 * Use A2AClient/A2AHandler directly with MockMessageBus for testing
 * and understanding the A2A protocol.
 *
 * ### Mode 2: Integrated A2A (Production)
 * AgentRuntime automatically sets up A2A for every agent:
 * - Each agent gets an A2A Client and Handler
 * - Agents communicate via RuntimeControlClient.sendA2A* methods
 * - See AgentRuntime integration for production use
 *
 * Run: npx tsx src/core/a2a/__tests__/demoA2ACommunication.ts
 */

import pino from 'pino';
import { A2AClient, AgentCardRegistry, A2AHandler, createConversationId, createA2AMessageId, type A2APayload, type A2AResponse } from '../';
import type { IMessageBus } from '../../runtime/topology/messaging/MessageBus';
import type { TopologyMessage } from '../../runtime/topology/types.js';

// Setup logger
const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Mock Message Bus for demonstration
 * Implements the IMessageBus interface for testing A2A communication
 */
class MockMessageBus implements IMessageBus {
  private conversations = new Map<string, any>();
  private messageHandlers: ((message: TopologyMessage) => void)[] = [];
  private eventHandlers: ((event: any) => void)[] = [];

  async send(message: TopologyMessage): Promise<TopologyMessage> {
    logger.debug({ messageId: message.messageId }, '[MockBus] Sending message');
    return {
      messageId: `ack_${Date.now()}`,
      conversationId: message.conversationId,
      from: message.to,
      to: message.from,
      content: { status: 'acknowledged' },
      messageType: 'ack',
      ttl: 10,
      timestamp: Date.now(),
    } as TopologyMessage;
  }

  publish(message: TopologyMessage): void {
    logger.debug({ messageId: message.messageId }, '[MockBus] Publishing message');
    this.messageHandlers.forEach((h) => h(message));
  }

  async sendAck(to: string, conversationId: string, content?: unknown): Promise<TopologyMessage> {
    logger.debug({ to, conversationId }, '[MockBus] ACK sent');
    return {
      messageId: `ack_${Date.now()}`,
      conversationId,
      from: 'system',
      to,
      content: content ?? { status: 'acknowledged', conversationId },
      messageType: 'ack',
      ttl: 10,
      timestamp: Date.now(),
    } as TopologyMessage;
  }

  async sendResult(to: string, conversationId: string, payload: A2APayload): Promise<TopologyMessage> {
    logger.debug({ to, conversationId }, '[MockBus] Result sent');
    // Update conversation with result
    const existing = this.conversations.get(conversationId);
    if (existing) {
      existing.result = payload;
      existing.status = 'completed';
    }
    return {
      messageId: `result_${Date.now()}`,
      conversationId,
      from: 'system',
      to,
      content: payload,
      messageType: 'result',
      ttl: 10,
      timestamp: Date.now(),
    } as TopologyMessage;
  }

  async sendError(to: string, conversationId: string, error: string): Promise<TopologyMessage> {
    logger.debug({ to, conversationId, error }, '[MockBus] Error sent');
    return {
      messageId: `error_${Date.now()}`,
      conversationId,
      from: 'system',
      to,
      content: { error },
      messageType: 'error',
      ttl: 10,
      timestamp: Date.now(),
    } as TopologyMessage;
  }

  async broadcast(from: string, toInstances: string[], content: unknown, conversationId?: string): Promise<TopologyMessage[]> {
    const results: TopologyMessage[] = [];
    for (const to of toInstances) {
      const message = {
        messageId: `broadcast_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        conversationId: conversationId ?? `broadcast_${Date.now()}`,
        from,
        to,
        content,
        messageType: 'event' as const,
        ttl: 10,
        timestamp: Date.now(),
      };
      results.push(message);
      this.messageHandlers.forEach((h) => h(message));
    }
    return results;
  }

  onMessage(handler: (message: TopologyMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onEvent(handler: (event: any) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  getConversation(id: string) {
    return this.conversations.get(id);
  }

  getPendingConversations() {
    return Array.from(this.conversations.values());
  }

  getActiveConversations() {
    return Array.from(this.conversations.values());
  }

  setConfig(config: any): void {
    logger.debug({ config }, '[MockBus] Config set');
  }

  getConfig() {
    return {
      defaultAckTimeout: 5000,
      defaultResultTimeout: 60000,
      maxRetries: 3,
      defaultTtl: 10,
    };
  }

  // For demo: simulate completing a conversation
  completeConversation(conversationId: string, result: A2APayload) {
    this.conversations.set(conversationId, {
      conversationId,
      status: 'completed',
      result,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ttl: 10,
    });
  }
}

/**
 * Demo: Complete A2A Communication Flow
 */
async function demoA2ACommunication() {
  logger.info('=== A2A Communication Demo Started ===\n');

  // ============================================================
  // Step 1: Create Message Bus and Agent Registry
  // ============================================================
  const messageBus = new MockMessageBus();
  const registry = new AgentCardRegistry();

  logger.info('[Step 1] Created message bus and agent registry');

  // ============================================================
  // Step 2: Register Agents in the A2A Registry
  // ============================================================
  const agentAlpha = {
    instanceId: 'agent-alpha-001',
    name: 'Alpha Agent',
    description: 'Primary research agent for literature search',
    version: '1.0.0',
    capabilities: ['search', 'analysis', 'synthesis'],
    skills: ['pubmed-search', 'data-analysis'],
    endpoint: 'agent-alpha-001',
    metadata: { department: 'research' },
  };

  const agentBeta = {
    instanceId: 'agent-beta-002',
    name: 'Beta Agent',
    description: 'Secondary agent for data validation',
    version: '1.0.0',
    capabilities: ['validation', 'verification'],
    skills: ['data-validation', 'quality-check'],
    endpoint: 'agent-beta-002',
    metadata: { department: 'qa' },
  };

  registry.register(agentAlpha);
  registry.register(agentBeta);

  logger.info(
    { registeredAgents: registry.getAllAgents().length },
    '[Step 2] Registered agents in A2A registry',
  );

  // ============================================================
  // Step 3: Set up A2A Handler for Agent Beta (receiver)
  // ============================================================
  const handlerBeta = new A2AHandler(messageBus, {
    instanceId: agentBeta.instanceId,
    supportedTypes: ['task', 'query', 'event', 'cancel'],
    handlerTimeout: 30000,
  });

  // Register task handler - Agent Beta processes tasks
  handlerBeta.onTask(async (payload, ctx) => {
    logger.info(
      { taskId: payload.taskId, from: ctx.message.from },
      '[Agent Beta] Received task, processing...',
    );

    // Simulate task processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      taskId: payload.taskId!,
      status: 'completed' as const,
      output: {
        result: `Task ${payload.taskId} completed successfully`,
        data: { processed: true, records: 42 },
      },
      metadata: { processedBy: 'agent-beta-002' },
    };
  });

  // Register query handler - must return A2AResponse with messageId, content, success
  handlerBeta.onQuery(async (payload, ctx) => {
    logger.info({ from: ctx.message.from }, '[Agent Beta] Received query');

    // Return A2AResponse format
    return {
      messageId: createA2AMessageId(),
      content: {
        output: { response: 'Query received. Status: ready' },
        status: 'completed' as const,
      },
      success: true,
    };
  });

  // Register event handler - returns void
  handlerBeta.onEvent(async (payload, ctx) => {
    // Access eventType and data from the message content (they're in the raw message)
    const eventType = (ctx.message as any).content?.eventType || 'unknown';
    const data = (ctx.message as any).content?.data || {};
    logger.info(
      { eventType, data },
      '[Agent Beta] Received event',
    );
    // Return void
  });

  // Register cancel handler - receives taskId: string
  handlerBeta.onCancel(async (taskId, ctx) => {
    logger.info({ taskId }, '[Agent Beta] Received cancel request');
    // Return void
  });

  // Start listening
  handlerBeta.startListening();
  logger.info('[Step 3] Agent Beta A2A Handler started (listening for messages)');

  // ============================================================
  // Step 4: Create A2A Client for Agent Alpha (sender)
  // ============================================================
  const clientAlpha = new A2AClient(messageBus, registry, {
    instanceId: agentAlpha.instanceId,
  });

  logger.info('[Step 4] Agent Alpha A2A Client initialized');

  // ============================================================
  // Step 5: Send a Task from Alpha to Beta
  // ============================================================
  logger.info('\n[Step 5] Sending task from Alpha to Beta...');

  // Set up mock to complete conversation after ACK
  const originalSend = messageBus.send.bind(messageBus);
  messageBus.send = async (message: TopologyMessage) => {
    const ack = await originalSend(message);
    // Simulate Beta processing and completing the conversation
    setTimeout(() => {
      messageBus.completeConversation(message.conversationId, {
        taskId: (message.content as any)?.content?.taskId,
        status: 'completed',
        output: {
          result: 'Task completed successfully',
          data: { processed: true, records: 42 },
        },
      });
    }, 100);
    return ack;
  };

  try {
    const taskResult = await clientAlpha.sendTask(
      agentBeta.instanceId, // Target
      'task-search-001', // Task ID
      'Search PubMed for椎间盘突出流行病学研究', // Description
      {
        // Input data
        query: 'lumbar disc herniation epidemiology',
        database: 'pubmed',
        limit: 10,
        filters: { year: '2020-2024', language: 'en' },
      },
      { priority: 'high' }, // Options
    );

    logger.info({ taskResult }, '[Step 5] Task result received!');
    logger.info(`  Task ID: ${taskResult.taskId}`);
    logger.info(`  Status: ${taskResult.status}`);
    logger.info(`  Output: ${JSON.stringify(taskResult.output, null, 2)}`);
  } catch (error) {
    logger.error({ error }, '[Step 5] Task failed');
  }

  // ============================================================
  // Step 6: Send a Query from Alpha to Beta
  // ============================================================
  logger.info('\n[Step 6] Sending query from Alpha to Beta...');

  try {
    const queryResponse = await clientAlpha.sendQuery(
      agentBeta.instanceId,
      'What is the current system status?',
      { expectedFormat: 'json' },
    );

    logger.info({ queryResponse }, '[Step 6] Query response received!');
  } catch (error) {
    logger.error({ error }, '[Step 6] Query failed');
  }

  // ============================================================
  // Step 7: Send an Event from Alpha to Beta
  // ============================================================
  logger.info('\n[Step 7] Sending event notification from Alpha to Beta...');

  await clientAlpha.sendEvent(
    agentBeta.instanceId,
    'agent:status',
    { agentId: agentAlpha.instanceId, status: 'busy', taskCount: 3 },
  );

  logger.info('[Step 7] Event sent (fire-and-forget)');

  // ============================================================
  // Step 8: Send a Response (Bidirectional Communication)
  // ============================================================
  logger.info('\n[Step 8] Sending response from Beta to Alpha...');

  await clientAlpha.sendResponse(
    agentBeta.instanceId,
    { confirmation: 'Data received', recordsValidated: 42 },
    'completed',
    { taskId: 'task-search-001' },
  );

  logger.info('[Step 8] Response sent (fire-and-forget)');

  // ============================================================
  // Cleanup
  // ============================================================
  handlerBeta.stopListening();

  logger.info('\n=== A2A Communication Demo Completed ===');
  logger.info('\nSummary:');
  logger.info('  - Created A2A Registry and registered 2 agents');
  logger.info('  - Set up A2A Handler for receiving messages');
  logger.info('  - Created A2A Client for sending messages');
  logger.info('  - Demonstrated: sendTask, sendQuery, sendEvent, sendResponse');
  logger.info('\nA2A Message Types:');
  logger.info('  - task: Request another agent to perform work');
  logger.info('  - query: Request information from another agent');
  logger.info('  - response: Respond to a task or query');
  logger.info('  - event: Fire-and-forget notification');
  logger.info('  - cancel: Cancel an ongoing task');
}

/**
 * Example: AgentRuntime Integration (Production Mode)
 *
 * When using AgentRuntime, A2A is automatically configured for each agent.
 * Agents can send A2A messages via their RuntimeControlClient:
 *
 * ```typescript
 * import { AgentRuntime } from './runtime/AgentRuntime';
 *
 * // Create runtime
 * const runtime = createAgentRuntime({ maxAgents: 10 });
 *
 * // Create agents (A2A is automatically set up)
 * const agentId1 = await runtime.createAgent({
 *   agent: { name: 'Research Agent', type: 'researcher' }
 * });
 * const agentId2 = await runtime.createAgent({
 *   agent: { name: 'Analyzer Agent', type: 'analyzer' }
 * });
 *
 * // Get agent and send A2A message
 * const agent = await runtime.getAgent(agentId1);
 * const result = await agent.getRuntimeClient().sendA2ATask(
 *   agentId2,           // target
 *   'task-001',        // task ID
 *   'Analyze data',    // description
 *   { data: '...' }    // input
 * );
 *
 * console.log(result.output);
 * ```
 *
 * For low-level A2A testing, use the demo above (Mode 1).
 */

// Run the demo
demoA2ACommunication().catch((error) => {
  logger.error(
    { error },
    '[Demo] A2A Communication Demo failed',
  );
  process.exit(1);
});
