import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../AgentRegistry.js';
import type { AgentMetadata } from '../types.js';
import { AgentStatus } from '../types.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  const createTestMetadata = (
    overrides: Partial<AgentMetadata> = {},
  ): AgentMetadata => ({
    instanceId: 'test-instance-1',
    status: AgentStatus.Idle,
    name: 'Test Agent',
    agentType: 'test',
    description: 'A test agent',
    config: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('register', () => {
    it('should register a new agent', () => {
      const metadata = createTestMetadata();
      registry.register(metadata);

      expect(registry.get('test-instance-1')).toEqual(metadata);
    });

    it('should update agent on re-register with same instanceId', () => {
      const metadata1 = createTestMetadata({ status: AgentStatus.Idle });
      const metadata2 = createTestMetadata({ status: AgentStatus.Running });

      registry.register(metadata1);
      registry.register(metadata2);

      expect(registry.get('test-instance-1')?.status).toBe(AgentStatus.Running);
    });
  });

  describe('unregister', () => {
    it('should unregister an existing agent', () => {
      const metadata = createTestMetadata();
      registry.register(metadata);

      registry.unregister('test-instance-1');

      expect(registry.get('test-instance-1')).toBeUndefined();
      expect(registry.has('test-instance-1')).toBe(false);
    });

    it('should not throw when unregistering non-existent agent', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('get', () => {
    it('should return agent metadata by instanceId', () => {
      const metadata = createTestMetadata();
      registry.register(metadata);

      const result = registry.get('test-instance-1');

      expect(result).toEqual(metadata);
    });

    it('should return undefined for non-existent agent', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('findByStatus', () => {
    it('should find agents by status', () => {
      registry.register(
        createTestMetadata({ instanceId: 'agent-1', status: AgentStatus.Idle }),
      );
      registry.register(
        createTestMetadata({
          instanceId: 'agent-2',
          status: AgentStatus.Running,
        }),
      );
      registry.register(
        createTestMetadata({ instanceId: 'agent-3', status: AgentStatus.Idle }),
      );

      const idleAgents = registry.findByStatus(AgentStatus.Idle);
      const runningAgents = registry.findByStatus(AgentStatus.Running);

      expect(idleAgents).toHaveLength(2);
      expect(idleAgents.map((a) => a.instanceId)).toContain('agent-1');
      expect(idleAgents.map((a) => a.instanceId)).toContain('agent-3');
      expect(runningAgents).toHaveLength(1);
      expect(runningAgents[0].instanceId).toBe('agent-2');
    });

    it('should return empty array when no agents match status', () => {
      registry.register(createTestMetadata({ status: AgentStatus.Idle }));

      const runningAgents = registry.findByStatus(AgentStatus.Running);

      expect(runningAgents).toHaveLength(0);
    });
  });

  describe('findIdle', () => {
    it('should return all idle agents', () => {
      registry.register(
        createTestMetadata({ instanceId: 'agent-1', status: AgentStatus.Idle }),
      );
      registry.register(
        createTestMetadata({
          instanceId: 'agent-2',
          status: AgentStatus.Running,
        }),
      );
      registry.register(
        createTestMetadata({ instanceId: 'agent-3', status: AgentStatus.Idle }),
      );

      const idleAgents = registry.findIdle();

      expect(idleAgents).toHaveLength(2);
    });
  });

  describe('findByType', () => {
    it('should find agents by type', () => {
      registry.register(
        createTestMetadata({ instanceId: 'agent-1', agentType: 'worker' }),
      );
      registry.register(
        createTestMetadata({ instanceId: 'agent-2', agentType: 'supervisor' }),
      );
      registry.register(
        createTestMetadata({ instanceId: 'agent-3', agentType: 'worker' }),
      );

      const workerAgents = registry.findByType('worker');

      expect(workerAgents).toHaveLength(2);
      expect(workerAgents.map((a) => a.instanceId)).toContain('agent-1');
      expect(workerAgents.map((a) => a.instanceId)).toContain('agent-3');
    });
  });

  describe('update', () => {
    it('should update agent metadata', () => {
      registry.register(createTestMetadata({ status: AgentStatus.Idle }));

      registry.update('test-instance-1', { status: AgentStatus.Running });

      expect(registry.get('test-instance-1')?.status).toBe(AgentStatus.Running);
    });

    it('should update updatedAt timestamp', () => {
      const originalDate = new Date('2020-01-01');
      registry.register(createTestMetadata({ updatedAt: originalDate }));

      const beforeUpdate = new Date();
      registry.update('test-instance-1', { status: AgentStatus.Running });

      const updated = registry.get('test-instance-1');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
    });

    it('should not throw when updating non-existent agent', () => {
      expect(() =>
        registry.update('non-existent', { status: AgentStatus.Running }),
      ).not.toThrow();
    });
  });

  describe('getAll', () => {
    it('should return all registered agents', () => {
      registry.register(createTestMetadata({ instanceId: 'agent-1' }));
      registry.register(createTestMetadata({ instanceId: 'agent-2' }));
      registry.register(createTestMetadata({ instanceId: 'agent-3' }));

      const allAgents = registry.getAll();

      expect(allAgents).toHaveLength(3);
    });

    it('should return empty array when no agents registered', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('has', () => {
    it('should return true for existing agent', () => {
      registry.register(createTestMetadata());

      expect(registry.has('test-instance-1')).toBe(true);
    });

    it('should return false for non-existing agent', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return correct agent count', () => {
      expect(registry.size).toBe(0);

      registry.register(createTestMetadata({ instanceId: 'agent-1' }));
      expect(registry.size).toBe(1);

      registry.register(createTestMetadata({ instanceId: 'agent-2' }));
      expect(registry.size).toBe(2);

      registry.unregister('agent-1');
      expect(registry.size).toBe(1);
    });
  });

  describe('hierarchy methods', () => {
    beforeEach(() => {
      registry.register(
        createTestMetadata({ instanceId: 'parent', name: 'Parent Agent' }),
      );
      registry.register(
        createTestMetadata({
          instanceId: 'child-1',
          parentInstanceId: 'parent',
        }),
      );
      registry.register(
        createTestMetadata({
          instanceId: 'child-2',
          parentInstanceId: 'parent',
        }),
      );
      registry.register(
        createTestMetadata({
          instanceId: 'grandchild',
          parentInstanceId: 'child-1',
        }),
      );
      registry.register(createTestMetadata({ instanceId: 'orphan' }));
    });

    describe('getChildren', () => {
      it('should return direct children of an agent', () => {
        const children = registry.getChildren('parent');

        expect(children).toHaveLength(2);
        expect(children.map((c) => c.instanceId)).toContain('child-1');
        expect(children.map((c) => c.instanceId)).toContain('child-2');
      });

      it('should return empty array for agent with no children', () => {
        const children = registry.getChildren('orphan');

        expect(children).toHaveLength(0);
      });

      it('should return empty array for non-existent agent', () => {
        const children = registry.getChildren('non-existent');

        expect(children).toHaveLength(0);
      });
    });

    describe('getDescendants', () => {
      it('should return all descendants (children and grandchildren)', () => {
        const descendants = registry.getDescendants('parent');

        expect(descendants).toHaveLength(3);
        expect(descendants.map((d) => d.instanceId)).toContain('child-1');
        expect(descendants.map((d) => d.instanceId)).toContain('child-2');
        expect(descendants.map((d) => d.instanceId)).toContain('grandchild');
      });

      it('should return only direct children for leaf agent', () => {
        // child-2 has no children, so descendants should be empty
        const descendants = registry.getDescendants('child-2');

        expect(descendants).toHaveLength(0);
      });

      it('should return empty array for orphan agent', () => {
        const descendants = registry.getDescendants('orphan');

        expect(descendants).toHaveLength(0);
      });
    });

    describe('isAncestorOf', () => {
      it('should return true if ancestorId is direct parent', () => {
        expect(registry.isAncestorOf('parent', 'child-1')).toBe(true);
      });

      it('should return true if ancestorId is grandparent', () => {
        expect(registry.isAncestorOf('parent', 'grandchild')).toBe(true);
      });

      it('should return false if not an ancestor', () => {
        expect(registry.isAncestorOf('child-1', 'child-2')).toBe(false);
        expect(registry.isAncestorOf('orphan', 'child-1')).toBe(false);
      });

      it('should return false if descendant does not exist', () => {
        expect(registry.isAncestorOf('parent', 'non-existent')).toBe(false);
      });

      it('should return false for agent without parent', () => {
        expect(registry.isAncestorOf('parent', 'orphan')).toBe(false);
      });
    });

    describe('addChildRelation', () => {
      it('should add child relation to parent', () => {
        registry.addChildRelation('orphan', 'child-1');

        const parent = registry.get('orphan');
        expect(parent?.childInstanceIds).toContain('child-1');
      });

      it('should not add duplicate child relations', () => {
        registry.addChildRelation('parent', 'child-1');
        registry.addChildRelation('parent', 'child-1');

        const parent = registry.get('parent');
        expect(
          parent?.childInstanceIds?.filter((id) => id === 'child-1'),
        ).toHaveLength(1);
      });

      it('should not throw when adding relation to non-existent parent', () => {
        expect(() =>
          registry.addChildRelation('non-existent', 'child-1'),
        ).not.toThrow();
      });
    });

    describe('removeChildRelation', () => {
      it('should remove child relation from parent', () => {
        registry.addChildRelation('parent', 'child-1');
        registry.removeChildRelation('parent', 'child-1');

        const parent = registry.get('parent');
        expect(parent?.childInstanceIds).not.toContain('child-1');
      });

      it('should not throw when removing non-existent relation', () => {
        expect(() =>
          registry.removeChildRelation('parent', 'non-existent'),
        ).not.toThrow();
      });

      it('should not throw when parent does not exist', () => {
        expect(() =>
          registry.removeChildRelation('non-existent', 'child-1'),
        ).not.toThrow();
      });
    });
  });

  describe('database sync', () => {
    describe('syncFromDatabase', () => {
      it('should not throw when no persistence service is available', async () => {
        const registryNoPersistence = new AgentRegistry();
        await expect(
          registryNoPersistence.syncFromDatabase(),
        ).resolves.not.toThrow();
      });
    });

    describe('syncToDatabase', () => {
      it('should not throw when no persistence service is available', async () => {
        const registryNoPersistence = new AgentRegistry();
        registryNoPersistence.register(createTestMetadata());

        await expect(
          registryNoPersistence.syncToDatabase('test-instance-1'),
        ).resolves.not.toThrow();
      });
    });
  });
});
