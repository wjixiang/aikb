import { Test, TestingModule } from '@nestjs/testing';
import { EntityStorageService } from './entity-storage.service';
import { EntityData } from '../types';

describe('EntityStorageService', () => {
  let service: EntityStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityStorageService],
    }).compile();

    service = module.get<EntityStorageService>(EntityStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an entity with generated ID', async () => {
      const entityData: Omit<EntityData, 'id'> = {
        nomanclature: [
          {
            name: 'Test Entity',
            acronym: 'TE',
            language: 'en',
          },
        ],
        abstract: {
          description: 'Test description',
          embedding: {
            config: {
              model: 'test-model',
              dimensions: 128,
            } as any,
            vector: new Array(128).fill(0.1),
          },
        },
      };

      const result = await service.create(entityData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.nomanclature).toEqual(entityData.nomanclature);
      expect(result.abstract).toEqual(entityData.abstract);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent entity', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByIds', () => {
    it('should return array of nulls for non-existent entities', async () => {
      const result = await service.findByIds(['id1', 'id2']);
      expect(result).toEqual([null, null]);
    });
  });

  describe('update', () => {
    it('should return null for non-existent entity', async () => {
      const result = await service.update('non-existent-id', {
        nomanclature: [{ name: 'Updated', acronym: null, language: 'en' }],
      });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return false for non-existent entity', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
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
        offset: 0,
        language: 'en',
      });
      expect(result).toEqual([]);
    });
  });

  describe('findBySimilarity', () => {
    it('should return empty array for similarity search', async () => {
      const vector = new Array(128).fill(0.1);
      const result = await service.findBySimilarity(vector);
      expect(result).toEqual([]);
    });

    it('should accept similarity search options', async () => {
      const vector = new Array(128).fill(0.1);
      const result = await service.findBySimilarity(vector, {
        limit: 5,
        threshold: 0.8,
      });
      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should return empty result with pagination', async () => {
      const result = await service.findAll();
      expect(result.entities).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should accept pagination options', async () => {
      const result = await service.findAll({
        limit: 10,
        offset: 5,
      });
      expect(result.entities).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent entity', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
