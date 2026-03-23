import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeControlClientImpl } from '../RuntimeControlClient.js';
import type {
  AgentFilter,
  AgentMetadata,
  TaskSubmission,
  RuntimeTask,
  RuntimeStats,
  RuntimeControlAgentOptions,
} from '../types.js';
import type { Agent } from '../../agent/agent.js';
import type { AgentRuntime } from '../AgentRuntime.js';

describe('RuntimeControlClientImpl', () => {
  let mockRuntime: AgentRuntime;
  let client: RuntimeControlClientImpl;
  const callerInstanceId = 'parent-agent';

  beforeEach(() => {
    mockRuntime = {
      _createChildAgent: vi.fn().mockResolvedValue('child-agent-id'),
      startAgent: vi.fn().mockResolvedValue(undefined),
      stopAgent: vi.fn().mockResolvedValue(undefined),
      _destroyAgentWithCascade: vi.fn().mockResolvedValue(undefined),
      getAgent: vi.fn().mockResolvedValue({} as Agent),
      listAgents: vi.fn().mockResolvedValue([]),
      getAgentMetadata: vi.fn().mockReturnValue({
        instanceId: callerInstanceId,
        parentInstanceId: undefined,
      }),
      _getChildren: vi.fn().mockReturnValue([]),
      submitTask: vi.fn().mockResolvedValue('task-id'),
      getTaskStatus: vi.fn().mockResolvedValue({} as RuntimeTask),
      getPendingTasks: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue({
        totalAgents: 1,
        agentsByStatus: { idle: 1, running: 0, completed: 0, aborted: 0 },
      }),
      registerInTopology: vi.fn(),
      unregisterFromTopology: vi.fn(),
      connectAgents: vi.fn(),
      disconnectAgents: vi.fn(),
      getTopologyGraph: vi.fn(),
      getTopologyStats: vi.fn(),
    } as unknown as AgentRuntime;

    client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId);
  });

  describe('createAgent', () => {
    it('should create agent and return instanceId', async () => {
      const options: RuntimeControlAgentOptions = {
        agent: { name: 'child', type: 'worker' },
      };

      const result = await client.createAgent(options);

      expect(result).toBe('child-agent-id');
      expect(mockRuntime._createChildAgent).toHaveBeenCalledWith(
        callerInstanceId,
        options,
      );
    });
  });

  describe('startAgent', () => {
    it('should start agent', async () => {
      await client.startAgent('child-agent');

      expect(mockRuntime.startAgent).toHaveBeenCalledWith('child-agent');
    });

    it('should allow starting self', async () => {
      await client.startAgent(callerInstanceId);

      expect(mockRuntime.startAgent).toHaveBeenCalledWith(callerInstanceId);
    });
  });

  describe('stopAgent', () => {
    it('should stop agent', async () => {
      await client.stopAgent('child-agent');

      expect(mockRuntime.stopAgent).toHaveBeenCalledWith('child-agent');
    });
  });

  describe('destroyAgent', () => {
    it('should destroy agent with cascade by default', async () => {
      await client.destroyAgent('child-agent');

      expect(mockRuntime._destroyAgentWithCascade).toHaveBeenCalledWith(
        'child-agent',
        true,
      );
    });

    it('should destroy agent with cascade false when specified', async () => {
      await client.destroyAgent('child-agent', { cascade: false });

      expect(mockRuntime._destroyAgentWithCascade).toHaveBeenCalledWith(
        'child-agent',
        false,
      );
    });
  });

  describe('getAgent', () => {
    it('should return agent', async () => {
      const mockAgent = {} as Agent;
      vi.mocked(mockRuntime.getAgent).mockResolvedValue(mockAgent);

      const result = await client.getAgent('some-agent');

      expect(result).toBe(mockAgent);
    });
  });

  describe('listAgents', () => {
    it('should list all agents', async () => {
      const agents: AgentMetadata[] = [
        {
          instanceId: 'agent-1',
          status: 'idle',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          instanceId: 'agent-2',
          status: 'running',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(mockRuntime.listAgents).mockResolvedValue(agents);

      const result = await client.listAgents();

      expect(result).toEqual(agents);
      expect(mockRuntime.listAgents).toHaveBeenCalled();
    });

    it('should pass filter to runtime', async () => {
      const filter: AgentFilter = { status: 'idle' };
      vi.mocked(mockRuntime.listAgents).mockResolvedValue([]);

      await client.listAgents(filter);

      expect(mockRuntime.listAgents).toHaveBeenCalledWith(filter);
    });
  });

  describe('getSelfInstanceId', () => {
    it('should return caller instance id', () => {
      expect(client.getSelfInstanceId()).toBe(callerInstanceId);
    });
  });

  describe('getParentInstanceId', () => {
    it('should return parent instance id from metadata', () => {
      vi.mocked(mockRuntime.getAgentMetadata).mockReturnValue({
        instanceId: callerInstanceId,
        parentInstanceId: 'grandparent',
        status: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(client.getParentInstanceId()).toBe('grandparent');
    });

    it('should return undefined when no parent', () => {
      vi.mocked(mockRuntime.getAgentMetadata).mockReturnValue({
        instanceId: callerInstanceId,
        status: 'idle',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(client.getParentInstanceId()).toBeUndefined();
    });
  });

  describe('listChildAgents', () => {
    it('should return children from runtime', async () => {
      const children: AgentMetadata[] = [
        {
          instanceId: 'child-1',
          status: 'idle',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      vi.mocked(mockRuntime._getChildren).mockReturnValue(children);

      const result = await client.listChildAgents();

      expect(result).toEqual(children);
      expect(mockRuntime._getChildren).toHaveBeenCalledWith(callerInstanceId);
    });
  });

  describe('submitTask', () => {
    it('should submit task', async () => {
      const task: TaskSubmission = {
        description: 'Test task',
        targetInstanceId: 'agent-1',
      };

      const result = await client.submitTask(task);

      expect(result).toBe('task-id');
      expect(mockRuntime.submitTask).toHaveBeenCalledWith(task);
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status from runtime', async () => {
      const task: RuntimeTask = {
        taskId: 'task-1',
        description: 'Test',
        priority: 'normal',
        status: 'pending',
        targetInstanceId: 'agent-1',
        createdAt: new Date(),
      };
      vi.mocked(mockRuntime.getTaskStatus).mockResolvedValue(task);

      const result = await client.getTaskStatus('task-1');

      expect(result).toEqual(task);
      expect(mockRuntime.getTaskStatus).toHaveBeenCalledWith('task-1');
    });
  });

  describe('getPendingTasks', () => {
    it('should return pending tasks from runtime', async () => {
      const tasks: RuntimeTask[] = [];
      vi.mocked(mockRuntime.getPendingTasks).mockResolvedValue(tasks);

      const result = await client.getPendingTasks('agent-1');

      expect(result).toEqual(tasks);
      expect(mockRuntime.getPendingTasks).toHaveBeenCalledWith('agent-1');
    });

    it('should call without instanceId when not provided', async () => {
      vi.mocked(mockRuntime.getPendingTasks).mockResolvedValue([]);

      await client.getPendingTasks();

      expect(mockRuntime.getPendingTasks).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getStats', () => {
    it('should return stats', async () => {
      const stats: RuntimeStats = {
        totalAgents: 5,
        agentsByStatus: { idle: 3, running: 2, completed: 0, aborted: 0 },
        totalPendingTasks: 10,
        totalProcessingTasks: 2,
      };
      vi.mocked(mockRuntime.getStats).mockResolvedValue(stats);

      const result = await client.getStats();

      expect(result).toEqual(stats);
    });
  });

  describe('topology methods', () => {
    it('should call registerInTopology', () => {
      client.registerInTopology('agent-1', 'worker', ['task1']);
      expect(mockRuntime.registerInTopology).toHaveBeenCalledWith(
        'agent-1',
        'worker',
        ['task1'],
      );
    });

    it('should call unregisterFromTopology', () => {
      client.unregisterFromTopology('agent-1');
      expect(mockRuntime.unregisterFromTopology).toHaveBeenCalledWith(
        'agent-1',
      );
    });

    it('should call connectAgents', () => {
      client.connectAgents('agent-1', 'agent-2', 'peer');
      expect(mockRuntime.connectAgents).toHaveBeenCalledWith(
        'agent-1',
        'agent-2',
        'peer',
      );
    });

    it('should call disconnectAgents', () => {
      client.disconnectAgents('agent-1', 'agent-2');
      expect(mockRuntime.disconnectAgents).toHaveBeenCalledWith(
        'agent-1',
        'agent-2',
      );
    });

    it('should call getTopologyGraph', () => {
      client.getTopologyGraph();
      expect(mockRuntime.getTopologyGraph).toHaveBeenCalled();
    });

    it('should call getTopologyStats', () => {
      client.getTopologyStats();
      expect(mockRuntime.getTopologyStats).toHaveBeenCalled();
    });
  });
});
