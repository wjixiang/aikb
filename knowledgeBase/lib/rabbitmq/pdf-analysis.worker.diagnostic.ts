import {
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { PdfAnalyzerService, createPdfAnalyzerService } from './pdf-analyzer.service';
import { AbstractLibraryStorage } from '../../knowledgeImport/library';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('PdfAnalysisWorkerDiagnostic');

// Add diagnostic logging for Elasticsearch transport
logger.info('DIAGNOSTIC: Worker starting up', {
  elasticsearchLoggingEnabled: process.env.ELASTICSEARCH_LOGGING_ENABLED,
  elasticsearchUrl: process.env.ELASTICSEARCH_URL,
  elasticsearchLogLevel: process.env.ELASTICSEARCH_LOG_LEVEL,
  systemLogLevel: process.env.SYSTEM_LOG_LEVEL,
  nodeEnv: process.env.NODE_ENV,
  serviceName: process.env.SERVICE_NAME,
  timestamp: new Date().toISOString()
});

/**
 * PDF Analysis Worker with enhanced diagnostics
 * Processes PDF analysis requests from RabbitMQ queue
 */
export class PdfAnalysisWorker {
  private rabbitMQService = getRabbitMQService();
  private analyzerService: PdfAnalyzerService;
  private consumerTag: string | null = null;
  private isRunning = false;

  constructor(storage: AbstractLibraryStorage) {
    this.analyzerService = createPdfAnalyzerService(storage);
    
    // Test Elasticsearch logging immediately
    logger.info('DIAGNOSTIC: Constructor called - testing Elasticsearch logging', {
      timestamp: new Date().toISOString(),
      testId: Math.random().toString(36).substr(2, 9)
    });
  }

  /**
   * Start the PDF analysis worker
   */
  async start(): Promise<void> {
    logger.info('DIAGNOSTIC: start() method called', {
      isRunning: this.isRunning,
      timestamp: new Date().toISOString()
    });

    if (this.isRunning) {
      logger.warn('PDF analysis worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        logger.info('DIAGNOSTIC: Initializing RabbitMQ service');
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF analysis worker...');

      // Start consuming messages from the analysis request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_ANALYSIS_REQUEST,
        this.handlePdfAnalysisRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER,
          noAck: false, // Manual acknowledgment
        }
      );

      this.isRunning = true;
      logger.info('DIAGNOSTIC: PDF analysis worker started successfully', {
        consumerTag: this.consumerTag,
        timestamp: new Date().toISOString()
      });
      
      // Test periodic Elasticsearch logging
      setInterval(() => {
        logger.info('DIAGNOSTIC: Periodic Elasticsearch test', {
          timestamp: new Date().toISOString(),
          isRunning: this.isRunning,
          consumerTag: this.consumerTag
        });
      }, 30000); // Every 30 seconds
      
    } catch (error) {
      logger.error('DIAGNOSTIC: Failed to start PDF analysis worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF analysis worker
   */
  async stop(): Promise<void> {
    logger.info('DIAGNOSTIC: stop() method called', {
      isRunning: this.isRunning,
      timestamp: new Date().toISOString()
    });

    if (!this.isRunning) {
      logger.warn('PDF analysis worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF analysis worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('DIAGNOSTIC: PDF analysis worker stopped successfully', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('DIAGNOSTIC: Failed to stop PDF analysis worker:', error);
      throw error;
    }
  }

  /**
   * Handle PDF analysis request
   */
  private async handlePdfAnalysisRequest(
    message: PdfAnalysisRequestMessage,
    originalMessage: any
  ): Promise<void> {
    logger.info(`DIAGNOSTIC: Processing PDF analysis request for item: ${message.itemId}`, {
      timestamp: new Date().toISOString(),
      messageId: message.messageId,
      eventType: message.eventType
    });

    try {
      // Process the analysis using the analyzer service
      await this.analyzerService.analyzePdf(message);

      logger.info(`DIAGNOSTIC: PDF analysis completed successfully for item: ${message.itemId}`, {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`DIAGNOSTIC: PDF analysis failed for item ${message.itemId}:`, error);
      throw error;
    }
  }

  /**
   * Check if the worker is running
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<{
    isRunning: boolean;
    consumerTag: string | null;
    rabbitMQConnected: boolean;
  }> {
    const stats = {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
    };
    
    logger.info('DIAGNOSTIC: Worker stats requested', {
      stats,
      timestamp: new Date().toISOString()
    });
    
    return stats;
  }
}

/**
 * Create and start a PDF analysis worker
 */
export async function createPdfAnalysisWorker(
  storage: AbstractLibraryStorage
): Promise<PdfAnalysisWorker> {
  logger.info('DIAGNOSTIC: createPdfAnalysisWorker called', {
    timestamp: new Date().toISOString()
  });
  
  const worker = new PdfAnalysisWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF analysis worker
 */
export async function stopPdfAnalysisWorker(worker: PdfAnalysisWorker): Promise<void> {
  logger.info('DIAGNOSTIC: stopPdfAnalysisWorker called', {
    timestamp: new Date().toISOString()
  });
  await worker.stop();
}

// Direct execution support
if (require.main === module) {
  const { S3ElasticSearchLibraryStorage } = require('../../knowledgeImport/library');
  
  async function main() {
    try {
      logger.info('DIAGNOSTIC: Main function started', {
        timestamp: new Date().toISOString()
      });
      
      // Create storage instance
      const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
      const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl, 1024);
      
      logger.info('DIAGNOSTIC: Storage instance created', {
        elasticsearchUrl,
        timestamp: new Date().toISOString()
      });
      
      // Create and start worker
      const worker = await createPdfAnalysisWorker(storage);
      logger.info('DIAGNOSTIC: PDF Analysis Worker started successfully');
      
      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('DIAGNOSTIC: Received SIGINT, shutting down gracefully...');
        await worker.stop();
        process.exit(0);
      });
      
      process.on('SIGTERM', async () => {
        logger.info('DIAGNOSTIC: Received SIGTERM, shutting down gracefully...');
        await worker.stop();
        process.exit(0);
      });
      
      // Keep the process running
      logger.info('DIAGNOSTIC: PDF Analysis Worker is running. Press Ctrl+C to stop.');
      
    } catch (error) {
      logger.error('DIAGNOSTIC: Failed to start PDF Analysis Worker:', error);
      process.exit(1);
    }
  }
  
  main().catch((error) => {
    logger.error('DIAGNOSTIC: Unhandled error:', error);
    process.exit(1);
  });
}