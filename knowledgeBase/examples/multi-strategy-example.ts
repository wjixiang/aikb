#!/usr/bin/env npx tsx

/**
 * Multi-Strategy Indexing Example
 * 
 * This example demonstrates the multi-strategy and multi-version indexing
 * functionality of the knowledge base system. It shows how to:
 * 
 * 1. Use different chunking strategies
 * 2. Create and manage embedding groups
 * 3. Perform advanced search with multiple strategies
 * 4. Handle errors and fallbacks
 */

import { 
  chunkTextAdvanced, 
  getAvailableStrategies, 
  autoSelectStrategy,
  canStrategyHandle,
  getStrategyDefaultConfig,
  validateStrategyConfig
} from '../../lib/chunking/chunkingTool';
import { DefaultGroupManager } from '../../lib/chunking/defaultGroupManager';
import { ChunkSearchUtils } from '../../lib/chunking/chunkSearchUtils';
import { ChunkingErrorHandler } from '../../lib/error/errorHandler';
import { BookChunk, ChunkSearchFilter, ChunkingEmbeddingGroup } from '../knowledgeImport/library';
import { MultiVersionChunkingManager } from '../../lib/chunking/multiVersionChunkingManager';

// Sample text for demonstration
const sampleText = `
# Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.

## What is Machine Learning?

Machine learning algorithms build a mathematical model based on sample data, known as "training data", in order to make predictions or decisions without being explicitly programmed to perform the task.

## Types of Machine Learning

### Supervised Learning
Supervised learning algorithms build a mathematical model of a set of data that contains both the inputs and the desired outputs.

### Unsupervised Learning
Unsupervised learning algorithms take a set of data that contains only inputs, and find structure in the data, like grouping or clustering of data points.

### Reinforcement Learning
Reinforcement learning is an area of machine learning concerned with how software agents ought to take actions in an environment in order to maximize the notion of cumulative reward.

## Applications

Machine learning is used in various applications including:
- Email filtering
- Computer vision
- Speech recognition
- Recommendation systems
- Medical diagnosis
- Financial trading

# Conclusion

Machine learning continues to evolve and find new applications in various fields, making it one of the most exciting areas of technology today.
`;

/**
 * Example 1: Discover and use available chunking strategies
 */
async function demonstrateChunkingStrategies() {
  console.log('\n=== Example 1: Available Chunking Strategies ===');
  
  // Get all available strategies
  const strategies = getAvailableStrategies();
  console.log('Available chunking strategies:');
  strategies.forEach(strategy => {
    console.log(`- ${strategy.name} (v${strategy.version}): ${strategy.description}`);
  });
  
  // Try different strategies on sample text
  console.log('\nTrying different strategies on sample text:');
  
  for (const strategy of strategies) {
    if (canStrategyHandle(strategy.name, sampleText)) {
      try {
        const chunks = chunkTextAdvanced(sampleText, strategy.name);
        console.log(`\n${strategy.name} strategy: ${chunks.length} chunks generated`);
        chunks.slice(0, 2).forEach((chunk, index) => {
          console.log(`  Chunk ${index + 1}: ${chunk.content.substring(0, 100)}...`);
        });
      } catch (error) {
        console.log(`Error with ${strategy.name}: ${error.message}`);
      }
    } else {
      console.log(`${strategy.name}: Cannot handle this text`);
    }
  }
}

/**
 * Example 2: Auto-select the best strategy
 */
async function demonstrateAutoStrategySelection() {
  console.log('\n=== Example 2: Automatic Strategy Selection ===');
  
  const selectedStrategy = autoSelectStrategy(sampleText);
  console.log(`Auto-selected strategy: ${selectedStrategy}`);
  
  const chunks = chunkTextAdvanced(sampleText, selectedStrategy);
  console.log(`Generated ${chunks.length} chunks using auto-selected strategy`);
  
  chunks.forEach((chunk, index) => {
    console.log(`\nChunk ${index + 1}:`);
    console.log(`  Title: ${chunk.title || 'No title'}`);
    console.log(`  Content: ${chunk.content.substring(0, 100)}...`);
  });
}

/**
 * Example 3: Work with strategy configurations
 */
async function demonstrateStrategyConfiguration() {
  console.log('\n=== Example 3: Strategy Configuration ===');
  
  const strategyName = 'h1';
  
  // Get default configuration
  const defaultConfig = getStrategyDefaultConfig(strategyName);
  console.log('Default configuration for H1 strategy:', defaultConfig);
  
  // Create custom configuration
  const customConfig = {
    maxChunkSize: 800,
    minChunkSize: 100,
    overlap: 50,
  };
  
  // Validate configuration
  const validation = validateStrategyConfig(strategyName, customConfig);
  console.log('Configuration validation:', validation);
  
  if (validation.valid) {
    const chunks = chunkTextAdvanced(sampleText, strategyName, customConfig);
    console.log(`Generated ${chunks.length} chunks with custom configuration`);
  }
}

/**
 * Example 4: Default Group Manager
 */
async function demonstrateGroupManager() {
  console.log('\n=== Example 4: Default Group Manager ===');
  
  const groupManager = DefaultGroupManager.getInstance();
  
  // Get default group for H1 strategy
  const h1Group = groupManager.getDefaultGroup('h1');
  console.log('Default H1 group:');
  if (h1Group) {
    console.log(`- ${h1Group.name}: ${h1Group.description}`);
    console.log(`  Strategy: ${h1Group.chunkingStrategy}`);
    console.log(`  Provider: ${h1Group.embeddingProvider}`);
  }
  
  // Get default group for paragraph strategy
  const paragraphGroup = groupManager.getDefaultGroup('paragraph');
  console.log('\nDefault paragraph group:');
  if (paragraphGroup) {
    console.log(`- ${paragraphGroup.name}: ${paragraphGroup.description}`);
    console.log(`  Strategy: ${paragraphGroup.chunkingStrategy}`);
    console.log(`  Provider: ${paragraphGroup.embeddingProvider}`);
  }
  
  // Note: In a real implementation, you would use the multiVersionChunkingManager
  // to create custom groups. The DefaultGroupManager only provides default groups.
  console.log('\nNote: Custom groups would be created using MultiVersionChunkingManager');
}

/**
 * Example 5: Advanced Search with Multiple Strategies
 */
async function demonstrateAdvancedSearch() {
  console.log('\n=== Example 5: Advanced Search with Multiple Strategies ===');
  
  // Create sample chunks
  const chunks: BookChunk[] = [
    {
      id: 'chunk-1',
      itemId: 'item-1',
      denseVectorIndexGroup: 'default-h1',
      version: '1.0.0',
      index: 0,
      title: 'Introduction to Machine Learning',
      content: 'Machine learning is a subset of artificial intelligence...',
      embeddings: {
        'openai': Array(1536).fill(0).map(() => Math.random()), // Mock vector
      },
      strategyMetadata: {
        chunkingStrategy: 'h1',
        chunkingConfig: {
          maxChunkSize: 1500,
          minChunkSize: 200,
          overlap: 100,
        },
        embeddingProvider: 'openai',
        embeddingConfig: {
          model: 'text-embedding-ada-002',
          dimension: 1536,
        },
        processingTimestamp: new Date(),
        processingDuration: 1000,
      },
      metadata: {
        chunkType: 'h1',
        wordCount: 25,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'chunk-2',
      itemId: 'item-1',
      denseVectorIndexGroup: 'default-paragraph',
      version: '1.0.0',
      index: 1,
      title: 'Machine Learning Definition',
      content: 'Machine learning algorithms build a mathematical model...',
      embeddings: {
        'openai': Array(1536).fill(0).map(() => Math.random()), // Mock vector
      },
      strategyMetadata: {
        chunkingStrategy: 'paragraph',
        chunkingConfig: {
          maxChunkSize: 1000,
          minChunkSize: 100,
          overlap: 50,
        },
        embeddingProvider: 'openai',
        embeddingConfig: {
          model: 'text-embedding-ada-002',
          dimension: 1536,
        },
        processingTimestamp: new Date(),
        processingDuration: 1200,
      },
      metadata: {
        chunkType: 'paragraph',
        wordCount: 35,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'chunk-3',
      itemId: 'item-2',
      denseVectorIndexGroup: 'default-h1',
      version: '2.0.0',
      index: 0,
      title: 'Types of Machine Learning',
      content: 'There are three main types of machine learning...',
      embeddings: {
        'openai': Array(1536).fill(0).map(() => Math.random()), // Mock vector
      },
      strategyMetadata: {
        chunkingStrategy: 'h1',
        chunkingConfig: {
          maxChunkSize: 1500,
          minChunkSize: 200,
          overlap: 100,
        },
        embeddingProvider: 'openai',
        embeddingConfig: {
          model: 'text-embedding-ada-002',
          dimension: 1536,
        },
        processingTimestamp: new Date(),
        processingDuration: 900,
      },
      metadata: {
        chunkType: 'h1',
        wordCount: 30,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  
  // Create search filter
  const filter: ChunkSearchFilter = {
    query: 'machine learning',
    groups: ['default-h1', 'default-paragraph'],
    limit: 10,
  };
  
  // Apply filters
  const filteredChunks = ChunkSearchUtils.filterChunks(chunks, filter);
  console.log(`Filtered ${chunks.length} chunks to ${filteredChunks.length} results`);
  
  // Sort by relevance
  const sortedChunks = ChunkSearchUtils.sortChunks(filteredChunks, 'relevance');
  console.log('\nSorted results by relevance:');
  sortedChunks.forEach((chunk, index) => {
    console.log(`${index + 1}. ${chunk.title} (${chunk.denseVectorIndexGroup})`);
    console.log(`   ${chunk.content.substring(0, 80)}...`);
  });
  
  // Apply group-based filtering with priority
  const priorities = {
    'default-h1': 1,
    'default-paragraph': 0.8,
  };
  const priorityFilteredChunks = ChunkSearchUtils.filterByGroupsWithPriority(
    chunks,
    ['default-h1', 'default-paragraph'],
    priorities
  );
  console.log(`\nAfter priority filtering: ${priorityFilteredChunks.length} chunks`);
}

/**
 * Example 6: Error Handling and Fallbacks
 */
async function demonstrateErrorHandling() {
  console.log('\n=== Example 6: Error Handling and Fallbacks ===');
  
  const errorHandler = ChunkingErrorHandler;
  
  // Test invalid strategy
  try {
    chunkTextAdvanced(sampleText, 'invalid-strategy');
  } catch (error) {
    errorHandler.handleChunkingError(error, {
      operation: 'chunking',
      strategy: 'invalid-strategy',
    }, () => {
      // Fallback function
      console.log('Applying fallback strategy: H1');
      return chunkTextAdvanced(sampleText, 'h1');
    });
  }
  
  // Test configuration validation
  const invalidConfig = {
    maxChunkSize: -100, // Invalid negative size
    minChunkSize: 200,
    overlap: 50,
  };
  
  const validation = validateStrategyConfig('h1', invalidConfig);
  if (!validation.valid) {
    console.log('\nConfiguration errors:', validation.errors);
    
    // Apply automatic correction
    // Note: In a real implementation, you would have a config correction method
    const correctedConfig = {
      maxChunkSize: Math.max(invalidConfig.maxChunkSize, 100),
      minChunkSize: Math.max(invalidConfig.minChunkSize, 50),
      overlap: Math.min(invalidConfig.overlap, 100),
    };
    console.log('Corrected configuration:', correctedConfig);
  }
  
  // Test retry mechanism
  console.log('\nTesting retry mechanism:');
  let attempt = 0;
  const maxAttempts = 3;
  
  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Simulate a failing operation
      if (attempt < 3) {
        throw new Error(`Simulated failure (attempt ${attempt})`);
      }
      
      console.log(`Operation succeeded on attempt ${attempt}`);
      break;
    } catch (error) {
      const shouldRetry = attempt < maxAttempts;
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      console.log(`Should retry: ${shouldRetry}`);
      
      if (!shouldRetry) {
        console.log('Max retries reached, giving up');
        break;
      }
    }
  }
}

/**
 * Example 7: Multi-Version Chunking Manager
 */
async function demonstrateMultiVersionChunking() {
  console.log('\n=== Example 7: Multi-Version Chunking Manager ===');
  
  // Note: MultiVersionChunkingManager is an interface
  // In a real implementation, you would use a concrete implementation
  console.log('Multi-Version Chunking Manager would be used to:');
  console.log('- Create and manage chunking sessions');
  console.log('- Process chunks with different strategies');
  console.log('- Track session status and progress');
  console.log('- Complete sessions and store results');
  
  // Simulate what would happen in a real implementation
  const sessionId = 'session-' + Date.now();
  console.log(`\nSimulated chunking session: ${sessionId}`);
  
  const chunks = chunkTextAdvanced(sampleText, 'h1');
  console.log(`Would process ${chunks.length} chunks with H1 strategy`);
  
  console.log('Session status would track:');
  console.log(`- Total chunks: ${chunks.length}`);
  console.log(`- Processed chunks: ${chunks.length}`);
  console.log(`- Status: Complete`);
}

/**
 * Main execution function
 */
async function main() {
  console.log('Multi-Strategy Indexing Example');
  console.log('================================');
  
  try {
    await demonstrateChunkingStrategies();
    await demonstrateAutoStrategySelection();
    await demonstrateStrategyConfiguration();
    await demonstrateGroupManager();
    await demonstrateAdvancedSearch();
    await demonstrateErrorHandling();
    await demonstrateMultiVersionChunking();
    
    console.log('\n=== All Examples Completed Successfully ===');
    console.log('\nKey Features Demonstrated:');
    console.log('✓ Multiple chunking strategies');
    console.log('✓ Automatic strategy selection');
    console.log('✓ Strategy configuration and validation');
    console.log('✓ Default group management');
    console.log('✓ Advanced search with filtering');
    console.log('✓ Error handling and fallbacks');
    console.log('✓ Multi-version chunking support');
    
  } catch (error) {
    console.error('Example execution failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export {
  demonstrateChunkingStrategies,
  demonstrateAutoStrategySelection,
  demonstrateStrategyConfiguration,
  demonstrateGroupManager,
  demonstrateAdvancedSearch,
  demonstrateErrorHandling,
  demonstrateMultiVersionChunking,
};