import { Test, TestingModule } from '@nestjs/testing';
import { EdgeStorageService } from './edge-storage.service';
import { EdgeData } from '../types';

describe('EdgeStorageService', () => {
  let service: EdgeStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EdgeStorageService],
    }).compile();

    service = module.get<EdgeStorageService>(EdgeStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an edge with generated ID', async () => {
      const edgeData: Omit<EdgeData, 'id'> = {
        type: 'start',
        in: 'node1',
        out: 'node2'
      };

      const result = await service.create(edgeData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.type).toEqual(edgeData.type);
      expect(result.in).toEqual(edgeData.in);
      expect(result.out).toEqual(edgeData.out);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent edge', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should return array of nulls for non-existent edges', async () => {
      const result = await service.findByIds(['id1', 'id2']);
      expect(result).toEqual([null, null]);
    });
  });

  describe('update', () => {
    it('should return null for non-existent edge', async () => {
      const result = await service.update('non-existent-id', {
        type: 'middle'
      });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return false for non-existent edge', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('findByIn', () => {
    it('should return empty array for non-existent input node', async () => {
      const result = await service.findByIn('non-existent-node');
      expect(result).toEqual([]);
    });
  });

  describe('findByOut', () => {
    it('should return empty array for non-existent output node', async () => {
      const result = await service.findByOut('non-existent-node');
      expect(result).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should return empty array for each edge type', async () => {
      const startResult = await service.findByType('start');
      expect(startResult).toEqual([]);

      const middleResult = await service.findByType('middle');
      expect(middleResult).toEqual([]);

      const endResult = await service.findByType('end');
      expect(endResult).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return empty result with pagination', async () => {
      const result = await service.findAll();
      expect(result.edges).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should accept pagination options', async () => {
      const result = await service.findAll({
        limit: 10,
        offset: 5
      });
      expect(result.edges).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent edge', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
