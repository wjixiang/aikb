import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import { MongodbEntityContentStorage } from '../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../storage/mongodb-entity-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import EntityStorage from '../storage/entityStorage';
import Entity from '../Entity';
import { KnowledgeCreationWorkflow } from '../knowledgeCreation/KnowledgeCreationWorkflow';

/**
 * Simple test to verify Entity-Knowledge creation functionality
 */
async function simpleEntityKnowledgeTest() {
  console.log('Starting Simple Entity Knowledge Test...');

  try {
    // Initialize storage components (only MongoDB, no Elasticsearch)
    const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
    const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();
    
    const entityContentStorage = new MongodbEntityContentStorage();
    const entityGraphStorage = new MongoEntityGraphStorage();
    
    // Create storage instances
    const knowledgeStorage = new KnowledgeStorage(
      knowledgeContentStorage,
      knowledgeGraphStorage,
      knowledgeVectorStorage,
    );
    
    // Create a mock vector storage for this test
    const mockVectorStorage = {
      store_vector: async () => {},
      get_vector: async () => null,
      update_vector: async () => {},
      delete_vector: async () => false,
      find_similar_vectors: async () => [],
      batch_store_vectors: async () => {},
    };
    
    const entityStorage = new EntityStorage(
      entityContentStorage,
      entityGraphStorage,
      mockVectorStorage as any,
    );

    // Create a test entity
    const entityData = {
      name: ['Test Entity'],
      tags: ['test', 'example'],
      definition: 'A test entity for verifying entity-knowledge creation functionality.',
    };
    
    const entity = await Entity.create_entity_with_entity_data(entityData).save(entityStorage);
    console.log(`Created entity with ID: ${entity.get_id()}`);

    // Create simple knowledge from text
    const text = 'This is a simple knowledge item created from text for testing purposes.';
    const scope = 'Test Knowledge';
    
    const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
    const knowledge = await workflow.create_simple_knowledge_from_text(
      text,
      entity,
      scope,
    );
    
    console.log(`Created knowledge with ID: ${knowledge.get_id()}`);
    console.log(`Knowledge scope: ${knowledge.getData().scope}`);
    console.log(`Knowledge content: ${knowledge.getData().content}`);

    // Test entity-knowledge relationship
    const subordinateKnowledge = await entity.get_subordinate_knowledge(knowledgeStorage);
    console.log(`Found ${subordinateKnowledge.length} subordinate knowledge items for the entity`);
    
    if (subordinateKnowledge.length > 0) {
      const firstKnowledge = subordinateKnowledge[0];
      console.log(`First subordinate knowledge: ${firstKnowledge.getData().scope}`);
    }

    // Create knowledge hierarchy from text
    const hierarchyText = `
    Main Topic:
    This is the main topic of our knowledge hierarchy.
    
    Subtopic 1:
    This is the first subtopic with detailed information.
    
    Subtopic 2:
    This is the second subtopic with additional details.
    `;
    
    const hierarchyKnowledge = await entity.create_subordinate_knowledge_from_text(
      hierarchyText,
      knowledgeStorage,
    );
    
    console.log(`Created knowledge hierarchy with root ID: ${hierarchyKnowledge.get_id()}`);
    console.log(`Root knowledge scope: ${hierarchyKnowledge.getData().scope}`);
    console.log(`Number of child knowledge items: ${hierarchyKnowledge.getChildren().length}`);

    // Get all subordinate knowledge again
    const allSubordinateKnowledge = await entity.get_subordinate_knowledge(knowledgeStorage);
    console.log(`Total subordinate knowledge items: ${allSubordinateKnowledge.length}`);

    console.log('Simple Entity Knowledge Test completed successfully!');
  } catch (error) {
    console.error('Error in Simple Entity Knowledge Test:', error);
  }
}

// Run the test
simpleEntityKnowledgeTest();