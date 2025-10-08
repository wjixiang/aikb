import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import Knowledge from '../Knowledge';
import { TKnowledge } from '../Knowledge';
import { KnowledgeData } from '../knowledge.type';

/**
 * Simple test to verify MongoDB Knowledge storage functionality
 */
async function simpleKnowledgeTest() {
  console.log('Starting Simple Knowledge Test...');

  try {
    // Initialize storage components (only MongoDB, no Elasticsearch)
    const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
    const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
    const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

    // Create storage instance
    const knowledgeStorage = new KnowledgeStorage(
      knowledgeContentStorage,
      knowledgeGraphStorage,
      knowledgeVectorStorage,
    );

    // Create test knowledge data
    const knowledgeData: KnowledgeData = {
      scope: 'Test Knowledge',
      content:
        'This is a test knowledge item for verifying MongoDB storage functionality.',
      childKnowledgeId: [],
    };

    // Create temporary knowledge
    const tempKnowledge = new TKnowledge(knowledgeData, {
      get_id: () => 'test_source',
    } as any);
    console.log('Created temporary knowledge');

    // Save knowledge to storage
    const knowledge = await tempKnowledge.save(knowledgeStorage);
    console.log(`Saved knowledge with ID: ${knowledge.get_id()}`);

    // Retrieve knowledge by ID
    const retrievedKnowledge = await knowledgeStorage.get_knowledge_by_id(
      knowledge.get_id(),
    );
    if (retrievedKnowledge) {
      console.log(`Retrieved knowledge: ${retrievedKnowledge.getData().scope}`);
      console.log('Content:', retrievedKnowledge.getData().content);
    }

    // Store vector for knowledge (example with dummy vector)
    const dummyVector = Array(1536)
      .fill(0)
      .map((_, i) => Math.random());
    await knowledgeVectorStorage.store_knowledge_vector(
      knowledge.get_id(),
      dummyVector,
      { topic: 'test', category: 'verification' },
    );
    console.log('Stored vector for knowledge');

    // Retrieve vector
    const retrievedVector = await knowledgeVectorStorage.get_knowledge_vector(
      knowledge.get_id(),
    );
    if (retrievedVector) {
      console.log(
        `Retrieved vector with ${retrievedVector.vector.length} dimensions`,
      );
      console.log('Metadata:', retrievedVector.metadata);
    }

    // Update knowledge content
    await knowledge.update({
      scope: 'Updated Test Knowledge',
      content: 'This is updated content for the test knowledge item.',
    });
    console.log('Updated knowledge content');

    // Search knowledge contents
    const searchResults =
      await knowledgeContentStorage.search_knowledge_contents('test');
    console.log(
      `Found ${searchResults.length} knowledge items matching 'test'`,
    );

    // List all knowledge
    const allKnowledge =
      await knowledgeContentStorage.list_all_knowledge_contents();
    console.log(`Total knowledge items in storage: ${allKnowledge.length}`);

    console.log('Simple Knowledge Test completed successfully!');
  } catch (error) {
    console.error('Error in Simple Knowledge Test:', error);
  }
}

// Run the test
simpleKnowledgeTest();
