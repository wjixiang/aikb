import { MongodbKnowledgeContentStorage } from '../storage/mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from '../storage/mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from '../storage/mongodb-knowledge-graph-storage';
import KnowledgeStorage from '../storage/knowledgeStorage';
import Knowledge from '../Knowledge';
import Entity from '../Entity';
import { AbstractEntityStorage } from '../storage/abstract-storage';
import { MongodbEntityContentStorage } from '../storage/mongodb-entity-content-storage';
import { MongoEntityGraphStorage } from '../storage/mongodb-entity-graph-storage';
import { ElasticsearchVectorStorage } from '../storage/elasticsearch-entity-vector-storage';
import EntityStorage from '../storage/entityStorage';
import { KnowledgeCreationWorkflow } from '../knowledgeCreation/KnowledgeCreationWorkflow';
import { EntityExtractor } from '../knowledgeCreation/EntityExtractor';

/**
 * Example demonstrating how to create knowledge hierarchy from an entity
 */
async function entityKnowledgeCreationExample() {
  console.log('Starting Entity Knowledge Creation Example...');

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
    // Create a parent entity
    const entityData = {
      name: ['Machine Learning'],
      tags: ['AI', 'Computer Science', 'Data Science'],
      definition:
        'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.',
    };

    const entity =
      await Entity.create_entity_with_entity_data(entityData).save(
        entityStorage,
      );
    console.log(`Created entity with ID: ${entity.get_id()}`);

    // Example 1: Create knowledge hierarchy from natural language text
    const mlText = `
    Machine Learning is a field of artificial intelligence that uses statistical techniques to give computer systems the ability to learn from data.
    
    Supervised Learning: This is a type of machine learning where the algorithm learns from labeled training data. The algorithm makes predictions or decisions based on input data and receives feedback. Common algorithms include linear regression, logistic regression, decision trees, and support vector machines.
    
    Unsupervised Learning: In this type, the algorithm works with unlabeled data and tries to find hidden patterns or intrinsic structures in the input data. Common techniques include clustering, dimensionality reduction, and association rule learning.
    
    Reinforcement Learning: This is about training agents to make a sequence of decisions in an environment to maximize a cumulative reward. The agent learns through trial and error, receiving rewards or penalties for its actions.
    `;

    console.log('Creating knowledge hierarchy from natural language text...');
    const knowledgeHierarchy =
      await entity.create_subordinate_knowledge_from_text(
        mlText,
        knowledgeStorage,
      );
    console.log(
      `Created knowledge hierarchy with root ID: ${knowledgeHierarchy.get_id()}`,
    );

    // Render the knowledge hierarchy as markdown
    const markdown = knowledgeHierarchy.render_to_markdown_string();
    console.log('Knowledge hierarchy rendered as markdown:');
    console.log(markdown);

    // Example 2: Create simple knowledge from text
    const simpleText = `
    Deep Learning is a subset of machine learning that uses neural networks with multiple layers.
    It has revolutionized fields like computer vision, natural language processing, and speech recognition.
    Key architectures include Convolutional Neural Networks (CNNs) for image processing and
    Recurrent Neural Networks (RNNs) for sequential data.
    `;

    console.log('Creating simple knowledge from text...');
    const simpleKnowledge = await entity.create_subordinate_knowledge_from_text(
      simpleText,
      knowledgeStorage,
    );
    console.log(
      `Created simple knowledge with ID: ${simpleKnowledge.get_id()}`,
    );

    // Example 3: Use EntityExtractor directly
    const extractor = new EntityExtractor();
    console.log('Extracting entities from text...');
    const mainEntity = await extractor.extractMainEntity(mlText);
    console.log('Extracted main entity:', mainEntity);

    const relatedEntities = await extractor.extractRelatedEntities(
      mlText,
      mainEntity.name,
    );
    console.log('Extracted related entities:', relatedEntities);

    const relationships = await extractor.extractRelationships(
      mlText,
      relatedEntities,
    );
    console.log('Extracted relationships:', relationships);

    // Example 4: Get all subordinate knowledge for the entity
    console.log('Retrieving all subordinate knowledge...');
    const subordinateKnowledge =
      await entity.get_subordinate_knowledge(knowledgeStorage);
    console.log(
      `Found ${subordinateKnowledge.length} subordinate knowledge items`,
    );

    // Example 5: Update existing knowledge with new text
    console.log('Updating knowledge with new text...');
    const additionalText = `
    Semi-Supervised Learning: This approach combines supervised and unsupervised learning, using a small amount of labeled data and a large amount of unlabeled data.
    Self-Supervised Learning: A type of unsupervised learning where the data itself provides the supervision, often used in pre-training large language models.
    `;

    await knowledgeHierarchy.update({
      scope: knowledgeHierarchy.getData().scope,
      content: knowledgeHierarchy.getData().content + '\n\n' + additionalText,
    });
    console.log('Updated knowledge with additional content');

    // Example 6: Use KnowledgeCreationWorkflow directly
    console.log('Using KnowledgeCreationWorkflow directly...');
    const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);

    const directText = `
    Natural Language Processing (NLP): A branch of artificial intelligence that helps computers understand, interpret and manipulate human language.
    
    Text Processing: Involves tokenization, stemming, lemmatization, and stop word removal.
    
    Sentiment Analysis: Determines the emotional tone behind a body of text.
    
    Machine Translation: Automatically translates text from one language to another.
    `;

    const directKnowledge = await workflow.create_knowledge_hierarchy_from_text(
      directText,
      entity,
    );
    console.log(
      `Created knowledge directly with ID: ${directKnowledge.get_id()}`,
    );

    // Render the final knowledge hierarchy
    const finalMarkdown = directKnowledge.render_to_markdown_string();
    console.log('Final knowledge hierarchy:');
    console.log(finalMarkdown);

    console.log('Entity Knowledge Creation Example completed successfully!');
  } catch (error) {
    console.error('Error in Entity Knowledge Creation Example:', error);
  }
}

/**
 * Example demonstrating advanced entity-knowledge relationship creation
 */
async function advancedEntityKnowledgeExample() {
  console.log('Starting Advanced Entity Knowledge Example...');

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
    // Create multiple related entities
    const computerScienceEntity = await Entity.create_entity_with_entity_data({
      name: ['Computer Science'],
      tags: ['Technology', 'Science'],
      definition: 'The study of computation, information, and automation.',
    }).save(entityStorage);

    const aiEntity = await Entity.create_entity_with_entity_data({
      name: ['Artificial Intelligence'],
      tags: ['Computer Science', 'Technology'],
      definition:
        'The simulation of human intelligence in machines that are programmed to think and learn.',
    }).save(entityStorage);

    const mlEntity = await Entity.create_entity_with_entity_data({
      name: ['Machine Learning'],
      tags: ['AI', 'Computer Science'],
      definition:
        'A subset of AI that enables systems to learn and improve from experience.',
    }).save(entityStorage);

    console.log('Created multiple related entities');

    // Create entity relationships
    await entityGraphStorage.create_relation(
      computerScienceEntity.get_id(),
      aiEntity.get_id(),
      'includes',
      { strength: 0.9 },
    );

    await entityGraphStorage.create_relation(
      aiEntity.get_id(),
      mlEntity.get_id(),
      'includes',
      { strength: 0.95 },
    );

    console.log('Created entity relationships');

    // Create knowledge for each entity
    const csText = `
    Computer Science encompasses theoretical foundations, algorithms, software systems, and computer hardware.
    Key areas include algorithms and data structures, programming languages, computer architecture, and software engineering.
    `;

    const aiText = `
    Artificial Intelligence includes various approaches like symbolic AI, machine learning, and deep learning.
    Applications range from natural language processing and computer vision to robotics and expert systems.
    `;

    const mlText = `
    Machine Learning algorithms include supervised learning, unsupervised learning, and reinforcement learning.
    It has applications in prediction, classification, clustering, and decision-making.
    `;

    const csKnowledge =
      await computerScienceEntity.create_subordinate_knowledge_from_text(
        csText,
        knowledgeStorage,
      );

    const aiKnowledge = await aiEntity.create_subordinate_knowledge_from_text(
      aiText,
      knowledgeStorage,
    );

    const mlKnowledge = await mlEntity.create_subordinate_knowledge_from_text(
      mlText,
      knowledgeStorage,
    );

    console.log('Created knowledge for each entity');

    // Create cross-entity knowledge relationships
    await knowledgeGraphStorage.create_new_link(
      csKnowledge.get_id(),
      aiKnowledge.get_id(),
    );

    await knowledgeGraphStorage.create_new_link(
      aiKnowledge.get_id(),
      mlKnowledge.get_id(),
    );

    console.log('Created cross-entity knowledge relationships');

    // Display the knowledge hierarchy
    console.log('Computer Science Knowledge:');
    console.log(csKnowledge.render_to_markdown_string());

    console.log('Artificial Intelligence Knowledge:');
    console.log(aiKnowledge.render_to_markdown_string());

    console.log('Machine Learning Knowledge:');
    console.log(mlKnowledge.render_to_markdown_string());

    // Demonstrate entity-knowledge-entity relationship
    console.log('Demonstrating entity-knowledge-entity relationships...');

    // Get all knowledge for Computer Science entity
    const csKnowledgeItems =
      await computerScienceEntity.get_subordinate_knowledge(knowledgeStorage);
    console.log(
      `Computer Science has ${csKnowledgeItems.length} knowledge items`,
    );

    // Get all knowledge for AI entity
    const aiKnowledgeItems =
      await aiEntity.get_subordinate_knowledge(knowledgeStorage);
    console.log(
      `Artificial Intelligence has ${aiKnowledgeItems.length} knowledge items`,
    );

    // Get all knowledge for ML entity
    const mlKnowledgeItems =
      await mlEntity.get_subordinate_knowledge(knowledgeStorage);
    console.log(
      `Machine Learning has ${mlKnowledgeItems.length} knowledge items`,
    );

    console.log('Advanced Entity Knowledge Example completed successfully!');
  } catch (error) {
    console.error('Error in Advanced Entity Knowledge Example:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  entityKnowledgeCreationExample()
    .then(() => advancedEntityKnowledgeExample())
    .catch(console.error);
}

export { entityKnowledgeCreationExample, advancedEntityKnowledgeExample };
