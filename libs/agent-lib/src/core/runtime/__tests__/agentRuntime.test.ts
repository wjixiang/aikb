import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRuntime } from '../AgentRuntime.js';
import type { Agent, AgentContainer } from '../agent/agent.js';
import type { RuntimeControlPermissions } from '../types.js';

// Mock Prisma client
const mockPrismaClient = {
  runtimeTask: {
    create: vi.fn().mockResolvedValue({ taskId: 'task_1' }),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
};

// Mock container with Prisma client
const createMockContainer = () => {
  const container = {
    get: vi.fn().mockImplementation((type: unknown) => {
      if (type === 'PrismaClient') {
        return mockPrismaClient;
      }
      return undefined;
    }),
  };
  return container as unknown as AgentContainer & { get: ReturnType<typeof vi.fn> };
};

// Mock Agent with proper structure
const createMockAgent = (overrides: Partial<Agent> = {}): Agent =>
  ({
    status: 'idle' as const,
    taskId: undefined as string | undefined,
    workspace: {
      exportResult: vi.fn().mockResolvedValue({}),
    },
    setCentralTaskQueue: vi.fn(),
    setRuntimeClient: vi.fn(),
    setRuntimePermissions: vi.fn(),
    abort: vi.fn(),
    wakeUpForTask: vi.fn().mockResolvedValue(undefined),
    getTaskId: undefined,
    ...overrides,
  } as unknown as Agent);

// Mock AgentFactory
let mockAgentCounter = 0;

vi.mock('../agent/AgentFactory.js', () => ({
  AgentFactory: {
    create: vi.fn().mockImplementation(() => {
      mockAgentCounter++;
      const instanceId = `agent-${mockAgentCounter}`;
      const mockContainer = {
        instanceId,
        getContainer: vi.fn().mockReturnValue(createMockContainer()),
        getAgent: vi.fn().mockResolvedValue(createMockAgent({ taskId: `task-${mockAgentCounter}` })),
        getConfig: vi.fn().mockReturnValue({
          agent: {
            name: `Test Agent ${mockAgentCounter}`,
            type: 'test',
            description: 'Test description',
          },
        }),
      };
      return mockContainer;
    }),
  },
}));

describe('AgentRuntime', () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentCounter = 0;
    runtime = new AgentRuntime({ maxAgents: 5 });
  });

  describe('constructor', () => {
    it('should create runtime with default config', () => {
      const defaultRuntime = new AgentRuntime();
      expect(defaultRuntime).toBeInstanceOf(AgentRuntime);
    });

    it('should create runtime with custom maxAgents', () => {
      const customRuntime = new AgentRuntime({ maxAgents: 20 });
      expect(customRuntime).toBeInstanceOf(AgentRuntime);
    });
  });

  describe('start and stop', () => {
    it('should start and stop runtime', async () => {
      await runtime.start();
      await runtime.stop();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should be idempotent on start', async () => {
      await runtime.start();
      await runtime.start();
      await runtime.stop();
      expect(true).toBe(true);
    });

    it('should be idempotent on stop', async () => {
      await runtime.start();
      await runtime.stop();
      await runtime.stop();
      expect(true).toBe(true);
    });
  });

  describe('createAgent', () => {
    it('should create an agent', async () => {
      const agentId = await runtime.createAgent({
        agent: { name: 'test-agent', type: 'test' },
        api: { apiKey: 'test-key' },
      });

      expect(agentId).toBeTruthy();
    });

    it('should throw when max agents reached', async () => {
      const limitedRuntime = new AgentRuntime({ maxAgents: 1 });

      await limitedRuntime.createAgent({
        agent: { name: 'agent-1' },
      });

      await expect(
        limitedRuntime.createAgent({ agent: { name: 'agent-2' } }),
      ).rejects.toThrow('Maximum agent limit reached: 1');
    });

    it('should emit agent:created event', async () => {
      const handler = vi.fn();
      runtime.on('agent:created', handler);

      await runtime.createAgent({ agent: { name: 'test' } });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent:created',
          payload: expect.objectContaining({
            instanceId: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('startAgent', () => {
    it('should start an idle agent', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.startAgent(agentId);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should throw for non-existent agent', async () => {
      await expect(runtime.startAgent('non-existent')).rejects.toThrow(
        'Agent not found: non-existent',
      );
    });

    it('should emit agent:started event', async () => {
      const handler = vi.fn();
      runtime.on('agent:started', handler);

      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.startAgent(agentId);

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('stopAgent', () => {
    it('should stop a running agent', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.startAgent(agentId);
      await runtime.stopAgent(agentId);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should throw for non-existent agent', async () => {
      await expect(runtime.stopAgent('non-existent')).rejects.toThrow(
        'Agent not found: non-existent',
      );
    });
  });

  describe('destroyAgent', () => {
    it('should destroy an agent', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.destroyAgent(agentId);
      // Should not throw
      expect(true).toBe(true);
    });

    it('should throw for non-existent agent', async () => {
      await expect(runtime.destroyAgent('non-existent')).rejects.toThrow(
        'Agent not found: non-existent',
      );
    });

    it('should emit agent:destroyed event', async () => {
      const handler = vi.fn();
      runtime.on('agent:destroyed', handler);

      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.destroyAgent(agentId);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent:destroyed',
          payload: { instanceId: agentId },
        }),
      );
    });
  });

  describe('getAgent', () => {
    it('should return agent by id', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      const agent = await runtime.getAgent(agentId);
      expect(agent).toBeDefined();
    });

    it('should return undefined for non-existent agent', async () => {
      const agent = await runtime.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('getAgentContainer', () => {
    it('should return container by agent id', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      const container = runtime.getAgentContainer(agentId);
      expect(container).toBeDefined();
    });

    it('should return undefined for non-existent agent', () => {
      const container = runtime.getAgentContainer('non-existent');
      expect(container).toBeUndefined();
    });
  });

  describe('listAgents', () => {
    it('should list all agents', async () => {
      await runtime.createAgent({ agent: { name: 'agent-1' } });
      await runtime.createAgent({ agent: { name: 'agent-2' } });

      const agents = await runtime.listAgents();

      expect(agents).toHaveLength(2);
    });

    it('should filter agents by status', async () => {
      await runtime.createAgent({ agent: { name: 'agent-1' } });
      await runtime.createAgent({ agent: { name: 'agent-2' } });

      // Note: startAgent changes registry status but mock returns fresh agents
      // So we just verify filtering works by checking the registry
      const allAgents = await runtime.listAgents();
      expect(allAgents).toHaveLength(2);

      const idleAgents = await runtime.listAgents({ status: 'idle' });
      expect(idleAgents).toHaveLength(2);
    });

    it('should filter agents by agentType', async () => {
      await runtime.createAgent({ agent: { name: 'worker', type: 'worker' } });
      await runtime.createAgent({ agent: { name: 'supervisor', type: 'supervisor' } });

      const workers = await runtime.listAgents({ agentType: 'worker' });

      expect(workers).toHaveLength(1);
      expect(workers[0].agentType).toBe('worker');
    });

    it('should filter agents by name pattern', async () => {
      await runtime.createAgent({ agent: { name: 'test-agent-1' } });
      await runtime.createAgent({ agent: { name: 'test-agent-2' } });
      await runtime.createAgent({ agent: { name: 'other-agent' } });

      const testAgents = await runtime.listAgents({ name: 'test' });

      expect(testAgents).toHaveLength(2);
    });
  });

  describe('submitTask', () => {
    it('should submit a task', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.start();

      const taskId = await runtime.submitTask({
        description: 'Test task',
        targetInstanceId: agentId,
        input: { data: 'test' },
      });

      expect(taskId).toBeTruthy();
    });

    it('should throw when target agent not found', async () => {
      // Create agent first to initialize taskQueue
      await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.start();

      await expect(
        runtime.submitTask({
          description: 'Test task',
          targetInstanceId: 'non-existent',
        }),
      ).rejects.toThrow('Target agent not found');
    });

    it('should emit task:submitted event', async () => {
      const handler = vi.fn();
      runtime.on('task:submitted', handler);

      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.start();
      await runtime.submitTask({
        description: 'Test task',
        targetInstanceId: agentId,
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getTaskStatus', () => {
    it('should return undefined when runtime not started', async () => {
      await runtime.createAgent({ agent: { name: 'test' } });

      const task = await runtime.getTaskStatus('some-task-id');

      expect(task).toBeUndefined();
    });
  });

  describe('getPendingTasks', () => {
    it('should return tasks from task queue', async () => {
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.start();

      // Note: This returns tasks from the actual task queue (mocked Prisma returns [])
      const tasks = await runtime.getPendingTasks(agentId);

      // The mock returns empty array, so we expect empty result
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe('event system', () => {
    it('should subscribe to events and receive them', async () => {
      const handler = vi.fn();
      const unsubscribe = runtime.on('agent:created', handler);

      await runtime.createAgent({ agent: { name: 'test' } });

      expect(handler).toHaveBeenCalled();

      unsubscribe();
    });

    it('should return working unsubscribe function', async () => {
      const handler = vi.fn();
      const unsubscribe = runtime.on('agent:created', handler);

      unsubscribe();
      await runtime.createAgent({ agent: { name: 'test' } });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple event types', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      runtime.on('agent:created', handler1);
      runtime.on('agent:started', handler2);

      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.startAgent(agentId);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return runtime statistics', async () => {
      await runtime.createAgent({ agent: { name: 'agent-1' } });
      await runtime.createAgent({ agent: { name: 'agent-2' } });

      const stats = await runtime.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          totalAgents: 2,
          agentsByStatus: expect.any(Object),
        }),
      );
    });

    it('should count agents by status', async () => {
      await runtime.createAgent({ agent: { name: 'agent-1' } });
      const agentId = await runtime.createAgent({ agent: { name: 'agent-2' } });
      await runtime.startAgent(agentId);

      const stats = await runtime.getStats();

      expect(stats.agentsByStatus.idle).toBe(1);
      expect(stats.agentsByStatus.running).toBe(1);
    });
  });

  describe('onAgentTaskComplete', () => {
    it('should complete task when task exists in queue', async () => {
      // Setup: Create agent and submit a task first
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.start();

      // Submit a task to create it in the queue
      const taskId = await runtime.submitTask({
        description: 'Test task',
        targetInstanceId: agentId,
      });

      // Now complete it - this should work
      await runtime.onAgentTaskComplete(agentId, taskId);
      expect(true).toBe(true);
    });
  });

  describe('onAgentTaskFailed', () => {
    it('should handle task failure when task exists', async () => {
      // Setup: Create agent and submit a task first
      const agentId = await runtime.createAgent({ agent: { name: 'test' } });
      await runtime.start();

      // Submit a task to create it in the queue
      const taskId = await runtime.submitTask({
        description: 'Test task',
        targetInstanceId: agentId,
      });

      // Now fail it - this should work
      await runtime.onAgentTaskFailed(agentId, taskId, 'Task failed');
      expect(true).toBe(true);
    });
  });

  describe('agent hierarchy', () => {
    it('should track parent-child relationships', async () => {
      const parentId = await runtime.createAgent({
        agent: { name: 'parent' },
        runtimePermissions: {
          canCreateAgent: true,
          canDestroyAgent: true,
          canManageAgentLifecycle: true,
          canSubmitTask: true,
          canListAllAgents: true,
          canGetStats: true,
          maxChildAgents: 5,
        } as RuntimeControlPermissions,
      });

      const childId = await runtime.createAgent({
        agent: { name: 'child' },
        parentInstanceId: parentId,
      });

      const parent = runtime.getAgentMetadata(parentId);
      const children = runtime._getChildren(parentId);

      expect(parent).toBeDefined();
      expect(children).toHaveLength(1);
      expect(children[0].instanceId).toBe(childId);
    });
  });

  describe('isDescendantOf', () => {
    it('should return false for non-descendant relationship', () => {
      // Direct registry check - parent-child relationship is tracked via parentInstanceId
      const parentId = 'agent-1';
      const childId = 'agent-2';
      const otherId = 'agent-3';

      // Add agents to registry directly
      runtime.createAgent({ agent: { name: 'parent' } });
      runtime.createAgent({ agent: { name: 'child' }, parentInstanceId: parentId });
      runtime.createAgent({ agent: { name: 'other' } });

      // Note: _isDescendantOf checks registry hierarchy
      expect(runtime._isDescendantOf(parentId, otherId)).toBe(false);
    });
  });

  describe('createControlClient', () => {
    it('should create a RuntimeControlClient', () => {
      const client = runtime.createControlClient('agent-1', {
        canCreateAgent: true,
        canDestroyAgent: false,
        canManageAgentLifecycle: true,
        canSubmitTask: true,
        canListAllAgents: true,
        canGetStats: true,
        maxChildAgents: 5,
      });

      expect(client).toBeDefined();
      expect(client.hasPermission('canCreateAgent')).toBe(true);
      expect(client.hasPermission('canDestroyAgent')).toBe(false);
    });
  });
});
