/**
 * A2A (Agent-to-Agent) Communication Module
 *
 * Provides standardized agent-to-agent communication based on the A2A protocol.
 *
 * @example
 * ```typescript
 * import { AgentCardRegistry, A2AClient, A2AHandler } from './a2a';
 *
 * // 创建 Agent 注册表
 * const registry = new AgentCardRegistry();
 * registry.register({
 *   instanceId: 'my-agent-001',
 *   name: 'My Agent',
 *   description: 'A test agent',
 *   capabilities: ['search', 'analysis'],
 *   skills: ['pubmed-search'],
 *   endpoint: 'my-agent-001',
 * });
 *
 * // 创建 A2A Client（用于发送消息）
 * const client = new A2AClient(messageBus, registry, {
 *   instanceId: 'my-agent-001',
 * });
 *
 * // 创建 A2A Handler（用于接收消息）
 * const handler = new A2AHandler(messageBus, {
 *   instanceId: 'my-agent-001',
 *   supportedTypes: ['task', 'query', 'event'],
 * });
 *
 * // 注册任务处理器
 * handler.onTask(async (payload, ctx) => {
 *   return { taskId: payload.taskId!, status: 'completed', output: { result: 'done' } };
 * });
 *
 * // 启动监听
 * handler.startListening();
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
