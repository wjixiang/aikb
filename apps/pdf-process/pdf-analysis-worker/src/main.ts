import { config } from 'dotenv';
import { PdfAnalyzerService, createPdfAnalyzerService } from './pdf-analysis.service';
import { ILibraryStorage, MockLibraryStorage } from '@aikb/bibliography';
import createLoggerWithPrefix from '@aikb/log-management/logger';

// Load environment variables
config();

const logger = createLoggerWithPrefix('PdfAnalysisWorker');

/**
 * PDF Analysis Worker
 * Analyzes PDF files to determine if they need to be split
 */
class PdfAnalysisWorker {
  private analyzerService: PdfAnalyzerService;
  private isRunning = false;

  constructor(storage: ILibraryStorage) {
    this.analyzerService = new PdfAnalyzerService(storage);
  }

  /**
   * Start the PDF analysis worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF analysis worker is already running');
      return;
    }

    try {
      logger.info('Starting PDF analysis worker...');
      
      // Start the analyzer service
      await this.analyzerService.start();

      this.isRunning = true;
      logger.info('PDF analysis worker started successfully');
    } catch (error) {
      logger.error('Failed to start PDF analysis worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF analysis worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF analysis worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF analysis worker...');
      this.isRunning = false;
      
      // Stop the analyzer service
      await this.analyzerService.stop();
      
      logger.info('PDF analysis worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF analysis worker:', error);
      throw error;
    }
  }
}

/**
 * Main function to start the PDF analysis worker
 */
async function main(): Promise<void> {
  try {
    // Initialize storage (this would be injected via dependency injection in a real app)
    // For now, we'll use the mock storage from the bibliography library
    const storage = new MockLibraryStorage();
    
    const worker = new PdfAnalysisWorker(storage);
    await worker.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await worker.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await worker.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start PDF analysis worker:', error);
    process.exit(1);
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  main();
}

export { PdfAnalysisWorker };