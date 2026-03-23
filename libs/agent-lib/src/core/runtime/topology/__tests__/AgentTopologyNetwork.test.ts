/**
 * AgentTopologyNetwork - Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentTopologyNetwork,
  createAgentTopologyNetwork,
  type IAgentTopologyNetwork,
} from '../AgentTopologyNetwork.js';
import type { TopologyMessage } from '../types.js';

describe('AgentTopologyNetwork', () => {
  let network: IAgentTopologyNetwork;

  beforeEach(async () => {
    network = createAgentTopologyNetwork({
      defaultAckTimeout: 5000,
      defaultResultTimeout: 10000,
      maxRetries: 3,
    });
    await network.initialize();
  });

  afterEach(() => {
    network = undefined as unknown as IAgentTopologyNetwork;
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      const newNetwork = createAgentTopologyNetwork();
      await expect(newNetwork.initialize()).resolves.toBeUndefined();
    });
  });

  describe('registerAgent / unregisterAgent', () => {
    it('should register and unregister agents', async () => {
      network.registerAgent('agent-1', 'worker', ['search']);
      network.registerAgent('agent-2', 'router', ['routing']);

      const graph = network.getGraph();
      expect(graph.hasNode('agent-1')).toBe(true);
      expect(graph.hasNode('agent-2')).toBe(true);

      network.unregisterAgent('agent-1');
      expect(graph.hasNode('agent-1')).toBe(false);
    });
  });

  describe('connect / disconnect', () => {
    it('should create and remove connections', async () => {
      network.registerAgent('agent-1', 'router');
      network.registerAgent('agent-2', 'worker');

      network.connect('agent-1', 'agent-2', 'parent-child');

      const graph = network.getGraph();
      expect(graph.hasEdge('agent-1', 'agent-2')).toBe(true);

      network.disconnect('agent-1', 'agent-2');
      expect(graph.hasEdge('agent-1', 'agent-2')).toBe(false);
    });
  });

  describe('request (two-phase response)', () => {
    it('should return a promise for request', async () => {
      network.registerAgent('target-agent', 'worker');

      const requestPromise = network.request(
        'target-agent',
        { task: 'test' },
        'sender',
      );

      expect(requestPromise).toBeDefined();
      expect(typeof requestPromise.then).toBe('function');
    });
  });

  describe('send', () => {
    it('should send event message to registered handler', async () => {
      network.registerAgent('agent-1', 'worker');

      let receivedMessage: TopologyMessage | undefined;
      const unsubscribe = network.subscribe('agent-1', (msg) => {
        receivedMessage = msg;
      });

      await network.send('agent-1', { data: 'test' }, 'event');

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage?.content).toEqual({ data: 'test' });

      unsubscribe();
    });
  });

  describe('broadcast', () => {
    it('should broadcast to children', async () => {
      network.registerAgent('router', 'router');
      network.registerAgent('worker-1', 'worker');
      network.registerAgent('worker-2', 'worker');

      network.connect('router', 'worker-1', 'parent-child');
      network.connect('router', 'worker-2', 'parent-child');

      const messages = await network.broadcast('router', { task: 'broadcast' });

      expect(messages).toHaveLength(2);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('should receive messages when subscribed', async () => {
      network.registerAgent('agent-1', 'worker');

      let receivedMessage: TopologyMessage | undefined;
      const unsubscribe = network.subscribe('agent-1', (msg) => {
        receivedMessage = msg;
      });

      await network.send('agent-1', { data: 'test' }, 'event');

      expect(receivedMessage?.content).toEqual({ data: 'test' });

      unsubscribe();
    });

    it('should stop receiving after unsubscribe', async () => {
      network.registerAgent('agent-1', 'worker');

      let callCount = 0;
      const unsubscribe = network.subscribe('agent-1', () => {
        callCount++;
      });

      await network.send('agent-1', { data: 'test1' }, 'event');
      unsubscribe();
      await network.send('agent-1', { data: 'test2' }, 'event');

      expect(callCount).toBe(1);
    });
  });

  describe('createRouter', () => {
    it('should create router and connect all agents', async () => {
      network.registerAgent('worker-1', 'worker');
      network.registerAgent('worker-2', 'worker');

      network.createRouter('my-router');

      const graph = network.getGraph();

      expect(graph.hasEdge('my-router', 'worker-1')).toBe(true);
      expect(graph.hasEdge('my-router', 'worker-2')).toBe(true);
    });
  });

  describe('buildTopology', () => {
    it('should build star topology', async () => {
      network.registerAgent('center', 'router');
      network.registerAgent('spoke-1', 'worker');
      network.registerAgent('spoke-2', 'worker');

      network.buildTopology('star');

      const graph = network.getGraph();

      expect(graph.hasEdge('center', 'spoke-1')).toBe(true);
      expect(graph.hasEdge('center', 'spoke-2')).toBe(true);
    });

    it('should build ring topology', async () => {
      network.registerAgent('node-1', 'worker');
      network.registerAgent('node-2', 'worker');
      network.registerAgent('node-3', 'worker');

      network.buildTopology('ring');

      const graph = network.getGraph();

      expect(graph.hasEdge('node-1', 'node-2')).toBe(true);
      expect(graph.hasEdge('node-2', 'node-3')).toBe(true);
      expect(graph.hasEdge('node-3', 'node-1')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return routing stats', async () => {
      const stats = network.getStats();

      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('totalConversations');
      expect(stats).toHaveProperty('activeConversations');
    });
  });

  describe('onEvent', () => {
    it('should receive events when subscribing', async () => {
      let eventReceived = false;
      const unsubscribe = network.onEvent(() => {
        eventReceived = true;
      });

      network.registerAgent('new-agent', 'worker');

      expect(eventReceived).toBe(true);

      unsubscribe();
    });
  });

  describe('getGraph / getMessageBus / getRouter', () => {
    it('should return the graph', () => {
      const graph = network.getGraph();
      expect(graph).toBeDefined();
    });

    it('should return the message bus', () => {
      const bus = network.getMessageBus();
      expect(bus).toBeDefined();
    });

    it('should return the router', () => {
      const router = network.getRouter();
      expect(router).toBeDefined();
    });
  });

  describe('attachRuntime / detachRuntime', () => {
    it('should attach and detach runtime', () => {
      const mockRuntime = { name: 'runtime' };

      network.attachRuntime(mockRuntime);
      network.detachRuntime();
    });
  });
});
