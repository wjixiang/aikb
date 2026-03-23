/**
 * TopologyBuilder - Builder for creating common topology patterns
 *
 * Provides methods to build fully connected, ring, hierarchical, and custom topologies.
 */

import type { ITopologyGraph } from './TopologyGraph.js';
import type { TopologyNode, TopologyNodeType, EdgeType } from '../types.js';

export interface TopologyBuilderOptions {
  nodeType?: TopologyNodeType;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export class TopologyBuilder {
  constructor(private graph: ITopologyGraph) {}

  addNode(instanceId: string, options?: TopologyBuilderOptions): this {
    const node: TopologyNode = {
      instanceId,
      nodeType: options?.nodeType ?? 'worker',
      capabilities: options?.capabilities,
      metadata: options?.metadata,
    };
    this.graph.addNode(node);
    return this;
  }

  addNodes(instanceIds: string[], options?: TopologyBuilderOptions): this {
    for (const instanceId of instanceIds) {
      this.addNode(instanceId, options);
    }
    return this;
  }

  connect(from: string, to: string, edgeType: EdgeType = 'peer'): this {
    if (!this.graph.hasEdge(from, to)) {
      this.graph.addEdge({
        from,
        to,
        edgeType,
        bidirectional: edgeType === 'peer',
      });
    }
    return this;
  }

  connectAll(edgeType: EdgeType = 'peer'): this {
    const nodes = this.graph.getAllNodes();
    const nodeIds = nodes.map((n) => n.instanceId);

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = 0; j < nodeIds.length; j++) {
        if (i !== j) {
          this.connect(nodeIds[i], nodeIds[j], edgeType);
        }
      }
    }

    return this;
  }

  buildFullyConnected(): this {
    const nodes = this.graph.getAllNodes();
    const nodeIds = nodes.map((n) => n.instanceId);

    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        this.graph.addEdge({
          from: nodeIds[i],
          to: nodeIds[j],
          edgeType: 'peer',
          bidirectional: true,
        });
      }
    }

    return this;
  }

  buildRing(): this {
    const nodes = this.graph.getAllNodes();
    const nodeIds = nodes.map((n) => n.instanceId);

    if (nodeIds.length < 2) {
      return this;
    }

    for (let i = 0; i < nodeIds.length; i++) {
      const next = (i + 1) % nodeIds.length;
      this.graph.addEdge({
        from: nodeIds[i],
        to: nodeIds[next],
        edgeType: 'peer',
        bidirectional: false,
      });
    }

    return this;
  }

  buildStar(centerId: string): this {
    const nodes = this.graph.getAllNodes();
    const nodeIds = nodes.map((n) => n.instanceId);

    for (const nodeId of nodeIds) {
      if (nodeId !== centerId) {
        this.graph.addEdge({
          from: centerId,
          to: nodeId,
          edgeType: 'parent-child',
          bidirectional: false,
        });
      }
    }

    return this;
  }

  buildTree(rootId: string): this {
    const nodes = this.graph.getAllNodes();
    const nodeIds = nodes.map((n) => n.instanceId);
    const nodeSet = new Set(nodeIds);

    if (!nodeSet.has(rootId)) {
      return this;
    }

    const visited = new Set<string>();
    const queue: string[] = [rootId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      const currentIndex = nodeIds.indexOf(current);
      const childrenStart = (currentIndex + 1) * 2;
      const childrenEnd = Math.min(childrenStart + 2, nodeIds.length);

      for (let i = childrenStart; i < childrenEnd && i < nodeIds.length; i++) {
        const childId = nodeIds[i];
        if (!visited.has(childId)) {
          this.graph.addEdge({
            from: current,
            to: childId,
            edgeType: 'parent-child',
            bidirectional: false,
          });
          queue.push(childId);
        }
      }
    }

    return this;
  }

  buildHierarchical(
    rootId: string,
    levels: Array<{ count: number; nodeType?: TopologyNodeType }>,
  ): this {
    const allNodeIds: string[] = [rootId];
    let currentLevelNodes: string[] = [rootId];

    for (const level of levels) {
      const nextLevelNodes: string[] = [];

      for (const parentId of currentLevelNodes) {
        for (let i = 0; i < level.count; i++) {
          const childId = `${parentId}_child_${i}`;
          allNodeIds.push(childId);
          nextLevelNodes.push(childId);

          this.graph.addNode({
            instanceId: childId,
            nodeType: level.nodeType ?? 'worker',
          });

          this.graph.addEdge({
            from: parentId,
            to: childId,
            edgeType: 'parent-child',
            bidirectional: false,
          });
        }
      }

      currentLevelNodes = nextLevelNodes;
    }

    return this;
  }

  getGraph(): ITopologyGraph {
    return this.graph;
  }
}

export function createTopologyBuilder(graph: ITopologyGraph): TopologyBuilder {
  return new TopologyBuilder(graph);
}
