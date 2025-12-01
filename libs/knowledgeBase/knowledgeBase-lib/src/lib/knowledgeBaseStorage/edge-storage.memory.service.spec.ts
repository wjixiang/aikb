import { Test, TestingModule } from '@nestjs/testing';
import { EdgeStorageMemoryService } from './edge-storage.memory.service';
import { EdgeData } from '../types';

describe('EdgeStorageMemoryService', () => {
  let service: EdgeStorageMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EdgeStorageMemoryService],
    }).compile();

    service = module.get<EdgeStorageMemoryService>(EdgeStorageMemoryService);
    service.clear(); // Clear any existing data before each test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new edge with generated ID', async () => {
      const edgeData = {
        type: 'start' as const,
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

    it('should generate unique IDs for different edges', async () => {
      const edgeData1 = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const edgeData2 = {
        type: 'middle' as const,
        in: 'node2',
        out: 'node3'
      };

      const result1 = await service.create(edgeData1);
      const result2 = await service.create(edgeData2);

      expect(result1.id).not.toEqual(result2.id);
    });

    it('should create edges with different types', async () => {
      const startEdge = await service.create({ type: 'start', in: 'a', out: 'b' });
      const middleEdge = await service.create({ type: 'middle', in: 'b', out: 'c' });
      const endEdge = await service.create({ type: 'end', in: 'c', out: 'd' });

      expect(startEdge.type).toBe('start');
      expect(middleEdge.type).toBe('middle');
      expect(endEdge.type).toBe('end');
    });
  });

  describe('findById', () => {
    it('should return an edge when found by ID', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const result = await service.findById(createdEdge.id);

      expect(result).toEqual(createdEdge);
    });

    it('should return null when edge is not found', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return a copy of the edge (not the reference)', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const result1 = await service.findById(createdEdge.id);
      const result2 = await service.findById(createdEdge.id);

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2); // Different object references
    });
  });

  describe('findByIds', () => {
    it('should return edges for existing IDs', async () => {
      const edgeData1 = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const edgeData2 = {
        type: 'middle' as const,
        in: 'node2',
        out: 'node3'
      };
      const createdEdge1 = await service.create(edgeData1);
      const createdEdge2 = await service.create(edgeData2);

      const results = await service.findByIds([createdEdge1.id, createdEdge2.id]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(createdEdge1);
      expect(results[1]).toEqual(createdEdge2);
    });

    it('should return null for non-existent IDs', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const results = await service.findByIds([createdEdge.id, 'non-existent-id']);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(createdEdge);
      expect(results[1]).toBeNull();
    });

    it('should handle empty array of IDs', async () => {
      const results = await service.findByIds([]);
      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update an existing edge', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const updates = {
        type: 'middle' as const,
        out: 'node3'
      };
      const result = await service.update(createdEdge.id, updates);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdEdge.id);
      expect(result!.type).toEqual(updates.type);
      expect(result!.in).toEqual(createdEdge.in); // Should remain unchanged
      expect(result!.out).toEqual(updates.out);
    });

    it('should return null when trying to update non-existent edge', async () => {
      const updates = {
        type: 'middle' as const
      };
      const result = await service.update('non-existent-id', updates);
      expect(result).toBeNull();
    });

    it('should not allow updating the ID', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const updates = {
        id: 'new-id' as string,
        type: 'middle' as const
      };
      const result = await service.update(createdEdge.id, updates);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdEdge.id); // ID should not change
      expect(result!.type).toEqual(updates.type);
    });
  });

  describe('delete', () => {
    it('should delete an existing edge', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const deleteResult = await service.delete(createdEdge.id);
      expect(deleteResult).toBe(true);

      const findResult = await service.findById(createdEdge.id);
      expect(findResult).toBeNull();
    });

    it('should return false when trying to delete non-existent edge', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('findByIn', () => {
    it('should return edges with matching input node', async () => {
      const edge1 = await service.create({ type: 'start', in: 'nodeA', out: 'nodeB' });
      const edge2 = await service.create({ type: 'middle', in: 'nodeA', out: 'nodeC' });
      const edge3 = await service.create({ type: 'end', in: 'nodeB', out: 'nodeD' });

      const results = await service.findByIn('nodeA');

      expect(results).toHaveLength(2);
      expect(results).toContainEqual(edge1);
      expect(results).toContainEqual(edge2);
      expect(results).not.toContainEqual(edge3);
    });

    it('should return empty array for non-existent input node', async () => {
      const results = await service.findByIn('non-existent-node');
      expect(results).toEqual([]);
    });
  });

  describe('findByOut', () => {
    it('should return edges with matching output node', async () => {
      const edge1 = await service.create({ type: 'start', in: 'nodeA', out: 'nodeB' });
      const edge2 = await service.create({ type: 'middle', in: 'nodeC', out: 'nodeB' });
      const edge3 = await service.create({ type: 'end', in: 'nodeD', out: 'nodeE' });

      const results = await service.findByOut('nodeB');

      expect(results).toHaveLength(2);
      expect(results).toContainEqual(edge1);
      expect(results).toContainEqual(edge2);
      expect(results).not.toContainEqual(edge3);
    });

    it('should return empty array for non-existent output node', async () => {
      const results = await service.findByOut('non-existent-node');
      expect(results).toEqual([]);
    });
  });

  describe('findByType', () => {
    it('should return edges of specified type', async () => {
      const startEdge1 = await service.create({ type: 'start', in: 'a', out: 'b' });
      const startEdge2 = await service.create({ type: 'start', in: 'c', out: 'd' });
      const middleEdge = await service.create({ type: 'middle', in: 'e', out: 'f' });
      const endEdge = await service.create({ type: 'end', in: 'g', out: 'h' });

      const startResults = await service.findByType('start');
      expect(startResults).toHaveLength(2);
      expect(startResults).toContainEqual(startEdge1);
      expect(startResults).toContainEqual(startEdge2);

      const middleResults = await service.findByType('middle');
      expect(middleResults).toHaveLength(1);
      expect(middleResults).toContainEqual(middleEdge);

      const endResults = await service.findByType('end');
      expect(endResults).toHaveLength(1);
      expect(endResults).toContainEqual(endEdge);
    });
  });

  describe('findAll', () => {
    it('should return all edges with pagination', async () => {
      const edge1 = await service.create({ type: 'start', in: 'a', out: 'b' });
      const edge2 = await service.create({ type: 'middle', in: 'c', out: 'd' });
      const edge3 = await service.create({ type: 'end', in: 'e', out: 'f' });

      const result = await service.findAll();
      expect(result.edges).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.edges).toContainEqual(edge1);
      expect(result.edges).toContainEqual(edge2);
      expect(result.edges).toContainEqual(edge3);
    });

    it('should respect limit parameter', async () => {
      await service.create({ type: 'start', in: 'a', out: 'b' });
      await service.create({ type: 'middle', in: 'c', out: 'd' });
      await service.create({ type: 'end', in: 'e', out: 'f' });

      const result = await service.findAll({ limit: 2 });
      expect(result.edges).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should respect offset parameter', async () => {
      const edge1 = await service.create({ type: 'start', in: 'a', out: 'b' });
      const edge2 = await service.create({ type: 'middle', in: 'c', out: 'd' });
      const edge3 = await service.create({ type: 'end', in: 'e', out: 'f' });

      const result = await service.findAll({ offset: 1 });
      expect(result.edges).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.edges).not.toContainEqual(edge1);
      expect(result.edges).toContainEqual(edge2);
      expect(result.edges).toContainEqual(edge3);
    });

    it('should respect both limit and offset parameters', async () => {
      await service.create({ type: 'start', in: 'a', out: 'b' });
      const edge2 = await service.create({ type: 'middle', in: 'c', out: 'd' });
      const edge3 = await service.create({ type: 'end', in: 'e', out: 'f' });
      await service.create({ type: 'start', in: 'g', out: 'h' });

      const result = await service.findAll({ offset: 1, limit: 2 });
      expect(result.edges).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.edges).toContainEqual(edge2);
      expect(result.edges).toContainEqual(edge3);
    });

    it('should return empty result when no edges exist', async () => {
      const result = await service.findAll();
      expect(result.edges).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing edge', async () => {
      const edgeData = {
        type: 'start' as const,
        in: 'node1',
        out: 'node2'
      };
      const createdEdge = await service.create(edgeData);

      const result = await service.exists(createdEdge.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent edge', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all edges', async () => {
      await service.create({ type: 'start', in: 'a', out: 'b' });
      await service.create({ type: 'middle', in: 'c', out: 'd' });

      expect(await service.count()).toBe(2);

      service.clear();

      expect(await service.count()).toBe(0);
      const findResult = await service.findById('any-id');
      expect(findResult).toBeNull();
    });
  });

  describe('count', () => {
    it('should return the correct count of edges', async () => {
      expect(await service.count()).toBe(0);

      await service.create({ type: 'start', in: 'a', out: 'b' });
      expect(await service.count()).toBe(1);

      await service.create({ type: 'middle', in: 'c', out: 'd' });
      expect(await service.count()).toBe(2);

      await service.delete('any-id');
      expect(await service.count()).toBe(2); // No change since ID doesn't exist

      const createdEdge = await service.create({ type: 'end', in: 'e', out: 'f' });
      await service.delete(createdEdge.id);
      expect(await service.count()).toBe(2); // One edge deleted
    });
  });
});
