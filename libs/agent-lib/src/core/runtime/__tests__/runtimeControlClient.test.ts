import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuntimeControlClientImpl } from '../RuntimeControlClient.js';
import type {
  AgentFilter,
  AgentMetadata,
  RuntimeStats,
  RuntimeControlAgentOptions,
} from '../types.js';
import { AgentStatus } from '../types.js';
import type { Agent } from '../../agent/agent.js';
import type { AgentRuntime } from '../AgentRuntime.js';

describe('RuntimeControlClientImpl', () => {
  let mockRuntime: AgentRuntime;
  let client: RuntimeControlClientImpl;
  const callerInstanceId = 'parent-agent';

  beforeEach(() => {
    mockRuntime = {
      createAgent: vi.fn().mockResolvedValue('child-agent-id'),
      startAgent: vi.fn().mockResolvedValue(undefined),
      stopAgent: vi.fn().mockResolvedValue(undefined),
      _destroyAgentWithCascade: vi.fn().mockResolvedValue(undefined),
      getAgent: vi.fn().mockResolvedValue({} as Agent),
      listAgents: vi.fn().mockResolvedValue([]),
      listAgentsSync: vi.fn().mockReturnValue([]),
      getAgentMetadata: vi.fn().mockReturnValue({
        instanceId: callerInstanceId,
        parentInstanceId: undefined,
      }),
      _getChildren: vi.fn().mockReturnValue([]),
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
      expect(mockRuntime.createAgent).toHaveBeenCalled();
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
          alias: 'agent-1-alias',
          status: AgentStatus.Sleeping,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          instanceId: 'agent-2',
          alias: 'agent-2-alias',
          status: AgentStatus.Running,
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
      const filter: AgentFilter = { status: AgentStatus.Sleeping };
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
        alias: 'parent-alias',
        parentInstanceId: 'grandparent',
        status: AgentStatus.Sleeping,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(client.getParentInstanceId()).toBe('grandparent');
    });

    it('should return undefined when no parent', () => {
      vi.mocked(mockRuntime.getAgentMetadata).mockReturnValue({
        instanceId: callerInstanceId,
        alias: 'parent-alias',
        status: AgentStatus.Sleeping,
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
          alias: 'child-1-alias',
          status: AgentStatus.Sleeping,
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

  describe('getStats', () => {
    it('should return stats', async () => {
      const stats: RuntimeStats = {
        totalAgents: 5,
        agentsByStatus: { idle: 3, running: 2, completed: 0, aborted: 0 },
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
