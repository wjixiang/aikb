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

/**
 * Simple test runner to verify the knowledge creation functionality
 */
async function runTests() {
  console.log('Starting Knowledge Creation Tests...\n');

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

  let testResults = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  // Test helper function
  async function runTest(testName: string, testFn: () => Promise<void>) {
    testResults.total++;
    try {
      await testFn();
      console.log(`✅ ${testName}`);
      testResults.passed++;
    } catch (error) {
      console.log(`❌ ${testName}`);
      console.error(`   Error: ${error.message}`);
      testResults.failed++;
    }
  }

  // Create a test entity
  let testEntity: Entity;
  try {
    const entityData = {
      name: ['Test Entity'],
      tags: ['test'],
      definition: 'A test entity for testing knowledge creation functionality.',
    };

    testEntity =
      await Entity.create_entity_with_entity_data(entityData).save(
        entityStorage,
      );
    console.log(`Created test entity with ID: ${testEntity.get_id()}\n`);
  } catch (error) {
    console.error('Failed to create test entity:', error);
    return;
  }

  // Test 1: EntityExtractor - Extract main entity
  await runTest(
    'EntityExtractor should extract main entity from text',
    async () => {
      const extractor = new EntityExtractor();
      const text =
        'Machine learning is a subset of artificial intelligence that enables systems to learn from data.';
      const result = await extractor.extractMainEntity(text);

      if (!result || !result.name || !result.category || !result.abstract) {
        throw new Error('Entity extraction failed or returned incomplete data');
      }

      console.log(`   Extracted entity: ${result.name} (${result.category})`);
    },
  );

  // Test 2: EntityExtractor - Analyze text structure
  await runTest('EntityExtractor should analyze text structure', async () => {
    const extractor = new EntityExtractor();
    const text = `
    Introduction: This is the introduction section.
    Main Content: This is the main content of the text.
    Conclusion: This is the conclusion section.
    `;

    const sections = await extractor.analyzeTextStructure(text);

    if (!sections || sections.length === 0) {
      throw new Error('Text structure analysis failed');
    }

    console.log(`   Analyzed ${sections.length} sections`);
  });

  // Test 3: KnowledgeCreationWorkflow - Create simple knowledge
  await runTest(
    'KnowledgeCreationWorkflow should create simple knowledge',
    async () => {
      const workflow = new KnowledgeCreationWorkflow(knowledgeStorage);
      const text = 'This is a simple knowledge item for testing.';
      const scope = 'Test Knowledge';

      const knowledge = await workflow.create_simple_knowledge_from_text(
        text,
        testEntity,
        scope,
      );

      if (
        !knowledge ||
        knowledge.getData().scope !== scope ||
        knowledge.getData().content !== text
      ) {
        throw new Error('Simple knowledge creation failed');
      }

      console.log(`   Created knowledge with ID: ${knowledge.get_id()}`);
    },
  );

  // Test 4: Entity - Create subordinate knowledge from text
  await runTest(
    'Entity should create subordinate knowledge from text',
    async () => {
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

      if (!knowledge || !knowledge.getData().scope) {
        throw new Error('Subordinate knowledge creation failed');
      }

      console.log(
        `   Created subordinate knowledge with ID: ${knowledge.get_id()}`,
      );
      console.log(`   Root scope: ${knowledge.getData().scope}`);
      console.log(`   Children count: ${knowledge.getChildren().length}`);
    },
  );

  // Test 5: Entity - Retrieve subordinate knowledge
  await runTest('Entity should retrieve subordinate knowledge', async () => {
    const subordinateKnowledge =
      await testEntity.get_subordinate_knowledge(knowledgeStorage);

    if (!subordinateKnowledge || subordinateKnowledge.length === 0) {
      throw new Error('Failed to retrieve subordinate knowledge');
    }

    console.log(
      `   Retrieved ${subordinateKnowledge.length} subordinate knowledge items`,
    );
  });

  // Test 6: Knowledge - Render as markdown
  await runTest('Knowledge should render as markdown', async () => {
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

    if (!markdown || !markdown.includes('Root Topic')) {
      throw new Error('Markdown rendering failed');
    }

    console.log(`   Rendered markdown with ${markdown.length} characters`);
  });

  // Print test results
  console.log('\n' + '='.repeat(50));
  console.log('Test Results:');
  console.log(`Total: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(
    `Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`,
  );
  console.log('='.repeat(50));

  if (testResults.failed === 0) {
    console.log(
      '\n🎉 All tests passed! Knowledge creation functionality is working correctly.',
    );
  } else {
    console.log(
      `\n⚠️  ${testResults.failed} test(s) failed. Please check the implementation.`,
    );
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
