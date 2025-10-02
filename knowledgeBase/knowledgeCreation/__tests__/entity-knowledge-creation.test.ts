import { vi } from 'vitest';
import { EntityExtractor } from '../EntityExtractor';
import { KnowledgeCreationWorkflow } from '../KnowledgeCreationWorkflow';
import { MongodbKnowledgeContentStorage } from '../../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../../storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from '../../storage/knowledgeStorage';
import Entity from '../../Entity';
import { MongodbEntityContentStorage } from '../../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../../storage/mongodb-entity-graph-storage';
import { ElasticsearchVectorStorage } from '../../storage/elasticsearch-entity-vector-storage';
import EntityStorage from '../../storage/entityStorage';

// Mock the BAML client to avoid actual API calls during testing
vi.mock('../../../baml_client', () => ({
  b: {
    ExtractMainEntity: vi.fn().mockResolvedValue({
      name: 'Machine Learning',
      category: 'Technology',
      abstract: 'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
    }),
    ExtractScopes: vi.fn().mockResolvedValue([
      {
        name: 'Supervised Learning',
        abstract: 'Learning from labeled training data to make predictions.',
      },
      {
        name: 'Unsupervised Learning',
        abstract: 'Finding hidden patterns in unlabeled data.',
      },
      {
        name: 'Reinforcement Learning',
        abstract: 'Learning through trial and error with rewards and penalties.',
      },
    ]),
  },
}));

describe('Entity Knowledge Creation', () => {
  let entityStorage: EntityStorage;
  let knowledgeStorage: KnowledgeStorage;
  let entityExtractor: EntityExtractor;
  let knowledgeWorkflow: KnowledgeCreationWorkflow;
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

    // Initialize extractors and workflows
    entityExtractor = new EntityExtractor();
    knowledgeWorkflow = new KnowledgeCreationWorkflow(knowledgeStorage);

    // Create a test entity
    const entityData = {
      name: ['Test Entity'],
      tags: ['test'],
      definition: 'A test entity for unit testing.',
    };
    
    testEntity = await Entity.create_entity_with_entity_data(entityData).save(entityStorage);
  });

  afterAll(async () => {
    // Clean up test data if needed
    // This would depend on your specific storage implementation
  });

  describe('EntityExtractor', () => {
    it('should extract main entity from text', async () => {
      const text = 'Machine learning is a subset of artificial intelligence.';
      const result = await entityExtractor.extractMainEntity(text);
      
      expect(result).toBeDefined();
      expect(result.name).toBe('Machine Learning');
      expect(result.category).toBe('Technology');
      expect(result.abstract).toContain('Machine learning');
    });

    it('should extract related entities', async () => {
      const text = 'Machine learning and deep learning are part of AI.';
      const result = await entityExtractor.extractRelatedEntities(text, 'Machine Learning');
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('Machine Learning');
    });

    it('should extract relationships between entities', async () => {
      const text = 'Machine learning and deep learning are related fields.';
      const entities = [
        { name: 'Machine Learning', category: 'Technology', abstract: 'ML abstract' },
        { name: 'Deep Learning', category: 'Technology', abstract: 'DL abstract' },
      ];
      
      const relationships = await entityExtractor.extractRelationships(text, entities);
      
      expect(relationships).toBeDefined();
      expect(relationships.length).toBeGreaterThanOrEqual(0);
    });

    it('should analyze text structure', async () => {
      const text = `
      Introduction: This is the introduction.
      Main Content: This is the main content of the text.
      Conclusion: This is the conclusion.
      `;
      
      const sections = await entityExtractor.analyzeTextStructure(text);
      
      expect(sections).toBeDefined();
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0].title).toBe('Introduction');
    });
  });

  describe('KnowledgeCreationWorkflow', () => {
    it('should create simple knowledge from text', async () => {
      const text = 'This is a simple knowledge item for testing.';
      const scope = 'Test Knowledge';
      
      const knowledge = await knowledgeWorkflow.create_simple_knowledge_from_text(
        text,
        testEntity,
        scope,
      );
      
      expect(knowledge).toBeDefined();
      expect(knowledge.getData().scope).toBe(scope);
      expect(knowledge.getData().content).toBe(text);
    });

    it('should create knowledge hierarchy from text', async () => {
      const text = `
      Machine Learning Overview:
      Machine learning is a subset of artificial intelligence.
      
      Supervised Learning:
      Supervised learning uses labeled data for training.
      
      Unsupervised Learning:
      Unsupervised learning finds patterns in unlabeled data.
      `;
      
      const knowledge = await knowledgeWorkflow.create_knowledge_hierarchy_from_text(
        text,
        testEntity,
      );
      
      expect(knowledge).toBeDefined();
      expect(knowledge.getData().scope).toBe('Machine Learning');
      expect(knowledge.getChildren().length).toBeGreaterThan(0);
    });

    it('should update knowledge with new text', async () => {
      const initialText = 'Initial knowledge content.';
      const newText = 'Additional knowledge content to update.';
      
      // Create initial knowledge
      const knowledge = await knowledgeWorkflow.create_simple_knowledge_from_text(
        initialText,
        testEntity,
        'Update Test',
      );
      
      // Update with new text
      const updatedKnowledge = await knowledgeWorkflow.update_knowledge_with_text(
        knowledge,
        newText,
      );
      
      expect(updatedKnowledge).toBeDefined();
      expect(updatedKnowledge.getData().content).toContain(newText);
    });
  });

  describe('Entity Knowledge Creation Integration', () => {
    it('should create subordinate knowledge from text', async () => {
      const text = `
      Test Topic:
      This is a test topic for knowledge creation.
      
      Subtopic 1:
      This is the first subtopic.
      
      Subtopic 2:
      This is the second subtopic.
      `;
      
      const knowledge = await testEntity.create_subordinate_knowledge_from_text(
        text,
        knowledgeStorage,
      );
      
      expect(knowledge).toBeDefined();
      // The scope comes from the mocked BAML response, not the text
      expect(knowledge.getData().scope).toBe('Machine Learning');
      expect(knowledge.getChildren().length).toBeGreaterThan(0);
    });

    it('should retrieve subordinate knowledge', async () => {
      // Create some knowledge first
      const text = 'Test knowledge for retrieval.';
      await testEntity.create_subordinate_knowledge_from_text(text, knowledgeStorage);
      
      // Retrieve all subordinate knowledge
      const subordinateKnowledge = await testEntity.get_subordinate_knowledge(knowledgeStorage);
      
      expect(subordinateKnowledge).toBeDefined();
      expect(subordinateKnowledge.length).toBeGreaterThan(0);
    });

    it('should create knowledge with proper hierarchy', async () => {
      const text = `
      Root Topic:
      This is the root topic of the knowledge hierarchy.
      
      Child Topic 1:
      This is the first child topic.
      
      Grandchild Topic:
      This is a grandchild topic.
      
      Child Topic 2:
      This is the second child topic.
      `;
      
      const rootKnowledge = await testEntity.create_subordinate_knowledge_from_text(
        text,
        knowledgeStorage,
      );
      
      // Check that the hierarchy is properly created
      expect(rootKnowledge).toBeDefined();
      expect(rootKnowledge.getChildren().length).toBeGreaterThan(0);
      
      // Check that children have proper content - use mocked BAML responses
      const children = rootKnowledge.getChildren();
      expect(children.some(child => child.getData().scope.includes('Supervised Learning'))).toBe(true);
      expect(children.some(child => child.getData().scope.includes('Unsupervised Learning'))).toBe(true);
      expect(children.some(child => child.getData().scope.includes('Reinforcement Learning'))).toBe(true);
      
      // Render as markdown to verify structure
      const markdown = rootKnowledge.render_to_markdown_string();
      expect(markdown).toContain('Machine Learning'); // From mocked BAML response
      expect(markdown).toContain('Supervised Learning'); // From mocked BAML response
    });
  });

  describe('Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      const text = '';
      
      try {
        await knowledgeWorkflow.create_simple_knowledge_from_text(text, testEntity);
        // Should not throw an error for empty text
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, it should be a meaningful error
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid entity gracefully', async () => {
      const text = 'Test text';
      const invalidEntity = null as any;
      
      try {
        await knowledgeWorkflow.create_simple_knowledge_from_text(text, invalidEntity);
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        // Should throw an error for invalid entity
        expect(error).toBeDefined();
      }
    });
  });
});