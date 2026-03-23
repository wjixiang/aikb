/**
 * A2A (Agent-to-Agent) Communication Module
 *
 * Provides standardized agent-to-agent communication based on the A2A protocol.
 *
 * @example
 * ```typescript
 * import { createA2AServer } from './a2a';
 *
 * const server = createA2AServer({
 *   instanceId: 'my-agent-001',
 *   name: 'My Agent',
 *   description: 'A test agent',
 *   capabilities: ['search', 'analysis'],
 *   skills: ['pubmed-search', 'paper-analysis'],
 * });
 *
 * // Set up topology network
 * server.setTopologyNetwork(topologyNetwork);
 *
 * // Register handlers
 * server.onTask(async (payload, ctx) => {
 *   return { taskId: payload.taskId!, status: 'completed', output: { result: 'done' } };
 * });
 *
 * // Start server
 * server.start();
 * ```
 */

// Types
export * from './types.js';

// Agent Card Registry
export {
  AgentCardRegistry,
  getGlobalAgentRegistry,
  setGlobalAgentRegistry,
  type IAgentCardRegistry,
} from './AgentCard.js';

// A2A Client
export { A2AClient, createA2AClient, type IA2AClient } from './A2AClient.js';

// A2A Handler
export { A2AHandler, createA2AHandler, type IA2AHandler } from './A2AHandler.js';

// A2A Server
export {
  A2AServer,
  createA2AServer,
  createA2AComponent,
  type A2AServerConfig,
  type IA2AServer,
  type A2AComponent,
} from './A2AServer.js';
