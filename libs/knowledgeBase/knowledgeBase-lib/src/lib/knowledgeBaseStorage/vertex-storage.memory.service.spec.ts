import { Test, TestingModule } from '@nestjs/testing';
import { VertexStorageMemoryService } from './vertex-storage.memory.service';
import { VertexData } from '../types';

describe('VertexStorageMemoryService', () => {
  let service: VertexStorageMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VertexStorageMemoryService],
    }).compile();

    service = module.get<VertexStorageMemoryService>(
      VertexStorageMemoryService,
    );
    service.clear(); // Clear any existing data before each test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new vertex with generated ID', async () => {
      const vertexData = {
        content: 'Test vertex content',
        type: 'concept' as const,
        metadata: { category: 'test' },
      };

      const result = await service.create(vertexData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toEqual(vertexData.content);
      expect(result.type).toEqual(vertexData.type);
      expect(result.metadata).toEqual(vertexData.metadata);
    });

    it('should generate unique IDs for different vertices', async () => {
      const vertexData1 = {
        content: 'Content 1',
        type: 'concept' as const,
      };
      const vertexData2 = {
        content: 'Content 2',
        type: 'attribute' as const,
      };

      const result1 = await service.create(vertexData1);
      const result2 = await service.create(vertexData2);

      expect(result1.id).not.toEqual(result2.id);
    });

    it('should create vertices with different types', async () => {
      const conceptVertex = await service.create({
        content: 'Concept',
        type: 'concept',
      });
      const attributeVertex = await service.create({
        content: 'Attribute',
        type: 'attribute',
      });
      const relationshipVertex = await service.create({
        content: 'Relationship',
        type: 'relationship',
      });

      expect(conceptVertex.type).toBe('concept');
      expect(attributeVertex.type).toBe('attribute');
      expect(relationshipVertex.type).toBe('relationship');
    });

    it('should create vertex without metadata', async () => {
      const vertexData = {
        content: 'Simple vertex',
        type: 'concept' as const,
      };

      const result = await service.create(vertexData);

      expect(result).toBeDefined();
      expect(result.content).toEqual(vertexData.content);
      expect(result.type).toEqual(vertexData.type);
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should return a vertex when found by ID', async () => {
      const vertexData = {
        content: 'Test vertex content',
        type: 'concept' as const,
        metadata: { category: 'test' },
      };
      const createdVertex = await service.create(vertexData);

      const result = await service.findById(createdVertex.id);

      expect(result).toEqual(createdVertex);
    });

    it('should return null when vertex is not found', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return a copy of vertex (not reference)', async () => {
      const vertexData = {
        content: 'Test vertex content',
        type: 'concept' as const,
      };
      const createdVertex = await service.create(vertexData);

      const result1 = await service.findById(createdVertex.id);
      const result2 = await service.findById(createdVertex.id);

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2); // Different object references
    });
  });

  describe('findByIds', () => {
    it('should return vertices for existing IDs', async () => {
      const vertexData1 = {
        content: 'Content 1',
        type: 'concept' as const,
      };
      const vertexData2 = {
        content: 'Content 2',
        type: 'attribute' as const,
      };
      const createdVertex1 = await service.create(vertexData1);
      const createdVertex2 = await service.create(vertexData2);

      const results = await service.findByIds([
        createdVertex1.id,
        createdVertex2.id,
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(createdVertex1);
      expect(results[1]).toEqual(createdVertex2);
    });

    it('should return null for non-existent IDs', async () => {
      const vertexData = {
        content: 'Content 1',
        type: 'concept' as const,
      };
      const createdVertex = await service.create(vertexData);

      const results = await service.findByIds([
        createdVertex.id,
        'non-existent-id',
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(createdVertex);
      expect(results[1]).toBeNull();
    });

    it('should handle empty array of IDs', async () => {
      const results = await service.findByIds([]);
      expect(results).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update an existing vertex', async () => {
      const vertexData = {
        content: 'Original content',
        type: 'concept' as const,
        metadata: { category: 'original' },
      };
      const createdVertex = await service.create(vertexData);

      const updates = {
        content: 'Updated content',
        type: 'attribute' as const,
        metadata: { category: 'updated' },
      };
      const result = await service.update(createdVertex.id, updates);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdVertex.id);
      expect(result!.content).toEqual(updates.content);
      expect(result!.type).toEqual(updates.type);
      expect(result!.metadata).toEqual(updates.metadata);
    });

    it('should return null when trying to update non-existent vertex', async () => {
      const updates = {
        content: 'Updated content',
      };
      const result = await service.update('non-existent-id', updates);
      expect(result).toBeNull();
    });

    it('should not allow updating ID', async () => {
      const vertexData = {
        content: 'Original content',
        type: 'concept' as const,
      };
      const createdVertex = await service.create(vertexData);

      const updates = {
        id: 'new-id' as string,
        content: 'Updated content',
      };
      const result = await service.update(createdVertex.id, updates);

      expect(result).toBeDefined();
      expect(result!.id).toEqual(createdVertex.id); // ID should not change
      expect(result!.content).toEqual(updates.content);
    });
  });

  describe('delete', () => {
    it('should delete an existing vertex', async () => {
      const vertexData = {
        content: 'Test content',
        type: 'concept' as const,
      };
      const createdVertex = await service.create(vertexData);

      const deleteResult = await service.delete(createdVertex.id);
      expect(deleteResult).toBe(true);

      const findResult = await service.findById(createdVertex.id);
      expect(findResult).toBeNull();
    });

    it('should return false when trying to delete non-existent vertex', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('findByType', () => {
    it('should return vertices of specified type', async () => {
      const conceptVertex1 = await service.create({
        content: 'Concept 1',
        type: 'concept',
      });
      const conceptVertex2 = await service.create({
        content: 'Concept 2',
        type: 'concept',
      });
      const attributeVertex = await service.create({
        content: 'Attribute',
        type: 'attribute',
      });
      const relationshipVertex = await service.create({
        content: 'Relationship',
        type: 'relationship',
      });

      const conceptResults = await service.findByType('concept');
      expect(conceptResults).toHaveLength(2);
      expect(conceptResults).toContainEqual(conceptVertex1);
      expect(conceptResults).toContainEqual(conceptVertex2);

      const attributeResults = await service.findByType('attribute');
      expect(attributeResults).toHaveLength(1);
      expect(attributeResults).toContainEqual(attributeVertex);

      const relationshipResults = await service.findByType('relationship');
      expect(relationshipResults).toHaveLength(1);
      expect(relationshipResults).toContainEqual(relationshipVertex);
    });

    it('should return empty array for non-existent type', async () => {
      await service.create({ content: 'Concept', type: 'concept' });

      const results = await service.findByType('attribute');
      expect(results).toEqual([]);
    });
  });

  describe('search', () => {
    it('should return vertices matching search query', async () => {
      const vertex1 = await service.create({
        content: 'JavaScript programming',
        type: 'concept',
      });
      const vertex2 = await service.create({
        content: 'Python programming',
        type: 'concept',
      });
      const vertex3 = await service.create({
        content: 'Database design',
        type: 'concept',
      });

      const results = await service.search('programming');

      expect(results).toHaveLength(2);
      expect(results).toContainEqual(vertex1);
      expect(results).toContainEqual(vertex2);
      expect(results).not.toContainEqual(vertex3);
    });

    it('should be case insensitive', async () => {
      const vertex1 = await service.create({
        content: 'JavaScript',
        type: 'concept',
      });
      const vertex2 = await service.create({
        content: 'javascript',
        type: 'concept',
      });

      const results1 = await service.search('JavaScript');
      const results2 = await service.search('javascript');

      expect(results1).toHaveLength(2);
      expect(results2).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      await service.create({ content: 'Item 1', type: 'concept' });
      await service.create({ content: 'Item 2', type: 'concept' });
      await service.create({ content: 'Item 3', type: 'concept' });

      const results = await service.search('Item', { limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should respect offset parameter', async () => {
      const vertex1 = await service.create({
        content: 'First item',
        type: 'concept',
      });
      const vertex2 = await service.create({
        content: 'Second item',
        type: 'concept',
      });
      const vertex3 = await service.create({
        content: 'Third item',
        type: 'concept',
      });

      const results = await service.search('item', { offset: 1 });
      expect(results).toHaveLength(2);
      expect(results).not.toContainEqual(vertex1);
      expect(results).toContainEqual(vertex2);
      expect(results).toContainEqual(vertex3);
    });

    it('should return empty array for non-matching query', async () => {
      await service.create({ content: 'JavaScript', type: 'concept' });

      const results = await service.search('nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return all vertices with pagination', async () => {
      const vertex1 = await service.create({
        content: 'Content 1',
        type: 'concept',
      });
      const vertex2 = await service.create({
        content: 'Content 2',
        type: 'attribute',
      });
      const vertex3 = await service.create({
        content: 'Content 3',
        type: 'relationship',
      });

      const result = await service.findAll();
      expect(result.vertices).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.vertices).toContainEqual(vertex1);
      expect(result.vertices).toContainEqual(vertex2);
      expect(result.vertices).toContainEqual(vertex3);
    });

    it('should respect limit parameter', async () => {
      await service.create({ content: 'Content 1', type: 'concept' });
      await service.create({ content: 'Content 2', type: 'concept' });
      await service.create({ content: 'Content 3', type: 'concept' });

      const result = await service.findAll({ limit: 2 });
      expect(result.vertices).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('should respect offset parameter', async () => {
      const vertex1 = await service.create({
        content: 'Content 1',
        type: 'concept',
      });
      const vertex2 = await service.create({
        content: 'Content 2',
        type: 'concept',
      });
      const vertex3 = await service.create({
        content: 'Content 3',
        type: 'concept',
      });

      const result = await service.findAll({ offset: 1 });
      expect(result.vertices).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.vertices).not.toContainEqual(vertex1);
      expect(result.vertices).toContainEqual(vertex2);
      expect(result.vertices).toContainEqual(vertex3);
    });

    it('should respect both limit and offset parameters', async () => {
      await service.create({ content: 'Content 1', type: 'concept' });
      const vertex2 = await service.create({
        content: 'Content 2',
        type: 'concept',
      });
      const vertex3 = await service.create({
        content: 'Content 3',
        type: 'concept',
      });
      await service.create({ content: 'Content 4', type: 'concept' });

      const result = await service.findAll({ offset: 1, limit: 2 });
      expect(result.vertices).toHaveLength(2);
      expect(result.total).toBe(4);
      expect(result.vertices).toContainEqual(vertex2);
      expect(result.vertices).toContainEqual(vertex3);
    });

    it('should return empty result when no vertices exist', async () => {
      const result = await service.findAll();
      expect(result.vertices).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing vertex', async () => {
      const vertexData = {
        content: 'Test content',
        type: 'concept' as const,
      };
      const createdVertex = await service.create(vertexData);

      const result = await service.exists(createdVertex.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent vertex', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all vertices', async () => {
      await service.create({ content: 'Content 1', type: 'concept' });
      await service.create({ content: 'Content 2', type: 'attribute' });

      expect(await service.count()).toBe(2);

      service.clear();

      expect(await service.count()).toBe(0);
      const findResult = await service.findById('any-id');
      expect(findResult).toBeNull();
    });
  });

  describe('count', () => {
    it('should return the correct count of vertices', async () => {
      expect(await service.count()).toBe(0);

      await service.create({ content: 'Content 1', type: 'concept' });
      expect(await service.count()).toBe(1);

      await service.create({ content: 'Content 2', type: 'attribute' });
      expect(await service.count()).toBe(2);

      await service.delete('any-id');
      expect(await service.count()).toBe(2); // No change since ID doesn't exist

      const createdVertex = await service.create({
        content: 'Content 3',
        type: 'relationship',
      });
      await service.delete(createdVertex.id);
      expect(await service.count()).toBe(2); // One vertex deleted
    });
  });
});
