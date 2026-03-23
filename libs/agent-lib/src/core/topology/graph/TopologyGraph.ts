/**
 * TopologyGraph - Graph structure for agent topology network
 *
 * Manages nodes (agents) and edges (connections) in a directed graph.
 * Supports querying neighbors, children, parents, and pathfinding.
 */

import type { TopologyNode, TopologyEdge, EdgeType } from '../types.js';

export interface ITopologyGraph {
  addNode(node: TopologyNode): void;
  removeNode(instanceId: string): void;
  getNode(instanceId: string): TopologyNode | undefined;
  hasNode(instanceId: string): boolean;
  getAllNodes(): TopologyNode[];

  addEdge(edge: TopologyEdge): void;
  removeEdge(from: string, to: string): void;
  hasEdge(from: string, to: string): boolean;
  getEdge(from: string, to: string): TopologyEdge | undefined;
  getAllEdges(): TopologyEdge[];

  getNeighbors(instanceId: string): TopologyNode[];
  getChildren(instanceId: string): TopologyNode[];
  getParent(instanceId: string): TopologyNode | undefined;
  getParents(instanceId: string): TopologyNode[];

  findPath(from: string, to: string): string[] | null;
  isReachable(from: string, to: string): boolean;

  clear(): void;
  size: { nodes: number; edges: number };
}

export class TopologyGraph implements ITopologyGraph {
  private nodes: Map<string, TopologyNode> = new Map();
  private edges: Map<string, Map<string, TopologyEdge>> = new Map();

  addNode(node: TopologyNode): void {
    if (this.nodes.has(node.instanceId)) {
      throw new Error(`Node ${node.instanceId} already exists`);
    }
    this.nodes.set(node.instanceId, node);
    if (!this.edges.has(node.instanceId)) {
      this.edges.set(node.instanceId, new Map());
    }
  }

  removeNode(instanceId: string): void {
    if (!this.nodes.has(instanceId)) {
      return;
    }

    this.nodes.delete(instanceId);
    this.edges.delete(instanceId);

    for (const [from, toEdges] of this.edges) {
      toEdges.delete(instanceId);
    }
  }

  getNode(instanceId: string): TopologyNode | undefined {
    return this.nodes.get(instanceId);
  }

  hasNode(instanceId: string): boolean {
    return this.nodes.has(instanceId);
  }

  getAllNodes(): TopologyNode[] {
    return Array.from(this.nodes.values());
  }

  addEdge(edge: TopologyEdge): void {
    if (!this.nodes.has(edge.from)) {
      throw new Error(`Node ${edge.from} does not exist`);
    }
    if (!this.nodes.has(edge.to)) {
      throw new Error(`Node ${edge.to} does not exist`);
    }

    const fromEdges = this.edges.get(edge.from)!;
    fromEdges.set(edge.to, edge);

    if (edge.bidirectional) {
      const reverseEdge: TopologyEdge = {
        from: edge.to,
        to: edge.from,
        edgeType: edge.edgeType,
        weight: edge.weight,
        bidirectional: false,
      };
      const toEdges = this.edges.get(edge.to)!;
      toEdges.set(edge.from, reverseEdge);
    }
  }

  removeEdge(from: string, to: string): void {
    const fromEdges = this.edges.get(from);
    if (fromEdges) {
      fromEdges.delete(to);
    }

    const toEdges = this.edges.get(to);
    if (toEdges) {
      const reverseEdge = toEdges.get(from);
      if (reverseEdge?.bidirectional) {
        toEdges.delete(from);
      }
    }
  }

  hasEdge(from: string, to: string): boolean {
    const fromEdges = this.edges.get(from);
    return fromEdges?.has(to) ?? false;
  }

  getEdge(from: string, to: string): TopologyEdge | undefined {
    return this.edges.get(from)?.get(to);
  }

  getAllEdges(): TopologyEdge[] {
    const result: TopologyEdge[] = [];
    const seen = new Set<string>();

    for (const [from, toEdges] of this.edges) {
      for (const [to, edge] of toEdges) {
        const key = `${from}->${to}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(edge);
        }
      }
    }

    return result;
  }

  getNeighbors(instanceId: string): TopologyNode[] {
    const neighbors: TopologyNode[] = [];

    const outgoing = this.edges.get(instanceId);
    if (outgoing) {
      for (const to of outgoing.keys()) {
        const node = this.nodes.get(to);
        if (node) {
          neighbors.push(node);
        }
      }
    }

    for (const [from, toEdges] of this.edges) {
      if (from !== instanceId && toEdges.has(instanceId)) {
        const node = this.nodes.get(from);
        if (node) {
          neighbors.push(node);
        }
      }
    }

    return neighbors;
  }

  getChildren(instanceId: string): TopologyNode[] {
    const children: TopologyNode[] = [];
    const outgoing = this.edges.get(instanceId);

    if (outgoing) {
      for (const [to, edge] of outgoing) {
        if (edge.edgeType === 'parent-child') {
          const node = this.nodes.get(to);
          if (node) {
            children.push(node);
          }
        }
      }
    }

    return children;
  }

  getParent(instanceId: string): TopologyNode | undefined {
    const parents = this.getParents(instanceId);
    return parents[0];
  }

  getParents(instanceId: string): TopologyNode[] {
    const parents: TopologyNode[] = [];

    for (const [from, toEdges] of this.edges) {
      if (toEdges.has(instanceId)) {
        const edge = toEdges.get(instanceId)!;
        if (edge.edgeType === 'parent-child') {
          const node = this.nodes.get(from);
          if (node) {
            parents.push(node);
          }
        }
      }
    }

    return parents;
  }

  findPath(from: string, to: string): string[] | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      return null;
    }

    if (from === to) {
      return [from];
    }

    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [
      { node: from, path: [from] },
    ];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (visited.has(node)) {
        continue;
      }
      visited.add(node);

      const outgoing = this.edges.get(node);
      if (outgoing) {
        for (const [nextNode] of outgoing) {
          if (nextNode === to) {
            return [...path, to];
          }

          if (!visited.has(nextNode)) {
            queue.push({ node: nextNode, path: [...path, nextNode] });
          }
        }
      }
    }

    return null;
  }

  isReachable(from: string, to: string): boolean {
    return this.findPath(from, to) !== null;
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }

  get size(): { nodes: number; edges: number } {
    let edgeCount = 0;
    for (const toEdges of this.edges.values()) {
      edgeCount += toEdges.size;
    }
    return {
      nodes: this.nodes.size,
      edges: edgeCount,
    };
  }
}

export function createTopologyGraph(): ITopologyGraph {
  return new TopologyGraph();
}
