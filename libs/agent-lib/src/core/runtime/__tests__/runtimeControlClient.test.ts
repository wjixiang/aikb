import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeControlClientImpl } from '../RuntimeControlClient.js';
import type {
  RuntimeControlPermissions,
  AgentFilter,
  AgentMetadata,
  TaskSubmission,
  RuntimeTask,
  RuntimeStats,
  RuntimeControlAgentOptions,
} from '../types.js';
import type { Agent } from '../agent/agent.js';
import type { AgentRuntime } from '../AgentRuntime.js';

describe('RuntimeControlClientImpl', () => {
  let mockRuntime: AgentRuntime;
  let permissions: RuntimeControlPermissions;
  let client: RuntimeControlClientImpl;
  const callerInstanceId = 'parent-agent';

  const fullPermissions: RuntimeControlPermissions = {
    canCreateAgent: true,
    canDestroyAgent: true,
    canManageAgentLifecycle: true,
    canSubmitTask: true,
    canListAllAgents: true,
    canGetStats: true,
    maxChildAgents: 5,
  };

  const limitedPermissions: RuntimeControlPermissions = {
    canCreateAgent: false,
    canDestroyAgent: false,
    canManageAgentLifecycle: false,
    canSubmitTask: false,
    canListAllAgents: false,
    canGetStats: false,
    maxChildAgents: 0,
  };

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
      _isDescendantOf: vi.fn(),
    } as unknown as AgentRuntime;

    permissions = { ...fullPermissions };
    client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);
  });

  describe('getPermissions', () => {
    it('should return a copy of permissions', () => {
      const result = client.getPermissions();

      expect(result).toEqual(permissions);
      expect(result).not.toBe(permissions);
    });

    it('should not allow mutation of original permissions', () => {
      const originalCanCreate = permissions.canCreateAgent;
      client.getPermissions().canCreateAgent = false;

      expect(permissions.canCreateAgent).toBe(originalCanCreate);
    });
  });

  describe('hasPermission', () => {
    it('should return true for granted permission', () => {
      expect(client.hasPermission('canCreateAgent')).toBe(true);
      expect(client.hasPermission('canDestroyAgent')).toBe(true);
      expect(client.hasPermission('canManageAgentLifecycle')).toBe(true);
    });

    it('should return false for denied permission', () => {
      permissions.canCreateAgent = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      expect(client.hasPermission('canCreateAgent')).toBe(false);
    });
  });

  describe('createAgent', () => {
    it('should create agent when permission is granted', async () => {
      const options: RuntimeControlAgentOptions = {
        agent: { name: 'child', type: 'worker' },
      };

      const result = await client.createAgent(options);

      expect(result).toBe('child-agent-id');
      expect(mockRuntime._createChildAgent).toHaveBeenCalledWith(
        callerInstanceId,
        options,
        permissions,
      );
    });

    it('should throw error when permission is denied', async () => {
      permissions.canCreateAgent = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      await expect(
        client.createAgent({ agent: { name: 'child' } }),
      ).rejects.toThrow('Permission denied: cannot create agent');
    });
  });

  describe('startAgent', () => {
    it('should start agent when permission is granted and is descendant', async () => {
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(true);

      await client.startAgent('child-agent');

      expect(mockRuntime.startAgent).toHaveBeenCalledWith('child-agent');
    });

    it('should throw error when permission is denied', async () => {
      permissions.canManageAgentLifecycle = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      await expect(client.startAgent('child-agent')).rejects.toThrow(
        'Permission denied: cannot manage agent lifecycle',
      );
    });

    it('should throw error when target is not descendant', async () => {
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(false);

      await expect(client.startAgent('other-agent')).rejects.toThrow(
        'Permission denied: cannot start agent other-agent (not owned by you)',
      );
    });

    it('should allow starting self', async () => {
      await client.startAgent(callerInstanceId);

      expect(mockRuntime.startAgent).toHaveBeenCalledWith(callerInstanceId);
    });
  });

  describe('stopAgent', () => {
    it('should stop agent when permission is granted and is descendant', async () => {
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(true);

      await client.stopAgent('child-agent');

      expect(mockRuntime.stopAgent).toHaveBeenCalledWith('child-agent');
    });

    it('should throw error when permission is denied', async () => {
      permissions.canManageAgentLifecycle = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      await expect(client.stopAgent('child-agent')).rejects.toThrow(
        'Permission denied: cannot manage agent lifecycle',
      );
    });
  });

  describe('destroyAgent', () => {
    it('should destroy agent when permission is granted', async () => {
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(true);

      await client.destroyAgent('child-agent');

      expect(mockRuntime._destroyAgentWithCascade).toHaveBeenCalledWith('child-agent', true);
    });

    it('should destroy agent with cascade false when specified', async () => {
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(true);

      await client.destroyAgent('child-agent', { cascade: false });

      expect(mockRuntime._destroyAgentWithCascade).toHaveBeenCalledWith('child-agent', false);
    });

    it('should throw error when permission is denied', async () => {
      permissions.canDestroyAgent = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      await expect(client.destroyAgent('child-agent')).rejects.toThrow(
        'Permission denied: cannot destroy agent',
      );
    });

    it('should throw error when target is not descendant', async () => {
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(false);

      await expect(client.destroyAgent('other-agent')).rejects.toThrow(
        'Permission denied: cannot destroy agent other-agent (not owned by you)',
      );
    });
  });

  describe('getAgent', () => {
    it('should return agent when canListAllAgents is true', async () => {
      const mockAgent = {} as Agent;
      vi.mocked(mockRuntime.getAgent).mockResolvedValue(mockAgent);

      const result = await client.getAgent('some-agent');

      expect(result).toBe(mockAgent);
    });

    it('should return agent when is descendant', async () => {
      const mockAgent = {} as Agent;
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(true);
      vi.mocked(mockRuntime.getAgent).mockResolvedValue(mockAgent);

      const result = await client.getAgent('child-agent');

      expect(result).toBe(mockAgent);
    });

    it('should return undefined when not descendant and not canListAllAgents', async () => {
      // Create a client with limited permissions (canListAllAgents: false)
      const limitedClient = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, {
        ...limitedPermissions,
        canListAllAgents: false,
      });
      vi.mocked(mockRuntime._isDescendantOf).mockReturnValue(false);

      const result = await limitedClient.getAgent('other-agent');

      expect(result).toBeUndefined();
    });
  });

  describe('listAgents', () => {
    it('should list all agents when canListAllAgents is true', async () => {
      const agents: AgentMetadata[] = [
        { instanceId: 'agent-1', status: 'idle', createdAt: new Date(), updatedAt: new Date() },
        { instanceId: 'agent-2', status: 'running', createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.mocked(mockRuntime.listAgents).mockResolvedValue(agents);

      const result = await client.listAgents();

      expect(result).toEqual(agents);
      expect(mockRuntime.listAgents).toHaveBeenCalled();
    });

    it('should filter and return only child agents when canListAllAgents is false', async () => {
      // Create a client with limited permissions (canListAllAgents: false)
      const limitedClient = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, {
        ...limitedPermissions,
        canListAllAgents: false,
      });
      const allAgents: AgentMetadata[] = [
        { instanceId: 'parent', status: 'idle', createdAt: new Date(), updatedAt: new Date() },
        { instanceId: 'child-1', status: 'idle', parentInstanceId: callerInstanceId, createdAt: new Date(), updatedAt: new Date() },
        { instanceId: 'child-2', status: 'idle', parentInstanceId: callerInstanceId, createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.mocked(mockRuntime.listAgents).mockResolvedValue(allAgents);

      const result = await limitedClient.listAgents();

      expect(result).toHaveLength(2);
      expect(result.every((a) => a.parentInstanceId === callerInstanceId)).toBe(true);
    });

    it('should pass filter to runtime when canListAllAgents is true', async () => {
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
        { instanceId: 'child-1', status: 'idle', createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.mocked(mockRuntime._getChildren).mockReturnValue(children);

      const result = await client.listChildAgents();

      expect(result).toEqual(children);
      expect(mockRuntime._getChildren).toHaveBeenCalledWith(callerInstanceId);
    });
  });

  describe('submitTask', () => {
    it('should submit task when permission is granted', async () => {
      const task: TaskSubmission = {
        description: 'Test task',
        targetInstanceId: 'agent-1',
      };

      const result = await client.submitTask(task);

      expect(result).toBe('task-id');
      expect(mockRuntime.submitTask).toHaveBeenCalledWith(task);
    });

    it('should throw error when permission is denied', async () => {
      permissions.canSubmitTask = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      await expect(
        client.submitTask({ description: 'Test', targetInstanceId: 'agent-1' }),
      ).rejects.toThrow('Permission denied: cannot submit task');
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
    it('should return stats when permission is granted', async () => {
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

    it('should throw error when permission is denied', async () => {
      permissions.canGetStats = false;
      client = new RuntimeControlClientImpl(mockRuntime, callerInstanceId, permissions);

      await expect(client.getStats()).rejects.toThrow(
        'Permission denied: cannot get stats',
      );
    });
  });
});
