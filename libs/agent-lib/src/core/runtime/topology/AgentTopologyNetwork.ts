/**
 * AgentTopologyNetwork - Main class for multi-agent topology network
 *
 * Manages agent topology, message routing, and the two-phase response protocol
 * for agent communication.
 */

import type {
  TopologyNode,
  TopologyNodeType,
  TopologyEdge,
  EdgeType,
  TopologyMessage,
  TopologyConfig,
  RoutingStats,
  EventHandler,
  Conversation,
  TopologyEvent,
} from './types.js';
import {
  createMessage,
  DEFAULT_TOPOLOGY_CONFIG,
  createTopologyEvent,
} from './types.js';
import {
  TopologyGraph,
  createTopologyGraph,
  type ITopologyGraph,
} from './graph/TopologyGraph.js';
import {
  TopologyBuilder,
  createTopologyBuilder,
} from './graph/TopologyBuilder.js';
import {
  MessageBus,
  createMessageBus,
  type IMessageBus,
} from './messaging/MessageBus.js';
import {
  MessageRouter,
  createMessageRouter,
  type IMessageRouter,
} from './routing/MessageRouter.js';

export interface IAgentTopologyNetwork {
  initialize(config?: TopologyConfig): Promise<void>;

  registerAgent(
    instanceId: string,
    nodeType: TopologyNodeType,
    capabilities?: string[],
  ): void;
  unregisterAgent(instanceId: string): void;

  connect(from: string, to: string, edgeType?: EdgeType): void;
  disconnect(from: string, to: string): void;

  request(
    to: string,
    content: unknown,
    from?: string,
  ): Promise<{
    ack: TopologyMessage;
    result: Promise<TopologyMessage>;
  }>;
  send(
    to: string,
    content: unknown,
    messageType?: TopologyMessage['messageType'],
  ): Promise<TopologyMessage>;
  broadcast(from: string, content: unknown): Promise<TopologyMessage[]>;

  subscribe(
    instanceId: string,
    handler: (message: TopologyMessage) => void,
  ): () => void;
  unsubscribe(instanceId: string): void;

  attachRuntime(runtime: unknown): void;
  detachRuntime(): void;

  buildTopology(type: 'fully-connected' | 'ring' | 'star' | 'tree'): this;
  createRouter(routerId: string): void;

  getGraph(): ITopologyGraph;
  getMessageBus(): IMessageBus;
  getRouter(): IMessageRouter;
  getConversation(conversationId: string): Conversation | undefined;
  getStats(): RoutingStats;

  onEvent(handler: EventHandler): () => void;
}

export class AgentTopologyNetwork implements IAgentTopologyNetwork {
  private graph: ITopologyGraph;
  private messageBus: IMessageBus;
  private router: IMessageRouter;
  private eventHandlers: Set<EventHandler> = new Set();
  private runtime?: unknown;
  private messageHandlers: Map<string, (message: TopologyMessage) => void> =
    new Map();
  private initialized = false;

  constructor(config?: TopologyConfig) {
    this.graph = createTopologyGraph();
    this.messageBus = createMessageBus(config);
    this.router = createMessageRouter(this.graph);

    this.router.setMessageBus(this.messageBus);

    this.messageBus.onMessage((message) => {
      this.handleMessage(message);
    });

    this.messageBus.onEvent((event) => {
      this.emitEvent(event);
    });
  }

  async initialize(_config?: TopologyConfig): Promise<void> {
    this.initialized = true;
  }

  registerAgent(
    instanceId: string,
    nodeType: TopologyNodeType,
    capabilities?: string[],
  ): void {
    const node: TopologyNode = {
      instanceId,
      nodeType,
      capabilities,
    };
    this.graph.addNode(node);
    this.emitEvent(
      createTopologyEvent('node:added', {
        instanceId,
        nodeType,
        capabilities,
      }),
    );
  }

  unregisterAgent(instanceId: string): void {
    this.graph.removeNode(instanceId);
    this.messageHandlers.delete(instanceId);
    this.emitEvent(createTopologyEvent('node:removed', { instanceId }));
  }

  connect(from: string, to: string, edgeType: EdgeType = 'peer'): void {
    const edge: TopologyEdge = {
      from,
      to,
      edgeType,
      bidirectional: edgeType === 'peer',
    };
    this.graph.addEdge(edge);
  }

  disconnect(from: string, to: string): void {
    this.graph.removeEdge(from, to);
  }

  async request(
    to: string,
    content: unknown,
    from: string = 'external',
  ): Promise<{ ack: TopologyMessage; result: Promise<TopologyMessage> }> {
    const message = createMessage(from, to, content, 'request');

    const ack = await this.messageBus.send(message);

    const resultPromise = new Promise<TopologyMessage>((resolve, reject) => {
      const checkResult = () => {
        const conversation = this.messageBus.getConversation(
          message.conversationId,
        );
        if (conversation?.status === 'completed' && conversation.result) {
          resolve(conversation.result);
        } else if (
          conversation?.status === 'failed' ||
          conversation?.status === 'timeout'
        ) {
          reject(
            new Error(
              `Conversation ${message.conversationId} ${conversation.status}`,
            ),
          );
        } else {
          setTimeout(checkResult, 100);
        }
      };
      setTimeout(checkResult, 100);
    });

    return { ack, result: resultPromise };
  }

  async send(
    to: string,
    content: unknown,
    messageType: TopologyMessage['messageType'] = 'event',
  ): Promise<TopologyMessage> {
    const message = createMessage('system', to, content, messageType);
    this.messageBus.publish(message);
    return message;
  }

  async broadcast(from: string, content: unknown): Promise<TopologyMessage[]> {
    const children = this.graph.getChildren(from);
    const toInstances = children.map((c) => c.instanceId);
    return this.messageBus.broadcast(from, toInstances, content);
  }

  subscribe(
    instanceId: string,
    handler: (message: TopologyMessage) => void,
  ): () => void {
    this.messageHandlers.set(instanceId, handler);
    return () => {
      this.messageHandlers.delete(instanceId);
    };
  }

  unsubscribe(instanceId: string): void {
    this.messageHandlers.delete(instanceId);
  }

  attachRuntime(runtime: unknown): void {
    this.runtime = runtime;
  }

  detachRuntime(): void {
    this.runtime = undefined;
  }

  buildTopology(type: 'fully-connected' | 'ring' | 'star' | 'tree'): this {
    const builder = createTopologyBuilder(this.graph);

    switch (type) {
      case 'fully-connected':
        builder.buildFullyConnected();
        break;
      case 'ring':
        builder.buildRing();
        break;
      case 'star':
        const nodes = this.graph.getAllNodes();
        if (nodes.length > 0) {
          builder.buildStar(nodes[0].instanceId);
        }
        break;
      case 'tree':
        const allNodes = this.graph.getAllNodes();
        if (allNodes.length > 0) {
          builder.buildTree(allNodes[0].instanceId);
        }
        break;
    }

    return this;
  }

  createRouter(routerId: string): void {
    this.registerAgent(routerId, 'router', ['routing']);
    this.router.registerRouter(routerId);

    const nodes = this.graph
      .getAllNodes()
      .filter((n) => n.instanceId !== routerId);
    for (const node of nodes) {
      this.connect(routerId, node.instanceId, 'parent-child');
    }
  }

  getGraph(): ITopologyGraph {
    return this.graph;
  }

  getMessageBus(): IMessageBus {
    return this.messageBus;
  }

  getRouter(): IMessageRouter {
    return this.router;
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.messageBus.getConversation(conversationId);
  }

  getStats(): RoutingStats {
    const conversations = this.messageBus.getActiveConversations();
    const allConversations = [
      ...this.messageBus.getActiveConversations(),
      ...this.messageBus.getPendingConversations(),
    ];

    return {
      totalMessages: 0,
      totalConversations: allConversations.length,
      activeConversations: conversations.length,
      completedConversations: 0,
      failedConversations: 0,
      timedOutConversations: 0,
    };
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private handleMessage(message: TopologyMessage): void {
    const handler = this.messageHandlers.get(message.to);
    if (handler) {
      try {
        handler(message);
      } catch (error) {
        console.error(
          `[AgentTopologyNetwork] Handler error for ${message.to}:`,
          error,
        );
      }
    }
  }

  private emitEvent(event: TopologyEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[AgentTopologyNetwork] Event handler error:', error);
      }
    }
  }
}

export function createAgentTopologyNetwork(
  config?: TopologyConfig,
): IAgentTopologyNetwork {
  return new AgentTopologyNetwork(config);
}
