import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeControlComponent } from '../index.js';

describe('RuntimeControlComponent', () => {
  let component: RuntimeControlComponent;
  let mockRestClient: {
    getStats: ReturnType<typeof vi.fn>;
    listAgents: ReturnType<typeof vi.fn>;
    getAgent: ReturnType<typeof vi.fn>;
    createAgent: ReturnType<typeof vi.fn>;
    destroyAgent: ReturnType<typeof vi.fn>;
    stopAgent: ReturnType<typeof vi.fn>;
    startAgent: ReturnType<typeof vi.fn>;
    getTopology: ReturnType<typeof vi.fn>;
    getTopologyStats: ReturnType<typeof vi.fn>;
    listAgentSouls: ReturnType<typeof vi.fn>;
    createAgentBySoul: ReturnType<typeof vi.fn>;
    registerInTopology: ReturnType<typeof vi.fn>;
    unregisterFromTopology: ReturnType<typeof vi.fn>;
    connectAgents: ReturnType<typeof vi.fn>;
    disconnectAgents: ReturnType<typeof vi.fn>;
    getNeighbors: ReturnType<typeof vi.fn>;
  };

  const createMockRestClient = () => ({
    getStats: vi.fn(() =>
      Promise.resolve({
        totalAgents: 1,
        runningAgents: 1,
      }),
    ),
    listAgents: vi.fn(() => Promise.resolve({ data: [] })),
    getAgent: vi.fn(() =>
      Promise.resolve({
        instanceId: 'child-agent-id',
        status: 'idle',
      }),
    ),
    createAgent: vi.fn(() =>
      Promise.resolve({ instanceId: 'child-agent-id-' + Date.now() }),
    ),
    destroyAgent: vi.fn(() => Promise.resolve()),
    stopAgent: vi.fn(() => Promise.resolve()),
    startAgent: vi.fn(() => Promise.resolve()),
    getTopology: vi.fn(() =>
      Promise.resolve({
        nodes: [
          {
            instanceId: 'parent-agent-id',
            nodeType: 'router',
            capabilities: [],
          },
        ],
        edges: [],
        size: 1,
      }),
    ),
    getTopologyStats: vi.fn(() =>
      Promise.resolve({
        totalMessages: 0,
        activeConversations: 0,
      }),
    ),
    listAgentSouls: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            token: 'epidemiology',
            name: 'Epidemiology',
            type: 'epidemiology',
            description: 'Epi agent',
          },
        ],
      }),
    ),
    createAgentBySoul: vi.fn(() =>
      Promise.resolve({ instanceId: 'soul-agent-id' }),
    ),
    registerInTopology: vi.fn(() => Promise.resolve()),
    unregisterFromTopology: vi.fn(() => Promise.resolve()),
    connectAgents: vi.fn(() => Promise.resolve()),
    disconnectAgents: vi.fn(() => Promise.resolve()),
    getNeighbors: vi.fn(() => Promise.resolve({ data: [] })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRestClient = createMockRestClient();
    component = new RuntimeControlComponent('test-agent-id', {
      restBaseUrl: 'http://localhost:9400',
    }) as RuntimeControlComponent;
    (component as any).restClient = mockRestClient;
  });

  describe('constructor', () => {
    it('should create component with correct id', () => {
      expect(component.componentId).toBe('runtime-control');
    });

    it('should have correct display name', () => {
      expect(component.displayName).toBe('Runtime Control');
    });

    it('should have all required tools', () => {
      expect(component.toolSet.size).toBe(16);
      const expected = [
        'createAgent',
        'destroyAgent',
        'stopAgent',
        'listAgents',
        'getAgent',
        'getStats',
        'listChildAgents',
        'getMyInfo',
        'listAgentSouls',
        'createAgentByType',
        'registerInTopology',
        'unregisterFromTopology',
        'connectAgents',
        'disconnectAgents',
        'getTopologyInfo',
        'getNeighbors',
      ];
      for (const tool of expected) {
        expect(component.toolSet.has(tool)).toBe(true);
      }
    });
  });

  describe('createAgent tool', () => {
    it('should create agent via REST', async () => {
      const result = await component.handleToolCall('createAgent', {
        name: 'test-worker',
        agentType: 'worker',
        description: 'A test worker',
        sop: 'You are a worker',
      });

      expect(result.success).toBe(true);
      expect(result.data.instanceId).toMatch(/^child-agent-id-/);
      expect(result.data.name).toBe('test-worker');
      expect(mockRestClient.createAgent).toHaveBeenCalledWith({
        name: 'test-worker',
        type: 'worker',
        description: 'A test worker',
        sop: 'You are a worker',
      });
    });
  });

  describe('destroyAgent tool', () => {
    it('should destroy agent via REST', async () => {
      const result = await component.handleToolCall('destroyAgent', {
        agentId: 'child-agent-id',
        cascade: true,
      });

      expect(result.success).toBe(true);
      expect(mockRestClient.destroyAgent).toHaveBeenCalledWith(
        'child-agent-id',
        true,
      );
    });
  });

  describe('stopAgent tool', () => {
    it('should stop agent via REST', async () => {
      const result = await component.handleToolCall('stopAgent', {
        agentId: 'child-agent-id',
      });

      expect(result.success).toBe(true);
      expect(mockRestClient.stopAgent).toHaveBeenCalledWith('child-agent-id');
    });
  });

  describe('listAgents tool', () => {
    it('should list agents via REST', async () => {
      mockRestClient.listAgents = vi.fn(() =>
        Promise.resolve({
          data: [
            { instanceId: 'agent-1', status: 'idle' },
            { instanceId: 'agent-2', status: 'running' },
          ],
        }),
      );

      const result = await component.handleToolCall('listAgents', {});

      expect(result.success).toBe(true);
      expect(result.data.agents).toHaveLength(2);
    });

    it('should pass filters to REST', async () => {
      await component.handleToolCall('listAgents', {
        status: 'idle',
        agentType: 'worker',
      });

      expect(mockRestClient.listAgents).toHaveBeenCalledWith({
        status: 'idle',
        type: 'worker',
      });
    });
  });

  describe('getAgent tool', () => {
    it('should get agent via REST', async () => {
      const result = await component.handleToolCall('getAgent', {
        agentId: 'child-agent-id',
      });

      expect(result.success).toBe(true);
      expect(result.data?.instanceId).toBe('child-agent-id');
    });
  });

  describe('getStats tool', () => {
    it('should get stats via REST', async () => {
      const result = await component.handleToolCall('getStats', {});

      expect(result.success).toBe(true);
      expect(result.data.totalAgents).toBe(1);
    });
  });

  describe('listAgentSouls tool', () => {
    it('should list agent souls via REST', async () => {
      const result = await component.handleToolCall('listAgentSouls', {});

      expect(result.success).toBe(true);
      if (result.data) {
        expect(result.data.souls).toHaveLength(1);
        expect(result.data.souls[0].type).toBe('epidemiology');
      }
    });
  });

  describe('createAgentByType tool', () => {
    it('should create agent by soul via REST', async () => {
      const result = await component.handleToolCall('createAgentByType', {
        soulType: 'epidemiology',
        name: 'Epi Agent',
      });

      expect(result.success).toBe(true);
      expect(result.data.soulType).toBe('epidemiology');
      expect(mockRestClient.createAgentBySoul).toHaveBeenCalledWith(
        'epidemiology',
        'Epi Agent',
      );
    });
  });

  describe('topology tools', () => {
    it('should register in topology via REST', async () => {
      const result = await component.handleToolCall('registerInTopology', {
        agentId: 'agent-1',
        nodeType: 'worker',
        capabilities: ['search'],
      });

      expect(result.success).toBe(true);
      expect(mockRestClient.registerInTopology).toHaveBeenCalledWith(
        'agent-1',
        'worker',
        ['search'],
      );
    });

    it('should connect agents via REST', async () => {
      const result = await component.handleToolCall('connectAgents', {
        from: 'agent-1',
        to: 'agent-2',
        edgeType: 'peer',
      });

      expect(result.success).toBe(true);
      expect(mockRestClient.connectAgents).toHaveBeenCalledWith(
        'agent-1',
        'agent-2',
        'peer',
      );
    });

    it('should get topology info via REST', async () => {
      const result = await component.handleToolCall('getTopologyInfo', {});

      expect(result.success).toBe(true);
      expect(result.data!.nodes).toHaveLength(1);
      expect(result.data.edges).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle unknown tool gracefully', async () => {
      const result = await component.handleToolCall('unknownTool' as any, {});

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
    });

    it('should handle REST errors', async () => {
      mockRestClient.createAgent = vi.fn(() =>
        Promise.reject(new Error('Creation failed')),
      );

      const result = await component.handleToolCall('createAgent', {
        name: 'test',
        agentType: 'worker',
      });

      expect(result.success).toBe(false);
      expect(result.summary).toContain('Creation failed');
    });

    it('should handle when REST client is not configured', () => {
      const noRest = new RuntimeControlComponent('test-agent-id');

      return expect(
        noRest.handleToolCall('createAgent', {
          name: 'test',
          agentType: 'worker',
        }),
      ).resolves.toMatchObject({
        success: false,
        data: expect.objectContaining({
          error: expect.stringContaining('not configured'),
        }),
      });
    });
  });

  describe('getMyInfo tool', () => {
    it('should return instance ID without REST call', async () => {
      const result = await component.handleToolCall('getMyInfo', {});

      expect(result.success).toBe(true);
      expect(result.data.instanceId).toBe('test-agent-id');
    });
  });

  describe('renderImply', () => {
    it('should render with REST client available', async () => {
      const elements = await component.renderImply();

      expect(elements.length).toBeGreaterThan(0);
    });

    it('should render without REST client', async () => {
      const noRest = new RuntimeControlComponent('test-agent-id');
      const elements = await noRest.renderImply();

      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('exportData', () => {
    it('should export data', async () => {
      const result = await component.exportData();

      expect(result.format).toBe('json');
      expect(result.data).toHaveProperty('instanceId');
    });
  });
});
