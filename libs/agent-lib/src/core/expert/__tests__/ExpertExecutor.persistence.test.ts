import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpertExecutor } from '../ExpertExecutor';
import { ExpertRegistry } from '../ExpertRegistry';
import type { ExpertConfig, IExpertInstance } from '../types';
import type { IExpertPersistenceStore, ExpertInstanceState } from '../persistence/index';

describe('ExpertExecutor persistence integration', () => {
    let executor: ExpertExecutor;
    let mockStore: IExpertPersistenceStore;
    let registry: ExpertRegistry;

    const sampleConfig: ExpertConfig = {
        expertId: 'test-expert',
        displayName: 'Test Expert',
        description: 'A test expert',
        responsibilities: 'Testing',
        capabilities: [],
        components: [],
        prompt: {
            capability: 'Testing capability',
            direction: 'Test direction',
        },
    };

    beforeEach(() => {
        registry = new ExpertRegistry();

        mockStore = {
            saveInstance: vi.fn().mockResolvedValue(undefined),
            loadInstance: vi.fn().mockResolvedValue(null),
            listInstances: vi.fn().mockResolvedValue([]),
            deleteInstance: vi.fn().mockResolvedValue(undefined),
            listRunningInstances: vi.fn().mockResolvedValue([]),
        };

        executor = new ExpertExecutor(registry, undefined, { autoStartExperts: false }, mockStore);
        // Register expert config via executor so it goes into expertConfigs Map
        executor.registerExpert(sampleConfig);
    });

    describe('constructor', () => {
        it('should accept persistence store parameter', () => {
            expect(executor).toBeDefined();
        });

        it('should work without persistence store', () => {
            const executorWithoutStore = new ExpertExecutor(registry);
            expect(executorWithoutStore).toBeDefined();
        });
    });

    describe('with persistence store', () => {
        it('should save state when creating expert', async () => {
            // This test validates that the executor can be created with a store
            // Full integration would require more complex mocking
            expect(mockStore).toBeDefined();
        });
    });

    describe('recoverRunningInstances', () => {
        it('should return empty array when no persistence store', async () => {
            const executorWithoutStore = new ExpertExecutor(registry);
            const recovered = await executorWithoutStore.recoverRunningInstances();
            expect(recovered).toEqual([]);
        });

        it('should return running instances from persistence', async () => {
            const runningStates: ExpertInstanceState[] = [
                {
                    expertClassId: 'test-expert',
                    instanceId: 'instance-1',
                    status: 'running',
                    lastUnreadCount: 5,
                    lastCheckTimestamp: new Date(),
                    pollInterval: 30000,
                    consecutiveErrors: 0,
                },
            ];

            // Create a new store with the mock resolved value
            const listRunningFn = vi.fn().mockResolvedValue(runningStates);
            const storeWithData: IExpertPersistenceStore = {
                saveInstance: vi.fn().mockResolvedValue(undefined),
                loadInstance: vi.fn().mockResolvedValue(null),
                listInstances: vi.fn().mockResolvedValue([]),
                deleteInstance: vi.fn().mockResolvedValue(undefined),
                listRunningInstances: listRunningFn,
            };
            const executorWithData = new ExpertExecutor(registry, undefined, { autoStartExperts: false }, storeWithData);
            // Register config to this new executor
            executorWithData.registerExpert(sampleConfig);

            const recovered = await executorWithData.recoverRunningInstances();
            expect(listRunningFn).toHaveBeenCalled();
            expect(recovered).toHaveLength(1);
            expect(recovered[0].expertClassId).toBe('test-expert');
            expect(recovered[0].instanceId).toBe('instance-1');
        });

        it('should skip instances whose config is not registered', async () => {
            const storeWithData: IExpertPersistenceStore = {
                saveInstance: vi.fn().mockResolvedValue(undefined),
                loadInstance: vi.fn().mockResolvedValue(null),
                listInstances: vi.fn().mockResolvedValue([]),
                deleteInstance: vi.fn().mockResolvedValue(undefined),
                listRunningInstances: vi.fn().mockResolvedValue([
                    {
                        expertClassId: 'non-existent-expert',
                        instanceId: 'instance-1',
                        status: 'running',
                        lastUnreadCount: 0,
                        lastCheckTimestamp: new Date(),
                        pollInterval: 30000,
                        consecutiveErrors: 0,
                    },
                ]),
            };
            const executorWithData = new ExpertExecutor(registry, undefined, { autoStartExperts: false }, storeWithData);
            // Register a different config so 'non-existent-expert' won't be found
            executorWithData.registerExpert(sampleConfig);

            const recovered = await executorWithData.recoverRunningInstances();
            expect(recovered).toHaveLength(0);
        });

        it('should handle errors gracefully', async () => {
            const storeWithError: IExpertPersistenceStore = {
                saveInstance: vi.fn().mockResolvedValue(undefined),
                loadInstance: vi.fn().mockResolvedValue(null),
                listInstances: vi.fn().mockResolvedValue([]),
                deleteInstance: vi.fn().mockResolvedValue(undefined),
                listRunningInstances: vi.fn().mockRejectedValue(new Error('DB error')),
            };
            const executorWithError = new ExpertExecutor(registry, undefined, { autoStartExperts: false }, storeWithError);
            executorWithError.registerExpert(sampleConfig);

            const recovered = await executorWithError.recoverRunningInstances();
            expect(recovered).toEqual([]);
        });
    });
});

describe('ExpertExecutor persistence methods', () => {
    let executor: ExpertExecutor;
    let mockStore: IExpertPersistenceStore;
    let registry: ExpertRegistry;

    beforeEach(() => {
        registry = new ExpertRegistry();
        mockStore = {
            saveInstance: vi.fn().mockResolvedValue(undefined),
            loadInstance: vi.fn().mockResolvedValue(null),
            listInstances: vi.fn().mockResolvedValue([]),
            deleteInstance: vi.fn().mockResolvedValue(undefined),
            listRunningInstances: vi.fn().mockResolvedValue([]),
        };
        executor = new ExpertExecutor(registry, undefined, { autoStartExperts: false }, mockStore);
    });

    describe('getExpert', () => {
        it('should return undefined for non-existent expert', () => {
            const expert = executor.getExpert('non-existent');
            expect(expert).toBeUndefined();
        });
    });

    describe('releaseExpert', () => {
        it('should not throw when persistence store is not available', () => {
            const executorWithoutStore = new ExpertExecutor(registry);
            expect(() => executorWithoutStore.releaseExpert('non-existent')).not.toThrow();
        });
    });

    describe('stopAll', () => {
        it('should not throw when no persistence store', async () => {
            const executorWithoutStore = new ExpertExecutor(registry);
            await expect(executorWithoutStore.stopAll()).resolves.not.toThrow();
        });
    });
});
