import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import Knowledge from '../Knowledge';
import { TKnowledge } from '../Knowledge';
import Entity from '../Entity';
import { AbstractEntityStorage } from '../storage/abstract-storage';
import { MongodbEntityContentStorage } from '../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../storage/mongodb-entity-graph-storage';
import { ElasticsearchVectorStorage } from '../storage/elasticsearch-entity-vector-storage';
import EntityStorage from '../storage/entityStorage';

/**
 * Example demonstrating how to use Knowledge storage functionality
 */
async function knowledgeStorageExample() {
  console.log('Starting Knowledge Storage Example...');

  // Initialize storage components
  const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
  const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
  const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

  const entityContentStorage = new MongodbEntityContentStorage();
  const entityGraphStorage = new MongoEntityGraphStorage();
  const entityVectorStorage = new ElasticsearchVectorStorage();

  // Create storage instances
  const knowledgeStorage = new KnowledgeStorage(
    knowledgeContentStorage,
    knowledgeGraphStorage,
    knowledgeVectorStorage,
  );

  const entityStorage = new EntityStorage(
    entityContentStorage,
    entityGraphStorage,
    entityVectorStorage,
  );

  try {
    // Create a source entity
    const entityData = {
      name: ['Computer Science'],
      tags: ['technology', 'science'],
      definition: 'The study of computation, information, and automation.',
    };

    const entity =
      await Entity.create_entity_with_entity_data(entityData).save(
        entityStorage,
      );
    console.log(`Created entity with ID: ${entity.get_id()}`);

    // Create temporary knowledge
    const knowledgeData = {
      scope: 'Algorithms',
      content:
        'Algorithms are step-by-step procedures for solving problems and performing tasks.',
      childKnowledgeId: [],
    };

    const tempKnowledge =
      entity.create_knowledge_with_knowledge_data(knowledgeData);
    console.log('Created temporary knowledge');

    // Save knowledge to storage
    const knowledge = await tempKnowledge.save(knowledgeStorage);
    console.log(`Saved knowledge with ID: ${knowledge.get_id()}`);

    // Add child knowledge
    const childKnowledgeData = {
      scope: 'Sorting Algorithms',
      content: 'Sorting algorithms arrange elements in a specific order.',
      childKnowledgeId: [],
    };

    const childKnowledge = await knowledge.subdivide(childKnowledgeData);
    console.log(`Added child knowledge with ID: ${childKnowledge.get_id()}`);

    // Render knowledge as markdown
    const markdown = knowledge.render_to_markdown_string();
    console.log('Knowledge rendered as markdown:');
    console.log(markdown);

    // Store vector for knowledge (example with dummy vector)
    const dummyVector = Array(1536)
      .fill(0)
      .map((_, i) => Math.random());
    await knowledgeVectorStorage.store_knowledge_vector(
      knowledge.get_id(),
      dummyVector,
      { topic: 'algorithms', category: 'computer-science' },
    );
    console.log('Stored vector for knowledge');

    // Find similar knowledge (example)
    const similarKnowledge =
      await knowledgeVectorStorage.find_similar_knowledge_vectors(
        dummyVector,
        5,
        0.7,
      );
    console.log(`Found ${similarKnowledge.length} similar knowledge items`);

    // Update knowledge content
    await knowledge.update({
      scope: 'Algorithms and Data Structures',
      content:
        'Algorithms and data structures are fundamental concepts in computer science for organizing and processing information efficiently.',
    });
    console.log('Updated knowledge content');

    // Retrieve knowledge by ID
    const retrievedKnowledge = await knowledgeStorage.get_knowledge_by_id(
      knowledge.get_id(),
    );
    if (retrievedKnowledge) {
      console.log(`Retrieved knowledge: ${retrievedKnowledge.getData().scope}`);
      console.log('Children count:', retrievedKnowledge.getChildren().length);
    }

    // Search knowledge contents
    const searchResults =
      await knowledgeContentStorage.search_knowledge_contents('algorithm');
    console.log(
      `Found ${searchResults.length} knowledge items matching 'algorithm'`,
    );

    // List all knowledge
    const allKnowledge =
      await knowledgeContentStorage.list_all_knowledge_contents();
    console.log(`Total knowledge items in storage: ${allKnowledge.length}`);

    console.log('Knowledge Storage Example completed successfully!');
  } catch (error) {
    console.error('Error in Knowledge Storage Example:', error);
  }
}

/**
 * Example demonstrating advanced Knowledge operations
 */
async function advancedKnowledgeExample() {
  console.log('Starting Advanced Knowledge Example...');

  // Initialize storage components
  const knowledgeContentStorage = new MongodbKnowledgeContentStorage();
  const knowledgeVectorStorage = new MongodbKnowledgeVectorStorage();
  const knowledgeGraphStorage = new MongoKnowledgeGraphStorage();

  const knowledgeStorage = new KnowledgeStorage(
    knowledgeContentStorage,
    knowledgeGraphStorage,
    knowledgeVectorStorage,
  );

  try {
    // Create a complex knowledge hierarchy
    const rootKnowledgeData = {
      scope: 'Machine Learning',
      content:
        'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience.',
      childKnowledgeId: [],
    };

    const tempRootKnowledge = new TKnowledge(rootKnowledgeData, {
      get_id: () => 'source_entity',
    } as any);
    const rootKnowledge = await tempRootKnowledge.save(knowledgeStorage);
    console.log(`Created root knowledge: ${rootKnowledge.get_id()}`);

    // Create multiple child knowledge items
    const supervisedLearningData = {
      scope: 'Supervised Learning',
      content:
        'Supervised learning uses labeled training data to learn mapping functions.',
      childKnowledgeId: [],
    };

    const unsupervisedLearningData = {
      scope: 'Unsupervised Learning',
      content: 'Unsupervised learning finds hidden patterns in unlabeled data.',
      childKnowledgeId: [],
    };

    const reinforcementLearningData = {
      scope: 'Reinforcement Learning',
      content:
        'Reinforcement learning learns optimal actions through trial and error.',
      childKnowledgeId: [],
    };

    const supervisedLearning = await rootKnowledge.subdivide(
      supervisedLearningData,
    );
    const unsupervisedLearning = await rootKnowledge.subdivide(
      unsupervisedLearningData,
    );
    const reinforcementLearning = await rootKnowledge.subdivide(
      reinforcementLearningData,
    );

    console.log('Created three child knowledge items');

    // Add grandchildren to supervised learning
    const classificationData = {
      scope: 'Classification',
      content: 'Classification predicts discrete class labels.',
      childKnowledgeId: [],
    };

    const regressionData = {
      scope: 'Regression',
      content: 'Regression predicts continuous numerical values.',
      childKnowledgeId: [],
    };

    await supervisedLearning.subdivide(classificationData);
    await supervisedLearning.subdivide(regressionData);

    console.log('Added grandchildren to supervised learning');

    // Render the complete knowledge tree
    const fullMarkdown = rootKnowledge.render_to_markdown_string();
    console.log('Complete knowledge hierarchy:');
    console.log(fullMarkdown);

    // Batch store vectors for all knowledge
    const knowledgeItems = [
      rootKnowledge,
      supervisedLearning,
      unsupervisedLearning,
      reinforcementLearning,
    ];

    const vectors = knowledgeItems.map((knowledge) => ({
      knowledgeId: knowledge.get_id(),
      vector: Array(1536)
        .fill(0)
        .map((_, i) => Math.random()),
      metadata: {
        topic: knowledge.getData().scope,
        depth: knowledge.getChildren().length > 0 ? 'parent' : 'leaf',
      },
    }));

    await knowledgeVectorStorage.batch_store_knowledge_vectors(vectors);
    console.log(`Batch stored vectors for ${vectors.length} knowledge items`);

    // Remove a child knowledge
    await rootKnowledge.removeChild(reinforcementLearning.get_id());
    console.log('Removed reinforcement learning from children');

    // Verify the updated knowledge tree
    const updatedRoot = await knowledgeStorage.get_knowledge_by_id(
      rootKnowledge.get_id(),
    );
    if (updatedRoot) {
      console.log(
        `Updated children count: ${updatedRoot.getChildren().length}`,
      );
      console.log('Updated knowledge hierarchy:');
      console.log(updatedRoot.render_to_markdown_string());
    }

    console.log('Advanced Knowledge Example completed successfully!');
  } catch (error) {
    console.error('Error in Advanced Knowledge Example:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  knowledgeStorageExample()
    .then(() => advancedKnowledgeExample())
    .catch(console.error);
}

export { knowledgeStorageExample, advancedKnowledgeExample };
