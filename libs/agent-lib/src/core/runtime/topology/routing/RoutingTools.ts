/**
 * RoutingTools - Tools available to RouterAgent for making routing decisions
 *
 * Provides a set of tools that the router agent can use to query the topology
 * and make informed routing decisions.
 */

import type { ITopologyGraph } from '../graph/TopologyGraph.js';
import type { TopologyNode, RoutingDecision } from '../types.js';

export interface RoutingToolsContext {
  graph: ITopologyGraph;
  routerInstanceId: string;
}

export class RoutingTools {
  constructor(private context: RoutingToolsContext) {}

  getNeighbors(agentId: string): TopologyNode[] {
    return this.context.graph.getNeighbors(agentId);
  }

  getChildren(agentId: string): TopologyNode[] {
    return this.context.graph.getChildren(agentId);
  }

  getParent(agentId: string): TopologyNode | undefined {
    return this.context.graph.getParent(agentId);
  }

  getNode(agentId: string): TopologyNode | undefined {
    return this.context.graph.getNode(agentId);
  }

  findPath(from: string, to: string): string[] | null {
    return this.context.graph.findPath(from, to);
  }

  isReachable(from: string, to: string): boolean {
    return this.context.graph.isReachable(from, to);
  }

  getAllNodes(): TopologyNode[] {
    return this.context.graph.getAllNodes();
  }

  getRoutableAgents(): TopologyNode[] {
    return this.context.graph
      .getAllNodes()
      .filter(
        (node) => node.nodeType === 'router' || node.nodeType === 'worker',
      );
  }

  getAgentsByCapability(capability: string): TopologyNode[] {
    return this.context.graph
      .getAllNodes()
      .filter((node) => node.capabilities?.includes(capability));
  }

  forwardToAgents(targetIds: string[], reasoning?: string): RoutingDecision {
    return {
      action: 'forward',
      targetInstanceIds: targetIds,
      reasoning,
    };
  }

  broadcastToChildren(reasoning?: string): RoutingDecision {
    const children = this.getChildren(this.context.routerInstanceId);
    return {
      action: 'broadcast',
      targetInstanceIds: children.map((c) => c.instanceId),
      reasoning,
    };
  }

  respond(reasoning?: string): RoutingDecision {
    return {
      action: 'respond',
      reasoning,
    };
  }

  reject(reason: string): RoutingDecision {
    return {
      action: 'reject',
      reasoning: reason,
    };
  }

  decideRoute(message: unknown, senderId: string): RoutingDecision {
    const children = this.getChildren(this.context.routerInstanceId);

    if (children.length === 0) {
      return this.respond('No children available, responding directly');
    }

    const msgContent = message as { task?: string; query?: string };
    if (msgContent.task === 'search' || msgContent.query) {
      const searchCapable = children.filter((c) =>
        c.capabilities?.includes('search'),
      );

      if (searchCapable.length > 0) {
        return this.forwardToAgents(
          [searchCapable[0].instanceId],
          `Routing search task to ${searchCapable[0].instanceId}`,
        );
      }
    }

    return this.forwardToAgents(
      [children[0].instanceId],
      `Default routing to first available child`,
    );
  }
}

export function createRoutingTools(context: RoutingToolsContext): RoutingTools {
  return new RoutingTools(context);
}
