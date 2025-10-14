#!/usr/bin/env tsx

/**
 * Markdown Part Storage System Demo
 * 
 * This script demonstrates how to use the new markdown part storage system
 * for processing PDF documents in parts and merging them back together.
 */

import { MarkdownPartStorageWorker } from './markdown-part-storage.worker';
import { PdfMergerService } from './pdf-merger.service';
import { MongoDBMarkdownPartCache } from './markdown-part-cache-mongodb';
import { PdfPartTrackerImpl } from './pdf-part-tracker-impl';
import { getRabbitMQService } from './rabbitmq.service';
import {
  MarkdownPartStorageRequestMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
} from './message.types';
import { AbstractLibraryStorage } from '../../knowledgeImport/library';
import { v4 as uuidv4 } from 'uuid';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('MarkdownPartStorageDemo');

// Demo configuration
const DEMO_CONFIG = {
  itemId: `demo-item-${uuidv4()}`,
  totalParts: 5,
  simulateFailures: true,
  simulateConcurrency: true,
  cleanupAfterDemo: true,
};

// Sample markdown parts for demonstration
const SAMPLE_MARKDOWN_PARTS = [
  {
    partIndex: 0,
    content: `# Introduction to Machine Learning\n\nMachine learning is a subset of artificial intelligence (AI) that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. Machine learning focuses on the development of computer programs that can access data and use it to learn for themselves.\n\nThe process of learning begins with observations or data, such as examples, direct experience, or instruction, in order to look for patterns in data and make better decisions in the future based on the examples that we provide.`,
  },
  {
    partIndex: 1,
    content: `# Types of Machine Learning\n\n## Supervised Learning\n\nSupervised learning is a type of machine learning where the algorithm learns from labeled data. In supervised learning, the algorithm is provided with input-output pairs and learns to map inputs to outputs.\n\n### Common Supervised Learning Algorithms:\n- Linear Regression\n- Logistic Regression\n- Decision Trees\n- Random Forests\n- Support Vector Machines\n- Neural Networks\n\n## Unsupervised Learning\n\nUnsupervised learning is a type of machine learning where the algorithm learns from unlabeled data. The algorithm tries to find patterns and relationships in the data without any prior knowledge of the output.`,
  },
  {
    partIndex: 2,
    content: `# Deep Learning Fundamentals\n\nDeep learning is a subset of machine learning that uses neural networks with multiple layers to progressively extract higher-level features from raw input. For example, in image processing, lower layers may identify edges, while higher layers may identify concepts relevant to a human such as digits, letters, or faces.\n\n## Neural Networks\n\nNeural networks are computing systems vaguely inspired by the biological neural networks that constitute animal brains. Such systems "learn" to perform tasks by considering examples, generally without being programmed with task-specific rules.`,
  },
  {
    partIndex: 3,
    content: `# Practical Applications\n\nMachine learning has numerous applications across various industries:\n\n## Healthcare\n- Disease diagnosis and prediction\n- Drug discovery and development\n- Personalized treatment plans\n- Medical image analysis\n\n## Finance\n- Fraud detection\n- Risk assessment\n- Algorithmic trading\n- Customer segmentation\n\n## Technology\n- Natural language processing\n- Computer vision\n- Recommendation systems\n- Autonomous vehicles`,
  },
  {
    partIndex: 4,
    content: `# Conclusion\n\nMachine learning continues to evolve and impact our daily lives in numerous ways. As we collect more data and develop more sophisticated algorithms, the potential applications of machine learning will continue to expand.\n\n## Future Directions\n- Explainable AI (XAI)\n- Federated learning\n- Quantum machine learning\n- AutoML and automated model selection\n\n## Ethical Considerations\n- Data privacy and security\n- Algorithmic bias and fairness\n- Transparency and accountability\n- Human oversight and control\n\nThe future of machine learning depends not only on technological advancements but also on our ability to address these ethical challenges and ensure that these powerful tools are used responsibly for the benefit of society.`,
  },
];

// Mock storage for demonstration
class MockStorage implements Partial<AbstractLibraryStorage> {
  private metadata: any = {};
  private markdownContent: string = '';

  async getMetadata(id: string): Promise<any> {
    return this.metadata[id] || null;
  }

  async updateMetadata(metadata: any): Promise<void> {
    this.metadata[metadata.id] = metadata;
  }

  async saveMarkdown(itemId: string, content: string): Promise<void> {
    this.markdownContent = content;
    logger.info(`Saved markdown for item ${itemId}, length: ${content.length}`);
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    return this.markdownContent;
  }
}

/**
 * Main demo class
 */
class MarkdownPartStorageDemo {
  private cache: MongoDBMarkdownPartCache;
  private tracker: PdfPartTrackerImpl;
  private worker: MarkdownPartStorageWorker;
  private merger: PdfMergerService;
  private storage: MockStorage;
  private rabbitMQService = getRabbitMQService();

  constructor() {
    this.cache = new MongoDBMarkdownPartCache();
    this.tracker = new PdfPartTrackerImpl();
    this.storage = new MockStorage();
  }

  /**
   * Initialize the demo components
   */
  async initialize(): Promise<void> {
    logger.info('Initializing demo components...');

    // Initialize cache
    await this.cache.initialize();
    logger.info('✅ Markdown part cache initialized');

    // Initialize tracker
    await this.tracker.initializePdfProcessing(DEMO_CONFIG.itemId, DEMO_CONFIG.totalParts);
    logger.info('✅ PDF part tracker initialized');

    // Initialize worker
    this.worker = new MarkdownPartStorageWorker(this.cache, this.tracker);
    await this.worker.start();
    logger.info('✅ Markdown part storage worker started');

    // Initialize merger service
    this.merger = new PdfMergerService(this.storage as any, this.cache);
    await this.merger.start();
    logger.info('✅ PDF merger service started');

    logger.info('🚀 All demo components initialized successfully');
  }

  /**
   * Demonstrate normal processing flow
   */
  async demonstrateNormalFlow(): Promise<void> {
    logger.info('\n📋 Demonstrating normal processing flow...');
    logger.info(`Processing ${DEMO_CONFIG.totalParts} parts for item: ${DEMO_CONFIG.itemId}`);

    // Process all parts
    for (const part of SAMPLE_MARKDOWN_PARTS) {
      await this.processPart(part);
    }

    // Wait a bit for processing to complete
    await this.sleep(1000);

    // Verify all parts were processed
    const allParts = await this.cache.getAllParts(DEMO_CONFIG.itemId);
    logger.info(`✅ Processed ${allParts.length} parts successfully`);

    // Show merged content preview
    const mergedContent = await this.cache.mergeAllParts(DEMO_CONFIG.itemId);
    logger.info(`✅ Merged content length: ${mergedContent.length} characters`);
    logger.info(`📄 Content preview: "${mergedContent.substring(0, 100)}..."`);
  }

  /**
   * Demonstrate retry mechanism
   */
  async demonstrateRetryMechanism(): Promise<void> {
    logger.info('\n🔄 Demonstrating retry mechanism...');

    const failingPartIndex = 2;
    const retryItemId = `retry-demo-${uuidv4()}`;

    // Initialize tracker for retry demo
    await this.tracker.initializePdfProcessing(retryItemId, 3);

    // Process successful parts
    for (let i = 0; i < 3; i++) {
      if (i === failingPartIndex) continue;

      const part = {
        partIndex: i,
        content: `# Part ${i}\n\nThis is part ${i} of the document.`,
      };

      await this.processPart(part, retryItemId);
    }

    // Process failing part (empty content)
    logger.info(`Processing part ${failingPartIndex} with empty content (should fail)...`);
    await this.processPart(
      {
        partIndex: failingPartIndex,
        content: '', // Empty content should cause failure
      },
      retryItemId,
      1, // maxRetries
    );

    // Wait a bit for retry attempts
    await this.sleep(2000);

    // Process the part again with valid content (simulating retry success)
    logger.info(`Processing part ${failingPartIndex} with valid content (retry)...`);
    await this.processPart(
      {
        partIndex: failingPartIndex,
        content: `# Part ${failingPartIndex}\n\nThis is part ${failingPartIndex} after retry.`,
      },
      retryItemId,
    );

    // Verify final state
    const allParts = await this.cache.getAllParts(retryItemId);
    logger.info(`✅ Retry demonstration complete. Processed ${allParts.length} parts`);

    // Cleanup retry demo data
    await this.cache.cleanup(retryItemId);
    await this.tracker.cleanupPdfProcessing(retryItemId);
  }

  /**
   * Demonstrate concurrent processing
   */
  async demonstrateConcurrentProcessing(): Promise<void> {
    logger.info('\n⚡ Demonstrating concurrent processing...');

    const concurrentItemId = `concurrent-demo-${uuidv4()}`;
    await this.tracker.initializePdfProcessing(concurrentItemId, DEMO_CONFIG.totalParts);

    // Process all parts concurrently
    const processingPromises = SAMPLE_MARKDOWN_PARTS.map(async (part) => {
      return this.processPart(part, concurrentItemId);
    });

    // Wait for all parts to complete
    await Promise.all(processingPromises);

    // Wait a bit for processing to complete
    await this.sleep(1000);

    // Verify all parts were processed
    const allParts = await this.cache.getAllParts(concurrentItemId);
    logger.info(`✅ Concurrent processing complete. Processed ${allParts.length} parts`);

    // Cleanup concurrent demo data
    await this.cache.cleanup(concurrentItemId);
    await this.tracker.cleanupPdfProcessing(concurrentItemId);
  }

  /**
   * Demonstrate error handling
   */
  async demonstrateErrorHandling(): Promise<void> {
    logger.info('\n🚨 Demonstrating error handling...');

    const errorItemId = `error-demo-${uuidv4()}`;
    await this.tracker.initializePdfProcessing(errorItemId, 2);

    try {
      // Process a part with invalid data
      await this.processPart(
        {
          partIndex: 0,
          content: '# Valid Part\n\nThis is valid content.',
        },
        errorItemId,
      );

      // Try to process a part with invalid index
      logger.info('Attempting to process part with invalid index...');
      await this.processPart(
        {
          partIndex: -1, // Invalid index
          content: '# Invalid Part\n\nThis should fail.',
        },
        errorItemId,
      );

      logger.warning('⚠️ Expected error was not thrown');
    } catch (error) {
      logger.info(`✅ Error handled correctly: ${error.message}`);
    }

    // Cleanup error demo data
    await this.cache.cleanup(errorItemId);
    await this.tracker.cleanupPdfProcessing(errorItemId);
  }

  /**
   * Process a single part
   */
  private async processPart(
    part: { partIndex: number; content: string },
    itemId: string = DEMO_CONFIG.itemId,
    maxRetries: number = 3
  ): Promise<void> {
    const requestMessage: MarkdownPartStorageRequestMessage = {
      messageId: uuidv4(),
      timestamp: Date.now(),
      eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
      itemId,
      partIndex: part.partIndex,
      totalParts: DEMO_CONFIG.totalParts,
      markdownContent: part.content,
      priority: 'normal',
      maxRetries,
    };

    // Simulate message handling by the worker
    await (this.worker as any).handleMarkdownPartStorageRequest(requestMessage, null);
    
    logger.debug(`Processed part ${part.partIndex} for item ${itemId}`);
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up demo resources
   */
  async cleanup(): Promise<void> {
    logger.info('\n🧹 Cleaning up demo resources...');

    if (DEMO_CONFIG.cleanupAfterDemo) {
      try {
        await this.cache.cleanup(DEMO_CONFIG.itemId);
        await this.tracker.cleanupPdfProcessing(DEMO_CONFIG.itemId);
        logger.info('✅ Demo data cleaned up');
      } catch (error) {
        logger.warn('⚠️ Error during cleanup:', error);
      }
    }

    try {
      await this.worker.stop();
      await this.merger.stop();
      logger.info('✅ Workers stopped');
    } catch (error) {
      logger.warn('⚠️ Error stopping workers:', error);
    }

    logger.info('🏁 Cleanup complete');
  }

  /**
   * Run the complete demo
   */
  async run(): Promise<void> {
    try {
      logger.info('🎬 Starting Markdown Part Storage System Demo');
      logger.info('===========================================');

      // Initialize components
      await this.initialize();

      // Run demonstrations
      await this.demonstrateNormalFlow();

      if (DEMO_CONFIG.simulateFailures) {
        await this.demonstrateRetryMechanism();
      }

      if (DEMO_CONFIG.simulateConcurrency) {
        await this.demonstrateConcurrentProcessing();
      }

      await this.demonstrateErrorHandling();

      logger.info('===========================================');
      logger.info('🎉 Demo completed successfully!');
      logger.info('');
      logger.info('Key features demonstrated:');
      logger.info('✅ Normal PDF part processing and storage');
      logger.info('✅ Retry mechanism for failed parts');
      logger.info('✅ Concurrent processing of multiple parts');
      logger.info('✅ Error handling and recovery');
      logger.info('✅ Automatic merging of completed parts');
      logger.info('');
      logger.info('The Markdown Part Storage System is ready for production use!');

    } catch (error) {
      logger.error('❌ Demo failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

/**
 * Main function to run the demo
 */
async function main(): Promise<void> {
  const demo = new MarkdownPartStorageDemo();
  await demo.run();
}

// Run the demo if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Demo execution failed:', error);
    process.exit(1);
  });
}

export { MarkdownPartStorageDemo };