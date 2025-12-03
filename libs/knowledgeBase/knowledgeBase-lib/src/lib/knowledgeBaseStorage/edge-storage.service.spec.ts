import { Test, TestingModule } from '@nestjs/testing';
import { EdgeStorageService } from './edge-storage.service';
import { EdgeData } from '../types';
import { GraphDBPrismaService } from 'graph-db';

// Create a mock type for the Prisma service
type MockPrismaService = {
  edge: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
};

describe('EdgeStorageService', () => {
  let service: EdgeStorageService;
  let prismaService: MockPrismaService;

  beforeEach(async () => {
    const mockPrismaService: MockPrismaService = {
      edge: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EdgeStorageService,
        {
          provide: GraphDBPrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EdgeStorageService>(EdgeStorageService);
    prismaService = module.get<MockPrismaService>(GraphDBPrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an edge with generated ID', async () => {
      const edgeData: Omit<EdgeData, 'id'> = {
        type: 'start',
        in: 'node1',
        out: 'node2',
      };

      const mockCreatedEdge = {
        id: 'test-edge-id',
        type: edgeData.type,
        inId: edgeData.in,
        outId: edgeData.out,
      };

      prismaService.edge.create.mockResolvedValue(mockCreatedEdge);

      const result = await service.create(edgeData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.type).toEqual(edgeData.type);
      expect(result.in).toEqual(edgeData.in);
      expect(result.out).toEqual(edgeData.out);
      expect(prismaService.edge.create).toHaveBeenCalledWith({
        data: {
          type: edgeData.type,
          inId: edgeData.in,
          outId: edgeData.out,
        },
      });
    });
  });

  describe('findById', () => {
    it('should return null for non-existent edge', async () => {
      prismaService.edge.findUnique.mockResolvedValue(null);
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
      expect(prismaService.edge.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id', deletedAt: null },
      });
    });
  });

  describe('findByIds', () => {
    it('should return array of nulls for non-existent edges', async () => {
      prismaService.edge.findMany.mockResolvedValue([]);
      const result = await service.findByIds(['id1', 'id2']);
      expect(result).toEqual([null, null]);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['id1', 'id2'] },
          deletedAt: null,
        },
      });
    });
  });

  describe('update', () => {
    it('should return null for non-existent edge', async () => {
      prismaService.edge.update.mockResolvedValue(null);
      const result = await service.update('non-existent-id', {
        type: 'middle',
      });
      expect(result).toBeNull();
      expect(prismaService.edge.update).toHaveBeenCalledWith({
        where: { id: 'non-existent-id', deletedAt: null },
        data: { type: 'middle' },
      });
    });
  });

  describe('delete', () => {
    it('should return false for non-existent edge', async () => {
      prismaService.edge.update.mockRejectedValue(new Error('Edge not found'));
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('findByIn', () => {
    it('should return empty array for non-existent input node', async () => {
      prismaService.edge.findMany.mockResolvedValue([]);
      const result = await service.findByIn('non-existent-node');
      expect(result).toEqual([]);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: {
          inId: 'non-existent-node',
          deletedAt: null,
        },
      });
    });
  });

  describe('findByOut', () => {
    it('should return empty array for non-existent output node', async () => {
      prismaService.edge.findMany.mockResolvedValue([]);
      const result = await service.findByOut('non-existent-node');
      expect(result).toEqual([]);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: {
          outId: 'non-existent-node',
          deletedAt: null,
        },
      });
    });
  });

  describe('findByType', () => {
    it('should return empty array for each edge type', async () => {
      prismaService.edge.findMany.mockResolvedValue([]);

      const startResult = await service.findByType('start');
      expect(startResult).toEqual([]);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: {
          type: 'start',
          deletedAt: null,
        },
      });

      const middleResult = await service.findByType('middle');
      expect(middleResult).toEqual([]);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: {
          type: 'middle',
          deletedAt: null,
        },
      });

      const endResult = await service.findByType('end');
      expect(endResult).toEqual([]);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: {
          type: 'end',
          deletedAt: null,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return empty result with pagination', async () => {
      prismaService.edge.findMany.mockResolvedValue([]);
      prismaService.edge.count.mockResolvedValue(0);

      const result = await service.findAll();
      expect(result.edges).toEqual([]);
      expect(result.total).toBe(0);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(prismaService.edge.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it('should accept pagination options', async () => {
      prismaService.edge.findMany.mockResolvedValue([]);
      prismaService.edge.count.mockResolvedValue(0);

      const result = await service.findAll({
        limit: 10,
        offset: 5,
      });
      expect(result.edges).toEqual([]);
      expect(result.total).toBe(0);
      expect(prismaService.edge.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        take: 10,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      });
      expect(prismaService.edge.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });
  });

  describe('exists', () => {
    it('should return false for non-existent edge', async () => {
      prismaService.edge.findUnique.mockResolvedValue(null);
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
      expect(prismaService.edge.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id', deletedAt: null },
        select: { id: true },
      });
    });
  });
});
