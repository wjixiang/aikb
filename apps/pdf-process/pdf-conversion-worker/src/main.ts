import { config } from 'dotenv';
import {
  PdfConversionWorker,
  createPdfConversionWorker,
} from './pdf-conversion.worker';

// Load environment variables
config();

/**
 * Main entry point for the PDF conversion worker microservice
 */
async function main(): Promise<void> {
  try {
    // Create and start worker
    const worker = await createPdfConversionWorker();

    console.log('PDF Conversion Worker started successfully');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await worker.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      await worker.stop();
      process.exit(0);
    });

    // Keep the process running
    console.log('PDF Conversion Worker is running. Press Ctrl+C to stop.');

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start PDF Conversion Worker:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { main };
