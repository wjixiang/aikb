import { Test, TestingModule } from '@nestjs/testing';
import { VertextStorageService } from './vertext-storage.service';
import { VertexData } from '../types';

describe('VertextStorageService', () => {
  let service: VertextStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VertextStorageService],
    }).compile();

    service = module.get<VertextStorageService>(VertextStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a vertex with generated ID', async () => {
      const vertexData = {
        content: 'Test vertex content',
        type: 'concept' as const,
        metadata: { category: 'test' }
      };

      const result = await service.create(vertexData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toEqual(vertexData.content);
      expect(result.type).toEqual(vertexData.type);
      expect(result.metadata).toEqual(vertexData.metadata);
    });

    it('should create vertices with different types', async () => {
      const conceptVertex = await service.create({ content: 'Concept', type: 'concept' });
      const attributeVertex = await service.create({ content: 'Attribute', type: 'attribute' });
      const relationshipVertex = await service.create({ content: 'Relationship', type: 'relationship' });

      expect(conceptVertex.type).toBe('concept');
      expect(attributeVertex.type).toBe('attribute');
      expect(relationshipVertex.type).toBe('relationship');
    });
  });

  describe('findById', () => {
    it('should return null for non-existent vertex', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should return array of nulls for non-existent vertices', async () => {
      const result = await service.findByIds(['id1', 'id2']);
      expect(result).toEqual([null, null]);
    });

    it('should handle empty array of IDs', async () => {
      const result = await service.findByIds([]);
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should return null for non-existent vertex', async () => {
      const result = await service.update('non-existent-id', {
        content: 'Updated content'
      });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return false for non-existent vertex', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('findByType', () => {
    it('should return empty array for each vertex type', async () => {
      const conceptResult = await service.findByType('concept');
      expect(conceptResult).toEqual([]);

      const attributeResult = await service.findByType('attribute');
      expect(attributeResult).toEqual([]);

      const relationshipResult = await service.findByType('relationship');
      expect(relationshipResult).toEqual([]);
    });
  });

  describe('search', () => {
    it('should return empty array for search query', async () => {
      const result = await service.search('test query');
      expect(result).toEqual([]);
    });

    it('should accept search options', async () => {
      const result = await service.search('test query', {
        limit: 10,
        offset: 0
      });
      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return empty result with pagination', async () => {
      const result = await service.findAll();
      expect(result.vertices).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should accept pagination options', async () => {
      const result = await service.findAll({
        limit: 10,
        offset: 5
      });
      expect(result.vertices).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent vertex', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
