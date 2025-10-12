#!/usr/bin/env node

const { config } = require('dotenv');
const path = require('path');

// Load environment variables
config({ path: path.join(process.cwd(), '.env') });

const { getRabbitMQService } = require('./rabbitmq.service');
const { S3ElasticSearchLibraryStorage } = require('../../knowledgeImport/library');
const { createPdfAnalysisWorker } = require('./pdf-analysis.worker');
const { createPdfProcessingCoordinatorWorker } = require('./pdf-processing-coordinator.worker');
const { createPdfConversionWorker } = require('./pdf-conversion.worker');
const { startMarkdownStorageWorker } = require('./markdown-storage.worker');

// Simple logger
const logger = {
  info: (msg, ...args) => console.log(`[WorkerManager] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[WorkerManager] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WorkerManager] ${msg}`, ...args)
};

/**
 * Worker Manager
 * Manages all PDF processing workers
 */
class WorkerManager {
  constructor() {
    this.workers = [];
    this.isShuttingDown = false;
  }

  /**
   * Start all workers
   */
  async startAll() {
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
  async stopAll() {
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
  async getWorkerStats() {
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
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
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
  keepAlive() {
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
async function main() {
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

module.exports = { WorkerManager };