import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryExpertPersistenceStore } from '../InMemoryExpertPersistenceStore';
import type { ExpertInstanceState } from '../ExpertPersistenceStore';

describe('InMemoryExpertPersistenceStore', () => {
    let store: InMemoryExpertPersistenceStore;

    const createTestState = (overrides?: Partial<ExpertInstanceState>): ExpertInstanceState => ({
        expertClassId: 'test-expert',
        instanceId: 'instance-1',
        status: 'idle',
        ...overrides,
    });

    beforeEach(() => {
        store = new InMemoryExpertPersistenceStore();
    });

    describe('saveInstance', () => {
        it('should save a new instance state', async () => {
            const state = createTestState();
            await store.saveInstance(state);

            const loaded = await store.loadInstance(state.expertClassId, state.instanceId);
            expect(loaded).not.toBeNull();
            expect(loaded?.expertClassId).toBe(state.expertClassId);
            expect(loaded?.instanceId).toBe(state.instanceId);
            expect(loaded?.status).toBe(state.status);
        });

        it('should update existing instance state', async () => {
            const state1 = createTestState({ status: 'idle' });
            await store.saveInstance(state1);

            const state2 = createTestState({ status: 'running' });
            await store.saveInstance(state2);

            const loaded = await store.loadInstance(state1.expertClassId, state1.instanceId);
            expect(loaded?.status).toBe('running');
        });

        it('should replace entire state on update', async () => {
            const state1 = createTestState({ status: 'idle' });
            await store.saveInstance(state1);

            // Update with different values
            const state2 = createTestState({ status: 'running' });
            await store.saveInstance(state2);

            const loaded = await store.loadInstance(state1.expertClassId, state1.instanceId);
            expect(loaded?.status).toBe('running');
        });
    });

    describe('loadInstance', () => {
        it('should return null for non-existent instance', async () => {
            const loaded = await store.loadInstance('non-existent', 'instance');
            expect(loaded).toBeNull();
        });

        it('should return saved instance with all fields', async () => {
            const state = createTestState({
                expertClassId: 'my-expert',
                instanceId: 'my-instance',
                status: 'running',
            });
            await store.saveInstance(state);

            const loaded = await store.loadInstance('my-expert', 'my-instance');
            expect(loaded).toEqual(state);
        });
    });

    describe('listInstances', () => {
        it('should return empty array when no instances saved', async () => {
            const instances = await store.listInstances();
            expect(instances).toEqual([]);
        });

        it('should return all instances when no filter provided', async () => {
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '1' }));
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '2' }));
            await store.saveInstance(createTestState({ expertClassId: 'expert-b', instanceId: '1' }));

            const instances = await store.listInstances();
            expect(instances).toHaveLength(3);
        });

        it('should filter instances by expertClassId', async () => {
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '1' }));
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '2' }));
            await store.saveInstance(createTestState({ expertClassId: 'expert-b', instanceId: '1' }));

            const instances = await store.listInstances('expert-a');
            expect(instances).toHaveLength(2);
            expect(instances.every(i => i.expertClassId === 'expert-a')).toBe(true);
        });

        it('should return independent copies of instances', async () => {
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '1' }));

            const instances = await store.listInstances();
            instances[0].status = 'modified';

            const loaded = await store.loadInstance('expert-a', '1');
            expect(loaded?.status).toBe('idle'); // Original should be unchanged
        });
    });

    describe('deleteInstance', () => {
        it('should delete existing instance', async () => {
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '1' }));
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '2' }));

            await store.deleteInstance('expert-a', '1');

            const instances = await store.listInstances('expert-a');
            expect(instances).toHaveLength(1);
            expect(instances[0].instanceId).toBe('2');
        });

        it('should not throw when deleting non-existent instance', async () => {
            await expect(store.deleteInstance('non-existent', 'instance')).resolves.not.toThrow();
        });

        it('should not affect other instances', async () => {
            await store.saveInstance(createTestState({ expertClassId: 'expert-a', instanceId: '1' }));
            await store.saveInstance(createTestState({ expertClassId: 'expert-b', instanceId: '1' }));

            await store.deleteInstance('expert-a', '1');

            const expertB = await store.loadInstance('expert-b', '1');
            expect(expertB).not.toBeNull();
        });
    });

    describe('listRunningInstances', () => {
        it('should return empty array when no running instances', async () => {
            await store.saveInstance(createTestState({ status: 'idle' }));
            await store.saveInstance(createTestState({ status: 'completed' }));

            const running = await store.listRunningInstances();
            expect(running).toEqual([]);
        });

        it('should return only running instances', async () => {
            // Use distinct keys to avoid overwrites
            await store.saveInstance(createTestState({ expertClassId: 'a', instanceId: '1', status: 'idle' }));
            await store.saveInstance(createTestState({ expertClassId: 'b', instanceId: '1', status: 'running' }));
            await store.saveInstance(createTestState({ expertClassId: 'c', instanceId: '1', status: 'running' }));
            await store.saveInstance(createTestState({ expertClassId: 'd', instanceId: '1', status: 'completed' }));

            const running = await store.listRunningInstances();
            expect(running).toHaveLength(2);
            expect(running.every(i => i.status === 'running')).toBe(true);
        });
    });

    describe('data independence', () => {
        it('should return independent copies from loadInstance', async () => {
            await store.saveInstance(createTestState());

            const loaded1 = await store.loadInstance('test-expert', 'instance-1');
            const loaded2 = await store.loadInstance('test-expert', 'instance-1');

            expect(loaded1).not.toBe(loaded2); // Different objects
            expect(loaded1).toEqual(loaded2); // Same content

            // Modifying one should not affect the other
            loaded1!.status = 'running';
            loaded2!.status = 'idle';

            const reloaded = await store.loadInstance('test-expert', 'instance-1');
            expect(reloaded?.status).toBe('idle'); // Original unchanged
        });
    });
});
