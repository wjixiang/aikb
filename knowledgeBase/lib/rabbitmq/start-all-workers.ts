#!/usr/bin/env tsx

import { config } from 'dotenv';
import { getRabbitMQService } from './rabbitmq.service';
import { S3ElasticSearchLibraryStorage } from '../../knowledgeImport/library';
import { createPdfAnalysisWorker } from './pdf-analysis.worker';
import { createPdfProcessingCoordinatorWorker } from './pdf-processing-coordinator.worker';
import { createPdfConversionWorker } from './pdf-conversion.worker';
import { startMarkdownStorageWorker } from './markdown-storage.worker';
import createLoggerWithPrefix from '../logger';

// Load environment variables
config({ path: '.env' });

const logger = createLoggerWithPrefix('WorkerManager');

/**
 * Worker Manager
 * Manages all PDF processing workers
 */
class WorkerManager {
  private workers: any[] = [];
  private isShuttingDown = false;

  /**
   * Start all workers
   */
  async startAll(): Promise<void> {
    try {
      logger.info('Starting all workers...');

      // Initialize RabbitMQ service
      const rabbitMQService = getRabbitMQService();
      await rabbitMQService.initialize();
      logger.info('✅ RabbitMQ service initialized successfully');

      // Create storage instance for workers
      const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
      const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl, 1024);
      logger.info(`✅ Storage instance created (Elasticsearch: ${elasticsearchUrl})`);

      // Start PDF Analysis Worker
      const pdfAnalysisWorker = await createPdfAnalysisWorker(storage);
      this.workers.push({ name: 'PDF Analysis Worker', worker: pdfAnalysisWorker });
      logger.info('✅ PDF analysis worker started');

      // Start PDF Processing Coordinator Worker
      const pdfProcessingCoordinatorWorker = await createPdfProcessingCoordinatorWorker(storage);
      this.workers.push({ name: 'PDF Processing Coordinator Worker', worker: pdfProcessingCoordinatorWorker });
      logger.info('✅ PDF processing coordinator worker started');

      // Start PDF Conversion Worker
      const pdfConversionWorker = await createPdfConversionWorker();
      this.workers.push({ name: 'PDF Conversion Worker', worker: pdfConversionWorker });
      logger.info('✅ PDF conversion worker started');

      // Start Markdown Storage Worker
      const markdownStorageWorker = await startMarkdownStorageWorker(storage);
      this.workers.push({ name: 'Markdown Storage Worker', worker: markdownStorageWorker });
      logger.info('✅ Markdown storage worker started');

      logger.info('🎉 All workers started successfully!');
      logger.info(`Total workers running: ${this.workers.length}`);

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Keep the process running
      this.keepAlive();

    } catch (error) {
      logger.error('Failed to start workers:', error);
      process.exit(1);
    }
  }

  /**
   * Stop all workers
   */
  async stopAll(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    logger.info('Shutting down all workers...');

    const stopPromises = this.workers.map(async ({ name, worker }) => {
      try {
        logger.info(`Stopping ${name}...`);
        await worker.stop();
        logger.info(`✅ ${name} stopped`);
      } catch (error) {
        logger.error(`Failed to stop ${name}:`, error);
      }
    });

    await Promise.all(stopPromises);
    logger.info('🛑 All workers stopped');
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<void> {
    logger.info('Worker Statistics:');
    
    for (const { name, worker } of this.workers) {
      try {
        const stats = await worker.getWorkerStats();
        logger.info(`${name}:`, JSON.stringify(stats, null, 2));
      } catch (error) {
        logger.error(`Failed to get stats for ${name}:`, error);
      }
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      await this.stopAll();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  /**
   * Keep the process alive and handle periodic status updates
   */
  private keepAlive(): void {
    // Log worker stats every 5 minutes
    setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.getWorkerStats();
      }
    }, 5 * 60 * 1000);

    // Simple heartbeat every 30 seconds
    setInterval(() => {
      if (!this.isShuttingDown) {
        logger.info(`🏃 Workers running (${this.workers.length} workers) - Heartbeat`);
      }
    }, 30 * 1000);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const workerManager = new WorkerManager();
  await workerManager.startAll();
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start worker manager:', error);
    process.exit(1);
  });
}

export { WorkerManager };