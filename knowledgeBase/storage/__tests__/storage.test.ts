import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KBStorage, StorageConfig } from '../storage';
import { AbstractEntityStorage, AbstractKnowledgeStorage } from '../abstract-storage';
import { EntityData, EntityDataWithId, KnowledgeData, KnowledgeDataWithId } from '../../knowledge.type';
import Knowledge from '../../Knowledge';

// Mock the logger
vi.mock('../../lib/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

// Create mock implementations for the abstract classes
class MockEntityStorage extends AbstractEntityStorage {
  entityContentStorage = {
    create_new_entity_content: vi.fn(),
    get_entity_by_name: vi.fn(),
    get_entity_by_id: vi.fn(),
    update_entity: vi.fn(),
    delete_entity_by_id: vi.fn(),
    search_entities: vi.fn(),
    list_all_entities: vi.fn(),
  };
  
  entityGraphStorage = {
    create_relation: vi.fn(),
    get_entity_relations: vi.fn(),
    update_relation: vi.fn(),
    delete_relation: vi.fn(),
    find_paths: vi.fn(),
  };
  
  entityVectorStorage = {
    store_vector: vi.fn(),
    get_vector: vi.fn(),
    update_vector: vi.fn(),
    delete_vector: vi.fn(),
    find_similar_vectors: vi.fn(),
    batch_store_vectors: vi.fn(),
  };
  
  async create_new_entity(entity: EntityData): Promise<EntityDataWithId> {
    const id = AbstractEntityStorage.generate_entity_id();
    return { ...entity, id };
  }
}

class MockKnowledgeStorage extends AbstractKnowledgeStorage {
  knowledgeContentStorage = {
    create_new_knowledge_content: vi.fn(),
    get_knowledge_content_by_id: vi.fn(),
  };
  
  knowledgeGraphStorage = {
    create_new_link: vi.fn(),
  };
  
  knowledgeVectorStorage = {
    store_knowledge_vector: vi.fn(),
    get_knowledge_vector: vi.fn(),
    update_knowledge_vector: vi.fn(),
    delete_knowledge_vector: vi.fn(),
    find_similar_knowledge_vectors: vi.fn(),
    batch_store_knowledge_vectors: vi.fn(),
  };
  
  async create_new_knowledge(knowledge: KnowledgeData, sourceId: string): Promise<KnowledgeDataWithId> {
    const id = AbstractKnowledgeStorage.generate_knowledge_id();
    return { ...knowledge, id };
  }
  
  async create_knowledge_instance(knowledgeData: KnowledgeDataWithId, childKnowledge?: Knowledge[]): Promise<Knowledge> {
    return new Knowledge(knowledgeData.id, knowledgeData.scope, knowledgeData.content, childKnowledge || []);
  }
  
  async resolve_child_knowledge(childKnowledgeIds: string[]): Promise<Knowledge[]> {
    return [];
  }
  
  async get_knowledge_by_id(knowledgeId: string): Promise<Knowledge | null> {
    return null;
  }
  
  async process_knowledge_with_children(knowledgeData: KnowledgeDataWithId): Promise<Knowledge> {
    return new Knowledge(knowledgeData.id, knowledgeData.scope, knowledgeData.content, []);
  }
}

describe('KBStorage', () => {
  let mockEntityStorage: MockEntityStorage;
  let mockKnowledgeStorage: MockKnowledgeStorage;
  let kbStorage: KBStorage;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntityStorage = new MockEntityStorage();
    mockKnowledgeStorage = new MockKnowledgeStorage();
    kbStorage = new KBStorage(mockEntityStorage, mockKnowledgeStorage);
  });
  
  describe('constructor', () => {
    it('should create a KBStorage instance with entityStorage and knowledgeStorage', () => {
      // Assert
      expect(kbStorage).toBeInstanceOf(KBStorage);
      expect(kbStorage.entityStorage).toBe(mockEntityStorage);
      expect(kbStorage.knowledgeStorage).toBe(mockKnowledgeStorage);
    });
    
    it('should store the provided storage instances as public properties', () => {
      // Assert
      expect(kbStorage.entityStorage).toBeDefined();
      expect(kbStorage.knowledgeStorage).toBeDefined();
    });
  });
});

describe('KBStorage Methods', () => {
  let mockEntityStorage: MockEntityStorage;
  let mockKnowledgeStorage: MockKnowledgeStorage;
  let kbStorage: KBStorage;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntityStorage = new MockEntityStorage();
    mockKnowledgeStorage = new MockKnowledgeStorage();
    kbStorage = new KBStorage(mockEntityStorage, mockKnowledgeStorage);
  });
  
  describe('storeEntity', () => {
    it('should store an entity successfully', async () => {
      // Arrange
      const mockEntity: EntityData = {
        name: ['test', 'entity'],
        tags: ['test'],
        definition: 'A test entity',
      };
      const expectedEntityWithId: EntityDataWithId = {
        ...mockEntity,
        id: 'entity_123',
      };
      mockEntityStorage.create_new_entity = vi.fn().mockResolvedValue(expectedEntityWithId);
      
      // Act
      const result = await kbStorage.storeEntity(mockEntity);
      
      // Assert
      expect(result).toEqual(expectedEntityWithId);
      expect(mockEntityStorage.create_new_entity).toHaveBeenCalledWith(mockEntity);
    });
  });
  
  describe('storeKnowledge', () => {
    it('should store knowledge successfully', async () => {
      // Arrange
      const mockKnowledge: KnowledgeData = {
        scope: 'test scope',
        content: 'test content',
        childKnowledgeId: [],
      };
      const sourceId = 'entity_123';
      const expectedKnowledgeWithId: KnowledgeDataWithId = {
        ...mockKnowledge,
        id: 'knowledge_456',
      };
      mockKnowledgeStorage.create_new_knowledge = vi.fn().mockResolvedValue(expectedKnowledgeWithId);
      
      // Act
      const result = await kbStorage.storeKnowledge(mockKnowledge, sourceId);
      
      // Assert
      expect(result).toEqual(expectedKnowledgeWithId);
      expect(mockKnowledgeStorage.create_new_knowledge).toHaveBeenCalledWith(mockKnowledge, sourceId);
    });
  });
  
  describe('getKnowledge', () => {
    it('should retrieve knowledge by ID', async () => {
      // Arrange
      const knowledgeId = 'knowledge_456';
      const mockKnowledge = new Knowledge('knowledge_456', 'test scope', 'test content', []);
      mockKnowledgeStorage.get_knowledge_by_id = vi.fn().mockResolvedValue(mockKnowledge);
      
      // Act
      const result = await kbStorage.getKnowledge(knowledgeId);
      
      // Assert
      expect(result).toEqual(mockKnowledge);
      expect(mockKnowledgeStorage.get_knowledge_by_id).toHaveBeenCalledWith(knowledgeId);
    });
    
    it('should return null if knowledge is not found', async () => {
      // Arrange
      const knowledgeId = 'nonexistent_knowledge';
      mockKnowledgeStorage.get_knowledge_by_id = vi.fn().mockResolvedValue(null);
      
      // Act
      const result = await kbStorage.getKnowledge(knowledgeId);
      
      // Assert
      expect(result).toBeNull();
      expect(mockKnowledgeStorage.get_knowledge_by_id).toHaveBeenCalledWith(knowledgeId);
    });
  });
  
  describe('initialize', () => {
    it('should initialize without errors', async () => {
      // Arrange
      const config: StorageConfig = {};
      
      // Act & Assert
      await expect(kbStorage.initialize(config)).resolves.not.toThrow();
    });
    
    it('should initialize with custom config', async () => {
      // Arrange
      const config: StorageConfig = { /* custom config options */ };
      
      // Act & Assert
      await expect(kbStorage.initialize(config)).resolves.not.toThrow();
    });
  });
  
  describe('getStorageStats', () => {
    it('should return storage statistics', async () => {
      // Act
      const stats = await kbStorage.getStorageStats();
      
      // Assert
      expect(stats).toEqual({
        entityCount: 0,
        knowledgeCount: 0,
      });
      expect(typeof stats.entityCount).toBe('number');
      expect(typeof stats.knowledgeCount).toBe('number');
    });
  });
});

describe('StorageConfig', () => {
  it('should be a valid interface', () => {
    // This test just verifies that the interface exists and can be used
    const config: StorageConfig = {};
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });
});