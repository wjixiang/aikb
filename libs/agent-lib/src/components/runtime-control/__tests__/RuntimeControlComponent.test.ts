import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeControlComponent } from '../RuntimeControlComponent.js';
import type {
  IRuntimeControlClient,
  AgentMetadata,
} from '../../../core/runtime/types.js';

describe('RuntimeControlComponent', () => {
  let component: RuntimeControlComponent;
  let mockRuntimeClient: IRuntimeControlClient;

  const createMockClient = (): IRuntimeControlClient => {
    const mockGraph = {
      addNode: vi.fn(),
      removeNode: vi.fn(),
      getNode: vi.fn(),
      hasNode: vi.fn(() => true),
      getAllNodes: vi.fn(() => [
        {
          instanceId: 'parent-agent-id',
          nodeType: 'router' as const,
          capabilities: [],
        },
      ]),
      addEdge: vi.fn(),
      removeEdge: vi.fn(),
      hasEdge: vi.fn(() => false),
      getEdge: vi.fn(),
      getAllEdges: vi.fn(() => []),
      getNeighbors: vi.fn(() => []),
      getChildren: vi.fn(() => []),
      getParent: vi.fn(),
      getParents: vi.fn(() => []),
      findPath: vi.fn(() => null),
      isReachable: vi.fn(() => false),
      clear: vi.fn(),
      size: { nodes: 1, edges: 0 },
    };

    return {
      createAgent: vi.fn(() => Promise.resolve('child-agent-id-' + Date.now())),
      destroyAgent: vi.fn(() => Promise.resolve()),
      startAgent: vi.fn(() => Promise.resolve()),
      stopAgent: vi.fn(() => Promise.resolve()),
      getAgent: vi.fn((id) =>
        Promise.resolve({ instanceId: id } as AgentMetadata),
      ),
      listAgents: vi.fn(() => Promise.resolve([])),
      getStats: vi.fn(() =>
        Promise.resolve({
          totalAgents: 1,
          agentsByStatus: { idle: 1, running: 0, completed: 0, aborted: 0 },
          totalPendingTasks: 0,
          totalProcessingTasks: 0,
        }),
      ),
      getSelfInstanceId: vi.fn(() => 'parent-agent-id'),
      getParentInstanceId: vi.fn(() => undefined),
      listChildAgents: vi.fn(() => Promise.resolve([])),
      registerInTopology: vi.fn(),
      unregisterFromTopology: vi.fn(),
      connectAgents: vi.fn(),
      disconnectAgents: vi.fn(),
      getTopologyGraph: vi.fn(() => mockGraph),
      getTopologyStats: vi.fn(() => ({
        totalMessages: 0,
        totalConversations: 0,
        activeConversations: 0,
        completedConversations: 0,
        failedConversations: 0,
        timedOutConversations: 0,
      })),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeClient = createMockClient();
    component = new RuntimeControlComponent({
      instanceId: 'test-agent-id',
      getRuntimeClient: () => mockRuntimeClient,
    });
  });

  describe('constructor', () => {
    it('should create component with correct id', () => {
      expect(component.componentId).toBe('runtime-control');
    });

    it('should have correct display name', () => {
      expect(component.displayName).toBe('Runtime Control');
    });

    it('should have correct description', () => {
      expect(component.description).toBe('Create and manage child agents');
    });

    it('should have all required tools', () => {
      expect(component.toolSet.size).toBe(17);
      expect(component.toolSet.has('createAgent')).toBe(true);
      expect(component.toolSet.has('destroyAgent')).toBe(true);
      expect(component.toolSet.has('startAgent')).toBe(true);
      expect(component.toolSet.has('stopAgent')).toBe(true);
      expect(component.toolSet.has('listAgents')).toBe(true);
      expect(component.toolSet.has('getAgent')).toBe(true);
      expect(component.toolSet.has('getStats')).toBe(true);
      expect(component.toolSet.has('listChildAgents')).toBe(true);
      expect(component.toolSet.has('getMyInfo')).toBe(true);
      // Agent Soul tools
      expect(component.toolSet.has('listAgentSouls')).toBe(true);
      expect(component.toolSet.has('createAgentByType')).toBe(true);
      // Topology tools
      expect(component.toolSet.has('registerInTopology')).toBe(true);
      expect(component.toolSet.has('unregisterFromTopology')).toBe(true);
      expect(component.toolSet.has('connectAgents')).toBe(true);
      expect(component.toolSet.has('disconnectAgents')).toBe(true);
      expect(component.toolSet.has('getTopologyInfo')).toBe(true);
      expect(component.toolSet.has('getNeighbors')).toBe(true);
    });
  });

  describe('createAgent tool', () => {
    it('should create agent successfully', async () => {
      const result = await component.handleToolCall('createAgent', {
        name: 'test-worker',
        agentType: 'worker',
        description: 'A test worker',
        sop: 'You are a worker',
      });

      expect(result.success).toBe(true);
      expect(result.data.instanceId).toMatch(/^child-agent-id-/);
      expect(result.data.name).toBe('test-worker');
      expect(mockRuntimeClient.createAgent).toHaveBeenCalledWith({
        agent: {
          name: 'test-worker',
          type: 'worker',
          description: 'A test worker',
          sop: 'You are a worker',
        },
      });
    });
  });

  describe('destroyAgent tool', () => {
    it('should destroy agent successfully', async () => {
      const result = await component.handleToolCall('destroyAgent', {
        instanceId: 'child-agent-id',
        cascade: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockRuntimeClient.destroyAgent).toHaveBeenCalledWith(
        'child-agent-id',
        { cascade: true },
      );
    });
  });

  describe('startAgent tool', () => {
    it('should start agent successfully', async () => {
      const result = await component.handleToolCall('startAgent', {
        instanceId: 'child-agent-id',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockRuntimeClient.startAgent).toHaveBeenCalledWith(
        'child-agent-id',
      );
    });
  });

  describe('stopAgent tool', () => {
    it('should stop agent successfully', async () => {
      const result = await component.handleToolCall('stopAgent', {
        instanceId: 'child-agent-id',
      });

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(mockRuntimeClient.stopAgent).toHaveBeenCalledWith(
        'child-agent-id',
      );
    });
  });

  describe('listAgents tool', () => {
    it('should list agents successfully', async () => {
      const mockAgents: AgentMetadata[] = [
        {
          instanceId: 'agent-1',
          status: 'idle',
          name: 'Agent 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          instanceId: 'agent-2',
          status: 'running',
          name: 'Agent 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockRuntimeClient.listAgents = vi.fn(() => Promise.resolve(mockAgents));

      const result = await component.handleToolCall('listAgents', {});

      expect(result.success).toBe(true);
      expect(result.data.agents).toEqual(mockAgents);
    });

    it('should pass filters to listAgents', async () => {
      await component.handleToolCall('listAgents', {
        status: 'idle',
        agentType: 'worker',
        name: 'test',
      });

      expect(mockRuntimeClient.listAgents).toHaveBeenCalledWith({
        status: 'idle',
        agentType: 'worker',
        name: 'test',
      });
    });
  });

  describe('getAgent tool', () => {
    it('should return agent when found', async () => {
      const mockAgent: AgentMetadata = {
        instanceId: 'child-agent-id',
        status: 'idle',
        name: 'Child Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRuntimeClient.listAgents = vi.fn(() => Promise.resolve([mockAgent]));

      const result = await component.handleToolCall('getAgent', {
        instanceId: 'child-agent-id',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAgent);
    });

    it('should return null when agent not found', async () => {
      mockRuntimeClient.getAgent = vi.fn(() => Promise.resolve(null));
      mockRuntimeClient.listAgents = vi.fn(() => Promise.resolve([]));

      const result = await component.handleToolCall('getAgent', {
        instanceId: 'non-existent',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getStats tool', () => {
    it('should get stats successfully', async () => {
      const result = await component.handleToolCall('getStats', {});

      expect(result.success).toBe(true);
      expect(result.data.totalAgents).toBe(1);
    });
  });

  describe('listChildAgents tool', () => {
    it('should list child agents successfully', async () => {
      const mockChildren: AgentMetadata[] = [
        {
          instanceId: 'child-1',
          status: 'idle',
          name: 'Child 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          parentInstanceId: 'parent-agent-id',
        },
      ];
      mockRuntimeClient.listChildAgents = vi.fn(() =>
        Promise.resolve(mockChildren),
      );

      const result = await component.handleToolCall('listChildAgents', {});

      expect(result.success).toBe(true);
      expect(result.data.agents).toEqual(mockChildren);
    });
  });

  describe('getMyInfo tool', () => {
    it('should return own info successfully', async () => {
      const result = await component.handleToolCall('getMyInfo', {});

      expect(result.success).toBe(true);
      expect(result.data.instanceId).toBe('parent-agent-id');
    });
  });

  describe('error handling', () => {
    it('should handle unknown tool gracefully', async () => {
      const result = await component.handleToolCall('unknownTool' as any, {});

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
    });

    it('should handle runtime client errors', async () => {
      mockRuntimeClient.createAgent = vi.fn(() =>
        Promise.reject(new Error('Creation failed')),
      );

      const result = await component.handleToolCall('createAgent', {
        name: 'test',
        agentType: 'worker',
      });

      expect(result.success).toBe(false);
      expect(result.summary).toContain('Creation failed');
    });

    it('should handle when runtime client is not available', () => {
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => undefined,
      });

      const result = component.handleToolCall('createAgent', {
        name: 'test',
        agentType: 'worker',
      });

      return expect(result).resolves.toMatchObject({
        success: false,
        data: expect.objectContaining({
          error: 'Runtime control not available',
        }),
      });
    });
  });

  describe('renderImply', () => {
    it('should render with runtime client available', async () => {
      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
    });

    it('should render with runtime client not available', async () => {
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => undefined,
      });

      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('exportData', () => {
    it('should export data successfully', async () => {
      const result = await component.exportData();

      expect(result.format).toBe('json');
      expect(result.data).toHaveProperty('myInstanceId');
    });

    it('should handle export when client not available', async () => {
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => undefined,
      });

      const result = await component.exportData();

      expect(result.data).toHaveProperty('error');
    });
  });
});
