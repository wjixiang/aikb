#!/usr/bin/env node

import { createChunkingEmbeddingWorker } from './chunk-embedding.worker';
import { createLoggerWithPrefix } from '@aikb/log-management';

const logger = createLoggerWithPrefix('ChunkEmbedMain');

async function main() {
  try {
    logger.info('Starting Chunk-Embed Microservice...');

    // For now, we'll use a mock storage implementation
    // In a real implementation, you would configure the appropriate storage
    // based on environment variables or configuration
    // const { S3ElasticSearchLibraryStorage } = await import('@aikb/bibliography');
    
    // Create a simple mock storage for now
    class MockStorage {
      async getMetadata(id: string) {
        return null;
      }
      async updateMetadata(metadata: any) {
        // Mock implementation
      }
    }
    
    // Create storage instance
    const storage = new MockStorage() as any;

    // Create and start worker
    const worker = await createChunkingEmbeddingWorker(storage);
    logger.info('Chunk-Embed Microservice started successfully');

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await worker.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Keep the process running
    logger.info('Chunk-Embed Microservice is running. Press Ctrl+C to stop.');

  } catch (error) {
    logger.error('Failed to start Chunk-Embed Microservice:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { main };