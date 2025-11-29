import { Test, TestingModule } from '@nestjs/testing';
import { EntityStorageMemoryService } from './entity-storage.memory.service';
import { EntityData } from '../types';

describe('EntityStorageMemoryService', () => {
  let service: EntityStorageMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityStorageMemoryService],
    }).compile();

    service = module.get<EntityStorageMemoryService>(EntityStorageMemoryService);
    service.clear(); // Start with clean state
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const createTestEntity = (overrides?: Partial<EntityData>): Omit<EntityData, 'id'> => ({
    nomanclature: [
      {
        name: 'Test Entity',
        acronym: 'TE',
        language: 'en'
      }
    ],
    abstract: {
      description: 'This is a test entity for testing purposes',
      embedding: {
        config: {
          model: 'test-model',
          dimensions: 3
        } as any,
        vector: [0.1, 0.2, 0.3]
      }
    },
    ...overrides
  });

  describe('create', () => {
    it('should create an entity with generated ID', async () => {
      const entityData = createTestEntity();
      const result = await service.create(entityData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.nomanclature).toEqual(entityData.nomanclature);
      expect(result.abstract).toEqual(entityData.abstract);
    });

    it('should increment entity count', async () => {
      expect(service.count()).toBe(0);
      
      await service.create(createTestEntity());
      expect(service.count()).toBe(1);
      
      await service.create(createTestEntity());
      expect(service.count()).toBe(2);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent entity', async () => {
      const result = await service.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return entity for existing ID', async () => {
      const created = await service.create(createTestEntity());
      const found = await service.findById(created.id);
      
      expect(found).toEqual(created);
      expect(found?.id).toBe(created.id);
    });
  });

  describe('findByIds', () => {
    it('should return array of nulls for non-existent entities', async () => {
      const result = await service.findByIds(['id1', 'id2']);
      expect(result).toEqual([null, null]);
    });

    it('should return mixed results for existing and non-existing IDs', async () => {
      const created = await service.create(createTestEntity());
      const result = await service.findByIds([created.id, 'non-existent']);
      
      expect(result[0]).toEqual(created);
      expect(result[1]).toBeNull();
    });
  });

  describe('update', () => {
    it('should return null for non-existent entity', async () => {
      const result = await service.update('non-existent-id', {
        nomanclature: [{ name: 'Updated', acronym: null, language: 'en' }]
      });
      expect(result).toBeNull();
    });

    it('should update existing entity', async () => {
      const created = await service.create(createTestEntity());
      const updates = {
        nomanclature: [{ name: 'Updated Entity', acronym: 'UE', language: 'en' as const }]
      };
      
      const updated = await service.update(created.id, updates);
      
      expect(updated).toBeDefined();
      expect(updated?.id).toBe(created.id);
      expect(updated?.nomanclature).toEqual(updates.nomanclature);
      expect(updated?.abstract).toEqual(created.abstract); // Should remain unchanged
    });
  });

  describe('delete', () => {
    it('should return false for non-existent entity', async () => {
      const result = await service.delete('non-existent-id');
      expect(result).toBe(false);
    });

    it('should delete existing entity', async () => {
      const created = await service.create(createTestEntity());
      expect(service.count()).toBe(1);
      
      const deleted = await service.delete(created.id);
      
      expect(deleted).toBe(true);
      expect(service.count()).toBe(0);
      expect(await service.findById(created.id)).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test entities for search
      await service.create(createTestEntity({
        nomanclature: [{ name: 'Machine Learning', acronym: 'ML', language: 'en' as const }],
        abstract: { description: 'Study of computer algorithms that improve automatically', embedding: { config: {} as any, vector: [1, 0, 0] } }
      }));
      
      await service.create(createTestEntity({
        nomanclature: [{ name: 'Deep Learning', acronym: 'DL', language: 'en' as const }],
        abstract: { description: 'Subset of machine learning using neural networks', embedding: { config: {} as any, vector: [0, 1, 0] } }
      }));
      
      await service.create(createTestEntity({
        nomanclature: [{ name: '机器学习', acronym: null, language: 'zh' as const }],
        abstract: { description: '计算机算法的自动改进研究', embedding: { config: {} as any, vector: [0, 0, 1] } }
      }));
    });

    it('should find entities by name', async () => {
      const results = await service.search('Machine');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.nomanclature[0].name === 'Machine Learning')).toBe(true);
    });

    it('should find entities by acronym', async () => {
      const results = await service.search('DL');
      expect(results).toHaveLength(1);
      expect(results[0].nomanclature[0].name).toBe('Deep Learning');
    });

    it('should find entities by description', async () => {
      const results = await service.search('neural');
      expect(results).toHaveLength(1);
      expect(results[0].nomanclature[0].name).toBe('Deep Learning');
    });

    it('should filter by language', async () => {
      const results = await service.search('学习', { language: 'zh' as const });
      expect(results).toHaveLength(1);
      expect(results[0].nomanclature[0].language).toBe('zh');
    });

    it('should apply pagination', async () => {
      const results = await service.search('Learning', { limit: 1, offset: 1 });
      expect(results).toHaveLength(1);
    });
  });

  describe('findBySimilarity', () => {
    beforeEach(async () => {
      await service.create(createTestEntity({
        nomanclature: [{ name: 'Similar 1', acronym: null, language: 'en' as const }],
        abstract: { description: 'First similar entity', embedding: { config: {} as any, vector: [1, 0, 0] } }
      }));
      
      await service.create(createTestEntity({
        nomanclature: [{ name: 'Similar 2', acronym: null, language: 'en' as const }],
        abstract: { description: 'Second similar entity', embedding: { config: {} as any, vector: [0.9, 0.1, 0] } }
      }));
      
      await service.create(createTestEntity({
        nomanclature: [{ name: 'Different', acronym: null, language: 'en' as const }],
        abstract: { description: 'Different entity', embedding: { config: {} as any, vector: [0, 0, 1] } }
      }));
    });

    it('should find similar entities', async () => {
      const queryVector = [1, 0, 0];
      const results = await service.findBySimilarity(queryVector);
      
      expect(results).toHaveLength(2); // Only entities above default threshold (0.5)
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      expect(results[0].entity.nomanclature[0].name).toBe('Similar 1');
    });

    it('should respect threshold', async () => {
      const queryVector = [1, 0, 0];
      const results = await service.findBySimilarity(queryVector, { threshold: 0.95 });
      
      expect(results.length).toBeGreaterThanOrEqual(1); // At least the most similar entity
      expect(results[0].entity.nomanclature[0].name).toBe('Similar 1');
      expect(results[0].similarity).toBeGreaterThanOrEqual(0.95);
    });

    it('should respect limit', async () => {
      const queryVector = [1, 0, 0];
      const results = await service.findBySimilarity(queryVector, { limit: 1 });
      
      expect(results).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await service.create(createTestEntity({
          nomanclature: [{ name: `Entity ${i}`, acronym: null, language: 'en' as const }],
          abstract: { description: `Description ${i}`, embedding: { config: {} as any, vector: [i, 0, 0] } }
        }));
      }
    });

    it('should return all entities with pagination', async () => {
      const result = await service.findAll();
      expect(result.entities).toHaveLength(5);
      expect(result.total).toBe(5);
    });

    it('should apply pagination', async () => {
      const result = await service.findAll({ limit: 2, offset: 1 });
      expect(result.entities).toHaveLength(2);
      expect(result.total).toBe(5);
    });
  });

  describe('exists', () => {
    it('should return false for non-existent entity', async () => {
      const result = await service.exists('non-existent-id');
      expect(result).toBe(false);
    });

    it('should return true for existing entity', async () => {
      const created = await service.create(createTestEntity());
      const result = await service.exists(created.id);
      expect(result).toBe(true);
    });
  });
});