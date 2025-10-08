import {
  initializeAndStartKafkaService,
  stopKafkaService,
} from './kafka.service';
import {
  MockEntityContentStorage,
  MockEntityGraphStorage,
  MockEntityVectorStorage,
} from './mocks';
import { embeddingService } from '../lib/embedding/embedding';

/**
 * Example usage of Kafka integration for entity processing
 */
async function kafkaExample() {
  console.log('Starting Kafka integration example...');

  // Initialize mock storage implementations
  const contentStorage = new MockEntityContentStorage();
  const graphStorage = new MockEntityGraphStorage();
  const vectorStorage = new MockEntityVectorStorage();

  try {
    // Initialize and start Kafka service
    console.log('Initializing Kafka service...');
    const kafkaService = await initializeAndStartKafkaService(
      contentStorage,
      graphStorage,
      vectorStorage,
    );

    console.log('Kafka service initialized and started successfully');

    // Get the Kafka-enabled entity storage
    const entityStorage = kafkaService.getEntityStorage();
    if (!entityStorage) {
      throw new Error('Entity storage not available');
    }

    // Example 1: Create an entity
    console.log('\n=== Example 1: Creating an entity ===');
    const entityData = {
      name: ['Artificial Intelligence'],
      tags: ['technology', 'computer-science', 'AI'],
      definition:
        'Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines capable of performing tasks that typically require human intelligence.',
    };

    const entity = await entityStorage.create_new_entity(entityData);
    console.log('Entity created:', {
      id: entity.id,
      name: entity.name,
      tags: entity.tags,
      definition: entity.definition.substring(0, 50) + '...',
    });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the entity was stored
    const storedEntity = await contentStorage.get_entity_by_id(entity.id);
    console.log(
      'Entity verified in storage:',
      storedEntity ? 'Found' : 'Not found',
    );

    // Example 2: Create another entity and establish a relationship
    console.log(
      '\n=== Example 2: Creating related entity and relationship ===',
    );
    const relatedEntityData = {
      name: ['Machine Learning'],
      tags: ['technology', 'AI', 'ML'],
      definition:
        'Machine Learning is a subset of artificial intelligence that focuses on the development of algorithms and statistical models that enable computer systems to improve their performance on a specific task through experience.',
    };

    const relatedEntity =
      await entityStorage.create_new_entity(relatedEntityData);
    console.log('Related entity created:', {
      id: relatedEntity.id,
      name: relatedEntity.name,
    });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create a relationship between entities
    await entityStorage.create_entity_relation(
      entity.id,
      relatedEntity.id,
      'includes',
      { strength: 0.9, context: 'AI includes ML as a subfield' },
    );

    console.log('Relationship created: AI -> Machine Learning (includes)');

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the relationship was stored
    const relations = await graphStorage.get_entity_relations(entity.id);
    console.log('Relationships verified:', relations.length, 'found');

    // Example 3: Generate and store vectors for entities
    console.log('\n=== Example 3: Generating and storing vectors ===');

    // Generate vector for the first entity
    const vector1 = await embeddingService.embed(entityData.definition);
    if (vector1) {
      await entityStorage.generate_entity_vector(entity.id, vector1, {
        model: 'text-embedding-ada-002',
        source: 'definition',
      });
      console.log('Vector generated and stored for AI entity');
    }

    // Generate vector for the second entity
    const vector2 = await embeddingService.embed(relatedEntityData.definition);
    if (vector2) {
      await entityStorage.generate_entity_vector(relatedEntity.id, vector2, {
        model: 'text-embedding-ada-002',
        source: 'definition',
      });
      console.log('Vector generated and stored for ML entity');
    }

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify vectors were stored
    const storedVector1 = await vectorStorage.get_vector(entity.id);
    const storedVector2 = await vectorStorage.get_vector(relatedEntity.id);
    console.log('Vectors verified:', {
      ai: storedVector1 ? 'Found' : 'Not found',
      ml: storedVector2 ? 'Found' : 'Not found',
    });

    // Example 4: Health check
    console.log('\n=== Example 4: Health check ===');
    const health = await kafkaService.healthCheck();
    console.log('Kafka service health:', health);

    // Example 5: Search and list entities
    console.log('\n=== Example 5: Searching entities ===');
    const allEntities = await contentStorage.list_all_entities();
    console.log('Total entities in storage:', allEntities.length);

    const searchResults = await contentStorage.search_entities('intelligence');
    console.log(
      'Search results for "intelligence":',
      searchResults.length,
      'found',
    );

    console.log('\n=== Example completed successfully ===');
  } catch (error) {
    console.error('Error in Kafka example:', error);
  } finally {
    // Clean up
    console.log('\nStopping Kafka service...');
    await stopKafkaService();
    console.log('Kafka service stopped');
  }
}

/**
 * Example of using the Kafka integration with real storage implementations
 */
async function productionExample() {
  console.log('Starting production example with real storage...');

  // This would use your actual storage implementations
  // const contentStorage = new YourEntityContentStorage();
  // const graphStorage = new YourEntityGraphStorage();
  // const vectorStorage = new YourEntityVectorStorage();

  // For this example, we'll use mocks
  const contentStorage = new MockEntityContentStorage();
  const graphStorage = new MockEntityGraphStorage();
  const vectorStorage = new MockEntityVectorStorage();

  try {
    // Initialize Kafka service
    const kafkaService = await initializeAndStartKafkaService(
      contentStorage,
      graphStorage,
      vectorStorage,
    );

    // Your application logic here
    const entityStorage = kafkaService.getEntityStorage();

    // Create entities, relationships, and vectors as needed
    // ...

    // Keep the service running
    console.log('Kafka service is running. Press Ctrl+C to stop.');

    // In a real application, you would handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await stopKafkaService();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start production example:', error);
    await stopKafkaService();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  kafkaExample().catch(console.error);
}

export { kafkaExample, productionExample };
