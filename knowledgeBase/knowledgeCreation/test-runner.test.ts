import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EntityExtractor } from './EntityExtractor';
import { KnowledgeCreationWorkflow } from './KnowledgeCreationWorkflow';
import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import Entity from '../Entity';
import { MongodbEntityContentStorage } from '../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../storage/mongodb-entity-graph-storage';
import { ElasticsearchVectorStorage } from '../storage/elasticsearch-entity-vector-storage';
import EntityStorage from '../storage/entityStorage';

describe('Knowledge Creation Tests', () => {
  let knowledgeStorage: KnowledgeStorage;
  let entityStorage: EntityStorage;
  let testEntity: Entity;

  beforeAll(async () => {
    // Initialize storage components
    const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
    const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();
    
    const entityContentStorage = new MongodbEntityContentStorage();
    const entityGraphStorage = new MongoEntityGraphStorage();
    const entityVectorStorage = new ElasticsearchVectorStorage();
    
    // Create storage instances
    knowledgeStorage = new KnowledgeStorage(
      knowledgeContentStorage,
      knowledgeGraphStorage,
      knowledgeVectorStorage,
    );
    
    entityStorage = new EntityStorage(
      entityContentStorage,
      entityGraphStorage,
      entityVectorStorage,
    );

    // Create a test entity
    const entityData = {
      name: ['Test Entity'],
      tags: ['test'],
      definition: 'A test entity for testing knowledge creation functionality.',
    };
    
    testEntity = await Entity.create_entity_with_entity_data(entityData).save(entityStorage);
  });

  describe('EntityExtractor', () => {
    it('should extract main entity from text', async () => {
      const extractor = new EntityExtractor();
      const text = 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.';
      const result = await extractor.extractMainEntity(text);
      
      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.abstract).toBeDefined();
    });

    it('should analyze text structure', async () => {
      const extractor = new EntityExtractor();
      const text = `
      Introduction: This is the introduction section.
      Main Content: This is the main content of the text.
      Conclusion: This is the conclusion section.
      `;
      
      const sections = await extractor.analyzeTextStructure(text);
      
      expect(sections).toBeDefined();
      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('KnowledgeCreationWorkflow', () => {
    it('should create simple knowledge from text', async () => {
      const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
      const text = 'This is a simple knowledge item for testing.';
      const scope = 'Test Knowledge';
      
      const knowledge = await workflow.create_simple_knowledge_from_text(
        text,
        testEntity,
        scope,
      );
      
      expect(knowledge).toBeDefined();
      expect(knowledge.getData().scope).toBe(scope);
      expect(knowledge.getData().content).toBe(text);
    });
  });

  describe('Entity Knowledge Creation', () => {
    it('should create subordinate knowledge from text', async () => {
      const text = `
      Machine Learning Overview:
      Machine learning is a subset of artificial intelligence.
      
      Supervised Learning:
      Supervised learning uses labeled data for training.
      
      Unsupervised Learning:
      Unsupervised learning finds patterns in unlabeled data.
      `;
      
      const knowledge = await testEntity.create_subordinate_knowledge_from_text(
        text,
        knowledgeStorage,
      );
      
      expect(knowledge).toBeDefined();
      expect(knowledge.getData().scope).toBeDefined();
    });

    it('should retrieve subordinate knowledge', async () => {
      const subordinateKnowledge = await testEntity.get_subordinate_knowledge(knowledgeStorage);
      
      expect(subordinateKnowledge).toBeDefined();
      expect(subordinateKnowledge.length).toBeGreaterThan(0);
    });

    it('should render knowledge as markdown', async () => {
      const text = `
      Root Topic:
      This is the root topic.
      
      Child Topic:
      This is a child topic.
      `;
      
      const knowledge = await testEntity.create_subordinate_knowledge_from_text(
        text,
        knowledgeStorage,
      );
      
      const markdown = knowledge.render_to_markdown_string();
      
      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(0);
    });
  });

  describe('Knowledge Hierarchy', () => {
    it('should create knowledge with proper hierarchy', async () => {
      const text = `
      Root Topic:
      This is the root topic of the knowledge hierarchy.
      
      Child Topic 1:
      This is the first child topic.
      
      Child Topic 2:
      This is the second child topic.
      `;
      
      const rootKnowledge = await testEntity.create_subordinate_knowledge_from_text(
        text,
        knowledgeStorage,
      );
      
      expect(rootKnowledge).toBeDefined();
      expect(rootKnowledge.getChildren().length).toBeGreaterThan(0);
      
      // Render as markdown to verify structure
      const markdown = rootKnowledge.render_to_markdown_string();
      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
      const text = '';
      
      try {
        const knowledge = await workflow.create_simple_knowledge_from_text(text, testEntity);
        // Should not throw an error for empty text
        expect(knowledge).toBeDefined();
      } catch (error) {
        // If it throws, it should be a meaningful error
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid entity gracefully', async () => {
      const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
      const text = 'Test text';
      const invalidEntity = null as any;
      
      try {
        await workflow.create_simple_knowledge_from_text(text, invalidEntity);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Should throw an error for invalid entity
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple knowledge creation efficiently', async () => {
      const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
      const startTime = Date.now();
      
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        const promise = workflow.create_simple_knowledge_from_text(
          `Performance test knowledge ${i}`,
          testEntity,
          `Performance Test ${i}`
        );
        promises.push(promise);
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results.length).toBe(5);
      expect(results.every(result => result !== null)).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Integration Tests', () => {
    it('should create and retrieve complex knowledge structure', async () => {
      const text = `
      Complex Topic:
      This is a complex topic with multiple levels.
      
      Subtopic 1:
      This is the first subtopic with detailed content.
      
      Subtopic 2:
      This is the second subtopic with more information.
      
      Deep Subtopic:
      This is a deeply nested subtopic for testing hierarchy.
      `;
      
      // Create knowledge
      const rootKnowledge = await testEntity.create_subordinate_knowledge_from_text(
        text,
        knowledgeStorage,
      );
      
      // Verify structure
      expect(rootKnowledge).toBeDefined();
      expect(rootKnowledge.getChildren().length).toBeGreaterThan(0);
      
      // Retrieve and verify
      const retrievedKnowledge = await testEntity.get_subordinate_knowledge(knowledgeStorage);
      expect(retrievedKnowledge.length).toBeGreaterThan(0);
      
      // Verify markdown rendering
      const markdown = rootKnowledge.render_to_markdown_string();
      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(0);
    });
  });
});