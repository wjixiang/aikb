import { describe, it, expect } from 'vitest';
import type { ExpertInstanceState, IExpertPersistenceStore } from '../ExpertPersistenceStore';

// Test that the interface is properly typed
describe('ExpertInstanceState interface', () => {
    it('should accept valid state objects', () => {
        const state: ExpertInstanceState = {
            expertClassId: 'test-expert',
            instanceId: 'instance-1',
            status: 'idle',
            lastUnreadCount: 0,
            lastCheckTimestamp: new Date(),
            pollInterval: 30000,
            consecutiveErrors: 0,
        };
        expect(state.expertClassId).toBe('test-expert');
    });

    it('should accept all valid status values', () => {
        const statuses: ExpertInstanceState['status'][] = ['idle', 'ready', 'running', 'completed', 'failed', 'suspended'];

        for (const status of statuses) {
            const state: ExpertInstanceState = {
                expertClassId: 'test',
                instanceId: 'test',
                status,
                lastUnreadCount: 0,
                lastCheckTimestamp: new Date(),
                pollInterval: 30000,
                consecutiveErrors: 0,
            };
            expect(state.status).toBe(status);
        }
    });
});

// Mock implementation for interface compliance testing
class MockPersistenceStore implements IExpertPersistenceStore {
    private instances: Map<string, ExpertInstanceState> = new Map();

    async saveInstance(state: ExpertInstanceState): Promise<void> {
        const key = `${state.expertClassId}/${state.instanceId}`;
        this.instances.set(key, { ...state });
    }

    async loadInstance(expertClassId: string, instanceId: string): Promise<ExpertInstanceState | null> {
        const key = `${expertClassId}/${instanceId}`;
        return this.instances.get(key) || null;
    }

    async listInstances(expertClassId?: string): Promise<ExpertInstanceState[]> {
        const all = Array.from(this.instances.values());
        if (!expertClassId) return all;
        return all.filter(s => s.expertClassId === expertClassId);
    }

    async deleteInstance(expertClassId: string, instanceId: string): Promise<void> {
        const key = `${expertClassId}/${instanceId}`;
        this.instances.delete(key);
    }

    async listRunningInstances(): Promise<ExpertInstanceState[]> {
        return Array.from(this.instances.values()).filter(s => s.status === 'running');
    }
}

describe('IExpertPersistenceStore interface compliance', () => {
    let store: MockPersistenceStore;

    beforeEach(() => {
        store = new MockPersistenceStore();
    });

    it('should implement all interface methods', async () => {
        expect(typeof store.saveInstance).toBe('function');
        expect(typeof store.loadInstance).toBe('function');
        expect(typeof store.listInstances).toBe('function');
        expect(typeof store.deleteInstance).toBe('function');
        expect(typeof store.listRunningInstances).toBe('function');
    });

    it('should save and retrieve instance', async () => {
        const state: ExpertInstanceState = {
            expertClassId: 'test-expert',
            instanceId: 'instance-1',
            status: 'running',
            lastUnreadCount: 5,
            lastCheckTimestamp: new Date(),
            pollInterval: 60000,
            consecutiveErrors: 2,
        };

        await store.saveInstance(state);
        const retrieved = await store.loadInstance('test-expert', 'instance-1');

        expect(retrieved).not.toBeNull();
        expect(retrieved?.expertClassId).toBe('test-expert');
        expect(retrieved?.status).toBe('running');
    });

    it('should list running instances', async () => {
        await store.saveInstance({
            expertClassId: 'a',
            instanceId: '1',
            status: 'running',
            lastUnreadCount: 0,
            lastCheckTimestamp: new Date(),
            pollInterval: 30000,
            consecutiveErrors: 0,
        });
        await store.saveInstance({
            expertClassId: 'b',
            instanceId: '1',
            status: 'idle',
            lastUnreadCount: 0,
            lastCheckTimestamp: new Date(),
            pollInterval: 30000,
            consecutiveErrors: 0,
        });
        await store.saveInstance({
            expertClassId: 'c',
            instanceId: '1',
            status: 'running',
            lastUnreadCount: 0,
            lastCheckTimestamp: new Date(),
            pollInterval: 30000,
            consecutiveErrors: 0,
        });

        const running = await store.listRunningInstances();
        expect(running).toHaveLength(2);
        expect(running.every(s => s.status === 'running')).toBe(true);
    });
});
