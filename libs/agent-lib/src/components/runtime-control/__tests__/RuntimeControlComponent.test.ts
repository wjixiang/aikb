import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeControlComponent } from '../RuntimeControlComponent.js';
import type {
  IRuntimeControlClient,
  RuntimeControlPermissions,
  AgentMetadata,
} from '../../../core/runtime/types.js';

describe('RuntimeControlComponent', () => {
  let component: RuntimeControlComponent;
  let mockRuntimeClient: IRuntimeControlClient;

  const fullPermissions: RuntimeControlPermissions = {
    canCreateAgent: true,
    canDestroyAgent: true,
    canManageAgentLifecycle: true,
    canSubmitTask: true,
    canListAllAgents: true,
    canGetStats: true,
    maxChildAgents: 10,
  };

  const noPermissions: RuntimeControlPermissions = {
    canCreateAgent: false,
    canDestroyAgent: false,
    canManageAgentLifecycle: false,
    canSubmitTask: false,
    canListAllAgents: false,
    canGetStats: false,
    maxChildAgents: 0,
  };

  const createMockClient = (
    permissions: RuntimeControlPermissions = fullPermissions,
  ): IRuntimeControlClient => {
    return {
      getPermissions: vi.fn(() => permissions),
      hasPermission: vi.fn((perm: keyof RuntimeControlPermissions) =>
        Boolean(permissions[perm]),
      ),
      createAgent: vi.fn((options) =>
        Promise.resolve('child-agent-id-' + Date.now()),
      ),
      destroyAgent: vi.fn(() => Promise.resolve()),
      startAgent: vi.fn(() => Promise.resolve()),
      stopAgent: vi.fn(() => Promise.resolve()),
      getAgent: vi.fn((id) =>
        Promise.resolve({ instanceId: id } as AgentMetadata),
      ),
      listAgents: vi.fn(() => Promise.resolve([])),
      submitTask: vi.fn((task) => Promise.resolve('task-' + Date.now())),
      getTaskStatus: vi.fn((id) => Promise.resolve(undefined)),
      getPendingTasks: vi.fn(() => Promise.resolve([])),
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
      expect(component.toolSet.size).toBe(10);
      expect(component.toolSet.has('createAgent')).toBe(true);
      expect(component.toolSet.has('destroyAgent')).toBe(true);
      expect(component.toolSet.has('startAgent')).toBe(true);
      expect(component.toolSet.has('stopAgent')).toBe(true);
      expect(component.toolSet.has('listAgents')).toBe(true);
      expect(component.toolSet.has('getAgent')).toBe(true);
      expect(component.toolSet.has('submitTask')).toBe(true);
      expect(component.toolSet.has('getStats')).toBe(true);
      expect(component.toolSet.has('listChildAgents')).toBe(true);
      expect(component.toolSet.has('getMyInfo')).toBe(true);
    });
  });

  describe('createAgent tool', () => {
    it('should create agent successfully with full permissions', async () => {
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
        runtimePermissions: undefined,
      });
    });

    it('should fail without canCreateAgent permission', async () => {
      mockRuntimeClient = createMockClient(noPermissions);
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => mockRuntimeClient,
      });

      const result = await component.handleToolCall('createAgent', {
        name: 'test-worker',
        agentType: 'worker',
      });

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
    });

    it('should pass maxChildAgents to permissions', async () => {
      const result = await component.handleToolCall('createAgent', {
        name: 'test-worker',
        agentType: 'worker',
        maxChildAgents: 5,
      });

      expect(result.success).toBe(true);
      expect(mockRuntimeClient.createAgent).toHaveBeenCalledWith({
        agent: {
          name: 'test-worker',
          type: 'worker',
        },
        runtimePermissions: { maxChildAgents: 5 },
      });
    });
  });

  describe('destroyAgent tool', () => {
    it('should destroy agent successfully with full permissions', async () => {
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

    it('should fail without canDestroyAgent permission', async () => {
      mockRuntimeClient = createMockClient(noPermissions);
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => mockRuntimeClient,
      });

      const result = await component.handleToolCall('destroyAgent', {
        instanceId: 'child-agent-id',
      });

      expect(result.success).toBe(false);
      expect(result.data).toHaveProperty('error');
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

    it('should fail without canManageAgentLifecycle permission', async () => {
      mockRuntimeClient = createMockClient(noPermissions);
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => mockRuntimeClient,
      });

      const result = await component.handleToolCall('startAgent', {
        instanceId: 'child-agent-id',
      });

      expect(result.success).toBe(false);
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

    it('should fail without canManageAgentLifecycle permission', async () => {
      mockRuntimeClient = createMockClient(noPermissions);
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => mockRuntimeClient,
      });

      const result = await component.handleToolCall('stopAgent', {
        instanceId: 'child-agent-id',
      });

      expect(result.success).toBe(false);
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

  describe('submitTask tool', () => {
    it('should submit task successfully', async () => {
      const result = await component.handleToolCall('submitTask', {
        targetInstanceId: 'child-agent-id',
        description: 'Process this task',
        input: { data: 'test' },
        priority: 'high',
      });

      expect(result.success).toBe(true);
      expect(result.data.taskId).toMatch(/^task-/);
      expect(mockRuntimeClient.submitTask).toHaveBeenCalledWith({
        targetInstanceId: 'child-agent-id',
        description: 'Process this task',
        input: { data: 'test' },
        priority: 'high',
      });
    });

    it('should fail without canSubmitTask permission', async () => {
      mockRuntimeClient = createMockClient(noPermissions);
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => mockRuntimeClient,
      });

      const result = await component.handleToolCall('submitTask', {
        targetInstanceId: 'child-agent-id',
        description: 'Test task',
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

    it('should fail without canGetStats permission', async () => {
      mockRuntimeClient = createMockClient(noPermissions);
      component = new RuntimeControlComponent({
        instanceId: 'test-agent-id',
        getRuntimeClient: () => mockRuntimeClient,
      });

      const result = await component.handleToolCall('getStats', {});

      expect(result.success).toBe(false);
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
      expect(result.data.permissions).toEqual(fullPermissions);
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
      expect(result.data).toHaveProperty('permissions');
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
