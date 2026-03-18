import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaExpertPersistenceStore } from '../PrismaExpertPersistenceStore';
import type { AgentPrismaService } from '../../prisma/AgentPrismaService';
import type { ExpertInstanceState } from '../ExpertPersistenceStore';

// Mock Prisma client
const mockPrismaClient = {
    expertInstance: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(),
    },
};

describe('PrismaExpertPersistenceStore', () => {
    let store: PrismaExpertPersistenceStore;
    let mockPrisma: AgentPrismaService;

    const createTestState = (overrides?: Partial<ExpertInstanceState>): ExpertInstanceState => ({
        expertClassId: 'test-expert',
        instanceId: 'instance-1',
        status: 'idle',
        lastUnreadCount: 0,
        lastCheckTimestamp: new Date(),
        pollInterval: 30000,
        consecutiveErrors: 0,
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = mockPrismaClient as unknown as AgentPrismaService;
        store = new PrismaExpertPersistenceStore(mockPrisma);
    });

    describe('saveInstance', () => {
        it('should upsert instance with all fields', async () => {
            const state = createTestState({
                expertClassId: 'my-expert',
                instanceId: 'my-instance',
                status: 'running',
                lastUnreadCount: 5,
                pollInterval: 60000,
                consecutiveErrors: 2,
            });

            await store.saveInstance(state);

            expect(mockPrismaClient.expertInstance.upsert).toHaveBeenCalledWith({
                where: {
                    expertClassId_instanceId: {
                        expertClassId: 'my-expert',
                        instanceId: 'my-instance',
                    },
                },
                update: {
                    status: 'running',
                    lastUnreadCount: 5,
                    lastCheckTimestamp: state.lastCheckTimestamp,
                    pollInterval: 60000,
                    consecutiveErrors: 2,
                },
                create: {
                    expertClassId: 'my-expert',
                    instanceId: 'my-instance',
                    status: 'running',
                    lastUnreadCount: 5,
                    lastCheckTimestamp: state.lastCheckTimestamp,
                    pollInterval: 60000,
                    consecutiveErrors: 2,
                },
            });
        });

        it('should call upsert on create and update', async () => {
            const state = createTestState();
            await store.saveInstance(state);
            expect(mockPrismaClient.expertInstance.upsert).toHaveBeenCalledTimes(1);
        });
    });

    describe('loadInstance', () => {
        it('should return null when instance not found', async () => {
            mockPrismaClient.expertInstance.findUnique.mockResolvedValue(null);

            const result = await store.loadInstance('non-existent', 'instance');
            expect(result).toBeNull();
        });

        it('should return mapped state when found', async () => {
            const dbRecord = {
                expertClassId: 'my-expert',
                instanceId: 'my-instance',
                status: 'running',
                lastUnreadCount: 10,
                lastCheckTimestamp: new Date('2024-01-01'),
                pollInterval: 45000,
                consecutiveErrors: 3,
            };
            mockPrismaClient.expertInstance.findUnique.mockResolvedValue(dbRecord);

            const result = await store.loadInstance('my-expert', 'my-instance');

            expect(result).toEqual({
                expertClassId: 'my-expert',
                instanceId: 'my-instance',
                status: 'running',
                lastUnreadCount: 10,
                lastCheckTimestamp: new Date('2024-01-01'),
                pollInterval: 45000,
                consecutiveErrors: 3,
            });
        });

        it('should cast status string to ExpertStatus', async () => {
            const dbRecord = {
                expertClassId: 'test',
                instanceId: 'test',
                status: 'idle',
                lastUnreadCount: 0,
                lastCheckTimestamp: new Date(),
                pollInterval: 30000,
                consecutiveErrors: 0,
            };
            mockPrismaClient.expertInstance.findUnique.mockResolvedValue(dbRecord);

            const result = await store.loadInstance('test', 'test');
            expect(result?.status).toBe('idle');
        });
    });

    describe('listInstances', () => {
        it('should return empty array when no instances', async () => {
            mockPrismaClient.expertInstance.findMany.mockResolvedValue([]);

            const result = await store.listInstances();
            expect(result).toEqual([]);
        });

        it('should return all instances without filter', async () => {
            const dbRecords = [
                {
                    expertClassId: 'expert-a',
                    instanceId: '1',
                    status: 'running',
                    lastUnreadCount: 0,
                    lastCheckTimestamp: new Date(),
                    pollInterval: 30000,
                    consecutiveErrors: 0,
                },
                {
                    expertClassId: 'expert-b',
                    instanceId: '1',
                    status: 'idle',
                    lastUnreadCount: 0,
                    lastCheckTimestamp: new Date(),
                    pollInterval: 30000,
                    consecutiveErrors: 0,
                },
            ];
            mockPrismaClient.expertInstance.findMany.mockResolvedValue(dbRecords);

            const result = await store.listInstances();
            expect(result).toHaveLength(2);
        });

        it('should filter by expertClassId', async () => {
            mockPrismaClient.expertInstance.findMany.mockResolvedValue([
                {
                    expertClassId: 'expert-a',
                    instanceId: '1',
                    status: 'running',
                    lastUnreadCount: 0,
                    lastCheckTimestamp: new Date(),
                    pollInterval: 30000,
                    consecutiveErrors: 0,
                },
            ]);

            const result = await store.listInstances('expert-a');
            expect(result).toHaveLength(1);
            expect(mockPrismaClient.expertInstance.findMany).toHaveBeenCalledWith({
                where: { expertClassId: 'expert-a' },
                orderBy: { createdAt: 'asc' },
            });
        });

        it('should pass through filter when expertClassId provided', async () => {
            mockPrismaClient.expertInstance.findMany.mockResolvedValue([]);

            await store.listInstances('specific-expert');

            expect(mockPrismaClient.expertInstance.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { expertClassId: 'specific-expert' },
                }),
            );
        });

        it('should not pass where clause when no filter', async () => {
            mockPrismaClient.expertInstance.findMany.mockResolvedValue([]);

            await store.listInstances();

            expect(mockPrismaClient.expertInstance.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                }),
            );
        });
    });

    describe('deleteInstance', () => {
        it('should delete by composite key', async () => {
            await store.deleteInstance('my-expert', 'my-instance');

            expect(mockPrismaClient.expertInstance.delete).toHaveBeenCalledWith({
                where: {
                    expertClassId_instanceId: {
                        expertClassId: 'my-expert',
                        instanceId: 'my-instance',
                    },
                },
            });
        });
    });

    describe('listRunningInstances', () => {
        it('should return only running instances', async () => {
            const dbRecords = [
                {
                    expertClassId: 'expert-a',
                    instanceId: '1',
                    status: 'running',
                    lastUnreadCount: 5,
                    lastCheckTimestamp: new Date(),
                    pollInterval: 30000,
                    consecutiveErrors: 0,
                },
                {
                    expertClassId: 'expert-b',
                    instanceId: '1',
                    status: 'running',
                    lastUnreadCount: 3,
                    lastCheckTimestamp: new Date(),
                    pollInterval: 30000,
                    consecutiveErrors: 0,
                },
            ];
            mockPrismaClient.expertInstance.findMany.mockResolvedValue(dbRecords);

            const result = await store.listRunningInstances();

            expect(result).toHaveLength(2);
            expect(mockPrismaClient.expertInstance.findMany).toHaveBeenCalledWith({
                where: { status: 'running' },
                orderBy: { createdAt: 'asc' },
            });
        });

        it('should return empty array when no running instances', async () => {
            mockPrismaClient.expertInstance.findMany.mockResolvedValue([]);

            const result = await store.listRunningInstances();
            expect(result).toEqual([]);
        });
    });
});
