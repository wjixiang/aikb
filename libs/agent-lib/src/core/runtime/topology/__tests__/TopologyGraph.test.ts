/**
 * TopologyGraph - Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TopologyGraph,
  createTopologyGraph,
  type ITopologyGraph,
} from '../graph/TopologyGraph.js';
import type { TopologyNode } from '../types.js';

describe('TopologyGraph', () => {
  let graph: ITopologyGraph;

  beforeEach(() => {
    graph = createTopologyGraph();
  });

  describe('addNode / getNode / hasNode', () => {
    it('should add and retrieve a node', () => {
      const node: TopologyNode = {
        instanceId: 'agent-1',
        nodeType: 'worker',
        capabilities: ['search'],
      };

      graph.addNode(node);

      expect(graph.hasNode('agent-1')).toBe(true);
      expect(graph.getNode('agent-1')).toEqual(node);
    });

    it('should throw when adding duplicate node', () => {
      const node: TopologyNode = {
        instanceId: 'agent-1',
        nodeType: 'worker',
      };

      graph.addNode(node);

      expect(() => graph.addNode(node)).toThrow('already exists');
    });

    it('should return all nodes', () => {
      graph.addNode({ instanceId: 'agent-1', nodeType: 'worker' });
      graph.addNode({ instanceId: 'agent-2', nodeType: 'router' });

      const nodes = graph.getAllNodes();

      expect(nodes).toHaveLength(2);
    });
  });

  describe('removeNode', () => {
    it('should remove a node', () => {
      graph.addNode({ instanceId: 'agent-1', nodeType: 'worker' });
      graph.removeNode('agent-1');

      expect(graph.hasNode('agent-1')).toBe(false);
    });

    it('should remove edges when node is removed', () => {
      graph.addNode({ instanceId: 'agent-1', nodeType: 'router' });
      graph.addNode({ instanceId: 'agent-2', nodeType: 'worker' });
      graph.addEdge({
        from: 'agent-1',
        to: 'agent-2',
        edgeType: 'parent-child',
      });

      graph.removeNode('agent-2');

      expect(graph.hasEdge('agent-1', 'agent-2')).toBe(false);
    });
  });

  describe('addEdge / hasEdge / getEdge', () => {
    beforeEach(() => {
      graph.addNode({ instanceId: 'agent-1', nodeType: 'router' });
      graph.addNode({ instanceId: 'agent-2', nodeType: 'worker' });
    });

    it('should add and retrieve an edge', () => {
      graph.addEdge({
        from: 'agent-1',
        to: 'agent-2',
        edgeType: 'parent-child',
      });

      expect(graph.hasEdge('agent-1', 'agent-2')).toBe(true);
      expect(graph.getEdge('agent-1', 'agent-2')?.edgeType).toBe(
        'parent-child',
      );
    });

    it('should throw when adding edge with non-existent node', () => {
      expect(() =>
        graph.addEdge({
          from: 'agent-1',
          to: 'non-existent',
          edgeType: 'peer',
        }),
      ).toThrow('does not exist');
    });

    it('should add bidirectional edge when specified', () => {
      graph.addEdge({
        from: 'agent-1',
        to: 'agent-2',
        edgeType: 'peer',
        bidirectional: true,
      });

      expect(graph.hasEdge('agent-1', 'agent-2')).toBe(true);
      expect(graph.hasEdge('agent-2', 'agent-1')).toBe(true);
    });
  });

  describe('getNeighbors', () => {
    it('should return all neighbors', () => {
      graph.addNode({ instanceId: 'agent-1', nodeType: 'router' });
      graph.addNode({ instanceId: 'agent-2', nodeType: 'worker' });
      graph.addNode({ instanceId: 'agent-3', nodeType: 'worker' });
      graph.addEdge({
        from: 'agent-1',
        to: 'agent-2',
        edgeType: 'parent-child',
      });
      graph.addEdge({ from: 'agent-3', to: 'agent-1', edgeType: 'peer' });

      const neighbors = graph.getNeighbors('agent-1');

      expect(neighbors.length).toBe(2);
    });
  });

  describe('getChildren / getParent', () => {
    beforeEach(() => {
      graph.addNode({ instanceId: 'router', nodeType: 'router' });
      graph.addNode({ instanceId: 'worker-1', nodeType: 'worker' });
      graph.addNode({ instanceId: 'worker-2', nodeType: 'worker' });
      graph.addEdge({
        from: 'router',
        to: 'worker-1',
        edgeType: 'parent-child',
      });
      graph.addEdge({
        from: 'router',
        to: 'worker-2',
        edgeType: 'parent-child',
      });
    });

    it('should return children nodes', () => {
      const children = graph.getChildren('router');

      expect(children).toHaveLength(2);
      expect(children.map((c) => c.instanceId)).toContain('worker-1');
      expect(children.map((c) => c.instanceId)).toContain('worker-2');
    });

    it('should return parent node', () => {
      const parent = graph.getParent('worker-1');

      expect(parent?.instanceId).toBe('router');
    });

    it('should return undefined for root node parent', () => {
      const parent = graph.getParent('router');

      expect(parent).toBeUndefined();
    });
  });

  describe('findPath / isReachable', () => {
    beforeEach(() => {
      graph.addNode({ instanceId: 'A', nodeType: 'router' });
      graph.addNode({ instanceId: 'B', nodeType: 'worker' });
      graph.addNode({ instanceId: 'C', nodeType: 'worker' });
      graph.addNode({ instanceId: 'D', nodeType: 'worker' });
      graph.addEdge({ from: 'A', to: 'B', edgeType: 'parent-child' });
      graph.addEdge({ from: 'B', to: 'C', edgeType: 'parent-child' });
      graph.addEdge({ from: 'A', to: 'D', edgeType: 'parent-child' });
    });

    it('should find direct path', () => {
      const path = graph.findPath('A', 'B');

      expect(path).toEqual(['A', 'B']);
    });

    it('should find indirect path', () => {
      const path = graph.findPath('A', 'C');

      expect(path).toEqual(['A', 'B', 'C']);
    });

    it('should return null for unreachable nodes', () => {
      graph.addNode({ instanceId: 'isolated', nodeType: 'worker' });

      const path = graph.findPath('A', 'isolated');

      expect(path).toBeNull();
    });

    it('should check reachability', () => {
      expect(graph.isReachable('A', 'C')).toBe(true);
      expect(graph.isReachable('C', 'A')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      graph.addNode({ instanceId: 'agent-1', nodeType: 'worker' });
      graph.addNode({ instanceId: 'agent-2', nodeType: 'worker' });
      graph.addEdge({
        from: 'agent-1',
        to: 'agent-2',
        edgeType: 'peer',
        bidirectional: true,
      });

      const size = graph.size;

      expect(size.nodes).toBe(2);
      expect(size.edges).toBe(2);
    });
  });
});
