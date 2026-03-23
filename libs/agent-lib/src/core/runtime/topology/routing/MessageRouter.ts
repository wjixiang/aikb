/**
 * MessageRouter - Routes messages based on topology and routing decisions
 *
 * Integrates with router agents to make intelligent routing decisions
 * and handles message delivery according to those decisions.
 */

import type {
  TopologyMessage,
  RoutingDecision,
  TopologyNode,
} from '../types.js';
import { createMessage } from '../types.js';
import type { ITopologyGraph } from '../graph/TopologyGraph.js';
import type { IMessageBus } from '../messaging/MessageBus.js';
import { RoutingTools, createRoutingTools } from './RoutingTools.js';

export interface IMessageRouter {
  route(message: TopologyMessage): Promise<RoutingDecision>;
  registerRouter(instanceId: string): void;
  unregisterRouter(instanceId: string): void;
  isRouter(instanceId: string): boolean;
  getRouters(): string[];
  setMessageBus(bus: IMessageBus): void;
  setDefaultRouter(routerId: string): void;
}

export class MessageRouter implements IMessageRouter {
  private graph: ITopologyGraph;
  private messageBus?: IMessageBus;
  private routers: Map<string, RoutingTools> = new Map();
  private defaultRouter?: string;

  constructor(graph: ITopologyGraph) {
    this.graph = graph;
  }

  setMessageBus(bus: IMessageBus): void {
    this.messageBus = bus;
  }

  setDefaultRouter(routerId: string): void {
    if (!this.graph.hasNode(routerId)) {
      throw new Error(`Router ${routerId} not found in topology`);
    }
    this.defaultRouter = routerId;
  }

  registerRouter(instanceId: string): void {
    if (!this.graph.hasNode(instanceId)) {
      throw new Error(`Node ${instanceId} not found in topology`);
    }

    const context = {
      graph: this.graph,
      routerInstanceId: instanceId,
    };

    this.routers.set(instanceId, createRoutingTools(context));

    if (!this.defaultRouter) {
      this.defaultRouter = instanceId;
    }
  }

  unregisterRouter(instanceId: string): void {
    this.routers.delete(instanceId);
    if (this.defaultRouter === instanceId) {
      this.defaultRouter = this.routers.keys().next().value;
    }
  }

  isRouter(instanceId: string): boolean {
    return this.routers.has(instanceId);
  }

  getRouters(): string[] {
    return Array.from(this.routers.keys());
  }

  async route(message: TopologyMessage): Promise<RoutingDecision> {
    if (message.ttl <= 0) {
      return {
        action: 'reject',
        reasoning: 'Message TTL exceeded',
      };
    }

    const targetNode = this.graph.getNode(message.to);

    if (targetNode?.nodeType === 'router') {
      return this.routeViaRouter(message, message.to);
    }

    if (this.defaultRouter) {
      return this.routeViaRouter(message, this.defaultRouter);
    }

    return this.routeAutonomously(message);
  }

  private async routeViaRouter(
    message: TopologyMessage,
    routerId: string,
  ): Promise<RoutingDecision> {
    const tools = this.routers.get(routerId);
    if (!tools) {
      return this.routeAutonomously(message);
    }

    const decision = tools.decideRoute(message.content, message.from);

    if (decision.action === 'forward' && decision.targetInstanceIds) {
      const nextHop = decision.targetInstanceIds[0];
      const forwarded = createMessage(
        message.from,
        nextHop,
        message.content,
        message.messageType,
        { conversationId: message.conversationId, ttl: message.ttl - 1 },
      );

      if (this.messageBus) {
        await this.messageBus.send(forwarded);
      }
    }

    return decision;
  }

  private async routeAutonomously(
    message: TopologyMessage,
  ): Promise<RoutingDecision> {
    const children = this.graph.getChildren(message.to);

    if (children.length === 0) {
      return {
        action: 'respond',
        reasoning: 'No children to route to, responding directly',
      };
    }

    const nextHop = children[0];
    const forwarded = createMessage(
      message.from,
      nextHop.instanceId,
      message.content,
      message.messageType,
      { conversationId: message.conversationId, ttl: message.ttl - 1 },
    );

    if (this.messageBus) {
      await this.messageBus.send(forwarded);
    }

    return {
      action: 'forward',
      targetInstanceIds: [nextHop.instanceId],
      reasoning: `Autonomous routing to ${nextHop.instanceId}`,
    };
  }
}

export function createMessageRouter(graph: ITopologyGraph): IMessageRouter {
  return new MessageRouter(graph);
}
