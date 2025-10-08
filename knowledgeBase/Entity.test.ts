import { describe, expect, it, vi, beforeEach } from 'vitest';
import Entity from './Entity';
import { config } from 'dotenv';
import { EntityData, EntityDataWithId } from './knowledge.type';
import {
  AbstractEntityContentStorage,
  AbstractEntityGraphStorage,
  AbstractEntityVectorStorage,
} from './storage/abstract-storage';
import { ElasticsearchEntityContentStorage } from './storage/elasticsearch-entity-content-storage';
import EntityStorage from './storage/entityStorage';
config();

// Mock the BAML client to avoid native binding issues
vi.mock('baml_client', () => ({
  b: {
    Generate_plain_definition: vi.fn().mockResolvedValue({
      definition: 'Mocked definition for hypertension',
    }),
  },
}));

describe('Entity.create_entity_with_ai', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  const test_entity_data: EntityData = {
    name: ['Hypertension'],
    tags: ['disease'],
    definition:
      'Hypertension is the medical term for high blood pressure. It is a chronic condition where the force of blood pushing against the walls of your arteries is consistently too high.',
  };

  // Create a mock for AbstractEntityStorage
  const createMockEntityStorage = () => {
    // Mock the content storage
    const mockContentStorage = {
      create_new_entity_content: vi
        .fn()
        .mockImplementation((entity: EntityData, id: string) => {
          return Promise.resolve<EntityDataWithId>({
            ...entity,
            id,
          });
        }),
    };

    // Mock the graph storage
    const mockGraphStorage = {};

    // Mock the vector storage
    const mockVectorStorage = {};

    // Create a mock EntityStorage instance
    const mockStorage = new EntityStorage(
      mockContentStorage as unknown as AbstractEntityContentStorage,
      mockGraphStorage as unknown as AbstractEntityGraphStorage,
      mockVectorStorage as unknown as AbstractEntityVectorStorage,
    );

    return {
      mockStorage,
      mockContentStorage,
    };
  };

  it('create new entity with elastic and direct data input', async () => {
    const { mockStorage, mockContentStorage } = createMockEntityStorage();

    const creat_res =
      await Entity.create_entity_with_entity_data(test_entity_data).save(
        mockStorage,
      );

    // Verify that the create_new_entity_content method was called with the correct data
    expect(mockContentStorage.create_new_entity_content).toHaveBeenCalledWith(
      test_entity_data,
      expect.any(String), // The generated ID
    );

    // Verify the result has an ID property
    expect(creat_res).toHaveProperty('id');

    // Verify the result contains the original entity data
    expect(creat_res.get_definition()).toBe(test_entity_data.definition);
  }, 30000);

  it.skip('use real elasticsearch content storage to create&save entity', async () => {
    const storage = new EntityStorage(
      new ElasticsearchEntityContentStorage(
        process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
      ),
      {} as unknown as AbstractEntityGraphStorage,
      {} as unknown as AbstractEntityVectorStorage,
    );

    const creat_res =
      await Entity.create_entity_with_entity_data(test_entity_data).save(
        storage,
      );
  }, 30000);

  it('create new entity with mocked storage', async () => {
    const { mockStorage, mockContentStorage } = createMockEntityStorage();

    // Configure the mock to return a specific ID
    const mockId = 'test_entity_id_123';
    mockContentStorage.create_new_entity_content.mockResolvedValueOnce({
      ...test_entity_data,
      id: mockId,
    });

    const creat_res =
      await Entity.create_entity_with_entity_data(test_entity_data).save(
        mockStorage,
      );

    // Verify that the create_new_entity_content method was called
    expect(mockContentStorage.create_new_entity_content).toHaveBeenCalled();

    // Verify the result has the expected ID
    expect(creat_res.get_id()).toBe(mockId);

    // Verify the result contains the original entity data
    expect(creat_res.get_definition()).toBe(test_entity_data.definition);
  }, 30000);
});
