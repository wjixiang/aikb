import { MongodbKnowledgeContentStorage } from '../mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../mongodb-knowledge-graph-storage';
import KnowledgeStorage from '../knowledgeStorage';
import Knowledge from '../../Knowledge';
import { TKnowledge } from '../../Knowledge';
import { KnowledgeData } from '../../knowledge.type';

describe('MongoDB Knowledge Storage', () => {
  let knowledgeStorage: KnowledgeStorage;
  let knowledgeContentStorage: MongodbKnowledgeContentStorage;
  let knowledgeVectorStorage: MongodbKnowledgeVectorStorage;
  let knowledgeGraphStorage: MongoKnowledgeGraphStorage;

  beforeAll(() => {
    knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
    knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

    knowledgeStorage = new KnowledgeStorage(
      knowledgeContentStorage,
      knowledgeGraphStorage,
      knowledgeVectorStorage,
    );
  });

  describe('Knowledge Content Storage', () => {
    test('should create new knowledge content', async () => {
      const knowledgeData: KnowledgeData = {
        scope: 'Test Knowledge',
        content: 'This is a test knowledge content',
        childKnowledgeId: [],
      };

      const result =
        await knowledgeContentStorage.create_new_knowledge_content(
          knowledgeData,
        );

      expect(result).toHaveProperty('id');
      expect(result.scope).toBe(knowledgeData.scope);
      expect(result.content).toBe(knowledgeData.content);
      expect(result.childKnowledgeId).toEqual([]);
    });

    test('should get knowledge content by ID', async () => {
      const knowledgeData: KnowledgeData = {
        scope: 'Test Knowledge for Get',
        content: 'This is a test knowledge content for get operation',
        childKnowledgeId: [],
      };

      const created =
        await knowledgeContentStorage.create_new_knowledge_content(
          knowledgeData,
        );
      const retrieved =
        await knowledgeContentStorage.get_knowledge_content_by_id(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.scope).toBe(knowledgeData.scope);
      expect(retrieved.content).toBe(knowledgeData.content);
    });

    test('should update knowledge content', async () => {
      const knowledgeData: KnowledgeData = {
        scope: 'Test Knowledge for Update',
        content: 'This is a test knowledge content for update operation',
        childKnowledgeId: [],
      };

      const created =
        await knowledgeContentStorage.create_new_knowledge_content(
          knowledgeData,
        );
      const updatedData = {
        scope: 'Updated Test Knowledge',
        content: 'This is updated content',
      };

      const updated = await knowledgeContentStorage.update_knowledge_content(
        created.id,
        updatedData,
      );

      expect(updated.id).toBe(created.id);
      expect(updated.scope).toBe(updatedData.scope);
      expect(updated.content).toBe(updatedData.content);
    });

    test('should delete knowledge content', async () => {
      const knowledgeData: KnowledgeData = {
        scope: 'Test Knowledge for Delete',
        content: 'This is a test knowledge content for delete operation',
        childKnowledgeId: [],
      };

      const created =
        await knowledgeContentStorage.create_new_knowledge_content(
          knowledgeData,
        );
      const deleteResult =
        await knowledgeContentStorage.delete_knowledge_content_by_id(
          created.id,
        );

      expect(deleteResult).toBe(true);

      // Verify it's deleted
      await expect(
        knowledgeContentStorage.get_knowledge_content_by_id(created.id),
      ).rejects.toThrow();
    });

    test('should search knowledge contents', async () => {
      const knowledgeData1: KnowledgeData = {
        scope: 'Search Test Knowledge 1',
        content: 'This is a test knowledge content for search operation',
        childKnowledgeId: [],
      };

      const knowledgeData2: KnowledgeData = {
        scope: 'Search Test Knowledge 2',
        content: 'This is another test knowledge content',
        childKnowledgeId: [],
      };

      await knowledgeContentStorage.create_new_knowledge_content(
        knowledgeData1,
      );
      await knowledgeContentStorage.create_new_knowledge_content(
        knowledgeData2,
      );

      const searchResults =
        await knowledgeContentStorage.search_knowledge_contents('search');

      expect(searchResults.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Knowledge Vector Storage', () => {
    const testVector = Array(1536)
      .fill(0)
      .map((_, i) => Math.random());

    test('should store knowledge vector', async () => {
      const knowledgeId = 'test_knowledge_vector_1';

      await expect(
        knowledgeVectorStorage.store_knowledge_vector(knowledgeId, testVector, {
          test: true,
        }),
      ).resolves.not.toThrow();
    });

    test('should get knowledge vector', async () => {
      const knowledgeId = 'test_knowledge_vector_2';
      const metadata = { test: 'get' };

      await knowledgeVectorStorage.store_knowledge_vector(
        knowledgeId,
        testVector,
        metadata,
      );
      const result =
        await knowledgeVectorStorage.get_knowledge_vector(knowledgeId);

      expect(result).not.toBeNull();
      expect(result?.vector).toEqual(testVector);
      expect(result?.metadata).toEqual(metadata);
    });

    test('should update knowledge vector', async () => {
      const knowledgeId = 'test_knowledge_vector_3';
      const newVector = Array(1536)
        .fill(0)
        .map((_, i) => Math.random());
      const newMetadata = { test: 'updated' };

      await knowledgeVectorStorage.store_knowledge_vector(
        knowledgeId,
        testVector,
      );
      await knowledgeVectorStorage.update_knowledge_vector(
        knowledgeId,
        newVector,
        newMetadata,
      );
      const result =
        await knowledgeVectorStorage.get_knowledge_vector(knowledgeId);

      expect(result?.vector).toEqual(newVector);
      expect(result?.metadata).toEqual(newMetadata);
    });

    test('should delete knowledge vector', async () => {
      const knowledgeId = 'test_knowledge_vector_4';

      await knowledgeVectorStorage.store_knowledge_vector(
        knowledgeId,
        testVector,
      );
      const deleteResult =
        await knowledgeVectorStorage.delete_knowledge_vector(knowledgeId);

      expect(deleteResult).toBe(true);

      const result =
        await knowledgeVectorStorage.get_knowledge_vector(knowledgeId);
      expect(result).toBeNull();
    });

    test('should batch store knowledge vectors', async () => {
      const vectors = [
        {
          knowledgeId: 'batch_test_1',
          vector: Array(1536)
            .fill(0)
            .map((_, i) => Math.random()),
          metadata: { batch: true, index: 0 },
        },
        {
          knowledgeId: 'batch_test_2',
          vector: Array(1536)
            .fill(0)
            .map((_, i) => Math.random()),
          metadata: { batch: true, index: 1 },
        },
      ];

      await expect(
        knowledgeVectorStorage.batch_store_knowledge_vectors(vectors),
      ).resolves.not.toThrow();

      const result1 =
        await knowledgeVectorStorage.get_knowledge_vector('batch_test_1');
      const result2 =
        await knowledgeVectorStorage.get_knowledge_vector('batch_test_2');

      expect(result1?.vector).toEqual(vectors[0].vector);
      expect(result2?.vector).toEqual(vectors[1].vector);
    });
  });

  describe('Knowledge Graph Storage', () => {
    test('should create knowledge link', async () => {
      const sourceId = 'test_source_knowledge';
      const targetId = 'test_target_knowledge';

      await expect(
        knowledgeGraphStorage.create_new_link(sourceId, targetId),
      ).resolves.not.toThrow();
    });
  });

  describe('Knowledge Storage Integration', () => {
    test('should create and retrieve knowledge instance', async () => {
      const knowledgeData: KnowledgeData = {
        scope: 'Integration Test Knowledge',
        content: 'This is a test knowledge for integration testing',
        childKnowledgeId: [],
      };
      const sourceId = 'test_source_entity';

      const created = await knowledgeStorage.create_new_knowledge(
        knowledgeData,
        sourceId,
      );
      const knowledge = await knowledgeStorage.get_knowledge_by_id(created.id);

      expect(knowledge).not.toBeNull();
      expect(knowledge?.get_id()).toBe(created.id);
      expect(knowledge?.render_to_markdown_string()).toContain(
        'Integration Test Knowledge',
      );
    });

    test('should handle knowledge with children', async () => {
      const parentData: KnowledgeData = {
        scope: 'Parent Knowledge',
        content: 'This is parent knowledge',
        childKnowledgeId: [],
      };
      const childData: KnowledgeData = {
        scope: 'Child Knowledge',
        content: 'This is child knowledge',
        childKnowledgeId: [],
      };
      const sourceId = 'test_source_entity_2';

      // Create parent knowledge
      const createdParent = await knowledgeStorage.create_new_knowledge(
        parentData,
        sourceId,
      );

      // Create child knowledge
      const createdChild = await knowledgeStorage.create_new_knowledge(
        childData,
        createdParent.id,
      );

      // Update parent to include child
      await knowledgeContentStorage.update_knowledge_content(createdParent.id, {
        ...parentData,
        childKnowledgeId: [createdChild.id],
      });

      // Retrieve parent knowledge
      const parentKnowledge = await knowledgeStorage.get_knowledge_by_id(
        createdParent.id,
      );

      expect(parentKnowledge).not.toBeNull();
      expect(parentKnowledge?.getChildren().length).toBe(1);
      expect(parentKnowledge?.getChildren()[0].get_id()).toBe(createdChild.id);
    });
  });
});
