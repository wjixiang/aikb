import { config } from 'dotenv';
import { PdfAnalyzerService } from './pdf-analysis.service';
import { BibliographyApiClient } from './bibliography-api.client';
import createLoggerWithPrefix from 'log-management/logger';

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

  constructor(apiClient: BibliographyApiClient) {
    this.analyzerService = new PdfAnalyzerService(apiClient);
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
      // await this.analyzerService.start();

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
      // await this.analyzerService.stop();

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
    // Initialize API client for bibliography service
    const bibliographyServiceUrl =
      process.env.BIBLIOGRAPHY_SERVICE_URL || 'http://localhost:3000';
    const apiClient = new BibliographyApiClient(bibliographyServiceUrl);

    const worker = new PdfAnalysisWorker(apiClient);
    await worker.start();
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
