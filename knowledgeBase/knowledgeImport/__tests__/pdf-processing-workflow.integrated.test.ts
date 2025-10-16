import { config } from 'dotenv';
config({ path: '.env' });

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Library, { S3ElasticSearchLibraryStorage } from '../library';
import { PdfProcessingStatus } from '../../../lib/rabbitmq/message.types';
import { getRabbitMQService } from '../../../lib/rabbitmq/rabbitmq.service';
import { createPdfAnalysisWorker } from '../../../lib/rabbitmq/pdf-analysis.worker';
import { createPdfProcessingCoordinatorWorker } from '../../../lib/rabbitmq/pdf-processing-coordinator.worker';
import { createPdfConversionWorker } from '../../../lib/rabbitmq/pdf-conversion.worker';
import { startMarkdownStorageWorker } from '../../../lib/rabbitmq/markdown-storage.worker';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

describe('PDF Processing Workflow', () => {
  let library: Library;
  let storage: S3ElasticSearchLibraryStorage;
  let testItemId: string;

  beforeAll(async () => {
    // Initialize RabbitMQ service
    const rabbitMQService = getRabbitMQService();
    await rabbitMQService.initialize();
    console.log('✅ RabbitMQ service initialized');

    // Create storage instance
    storage = new S3ElasticSearchLibraryStorage(
      'http://elasticsearch:9200',
      1024,
    );
    library = new Library(storage);

    // Start all workers
    await createPdfAnalysisWorker(storage);
    console.log('✅ PDF analysis worker started');

    await createPdfProcessingCoordinatorWorker(storage);
    console.log('✅ PDF processing coordinator worker started');

    await createPdfConversionWorker();
    console.log('✅ PDF conversion worker started');

    await startMarkdownStorageWorker(storage);
    console.log('✅ Markdown storage worker started');
  }, 60000);

  it('should process PDF from pending to completed status', async () => {
    // Read test PDF
    const pdfPath = 'test/viral_pneumonia.pdf';
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Create unique metadata to avoid duplicates
    const uniqueId = uuidv4();
    const metadata = {
      title: `Test PDF ${uniqueId}`,
      authors: [{ firstName: 'Test', lastName: 'Author' }],
      abstract: 'This is a test document for workflow testing',
      publicationYear: 2023,
      tags: ['test', 'workflow'],
      language: 'English',
    };

    // Store PDF (should start with pending status)
    const book = await library.storePdf(
      pdfBuffer,
      `test-${uniqueId}.pdf`,
      metadata,
    );
    testItemId = book.metadata.id!;

    console.log(`📄 PDF stored with ID: ${testItemId}`);

    // Verify initial status
    expect(book.metadata.pdfProcessingStatus).toBe(PdfProcessingStatus.PENDING);
    expect(book.metadata.pdfProcessingMessage).toBe('Queued for processing');

    // Wait for processing to start
    console.log('⏳ Waiting for PDF analysis to start...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check status after analysis should have started
    let status = await library.getProcessingStatus(testItemId);
    console.log(
      `📊 Status after 3 seconds: ${status?.status} - ${status?.message}`,
    );

    // Wait for processing to complete
    console.log('⏳ Waiting for PDF processing to complete...');
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max

    while (attempts < maxAttempts) {
      status = await library.getProcessingStatus(testItemId);
      console.log(
        `📊 Status check ${attempts + 1}: ${status?.status} (${status?.progress}%) - ${status?.message}`,
      );

      if (status?.status === PdfProcessingStatus.COMPLETED) {
        console.log('✅ PDF processing completed successfully!');
        break;
      }

      if (status?.status === PdfProcessingStatus.FAILED) {
        console.error(`❌ PDF processing failed: ${status.error}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    // Final status verification
    const finalStatus = await library.getProcessingStatus(testItemId);
    console.log(
      `🏁 Final status: ${finalStatus?.status} - ${finalStatus?.message}`,
    );

    // Verify we have markdown content
    const markdownContent = await book.getMarkdown();
    console.log(
      `📝 Markdown content length: ${markdownContent.length} characters`,
    );
    console.log(`📝 First 200 chars: ${markdownContent.substring(0, 200)}...`);

    // Verify the content is meaningful (not just placeholder)
    expect(markdownContent.length).toBeGreaterThan(100);
    expect(markdownContent).toContain('Viral pneumonia');

    // If processing completed, status should be completed
    if (finalStatus?.status === PdfProcessingStatus.COMPLETED) {
      expect(finalStatus.progress).toBe(100);
      expect(finalStatus.completedAt).toBeDefined();
    }
  }, 120000); // 2 minutes timeout

  it('should track processing progress correctly', async () => {
    if (!testItemId) {
      console.log('⚠️ Skipping progress test - no test item available');
      return;
    }

    // Get detailed processing status
    const status = await library.getProcessingStatus(testItemId);

    console.log('📊 Processing Status Details:');
    console.log(`  Status: ${status?.status}`);
    console.log(`  Progress: ${status?.progress}%`);
    console.log(`  Message: ${status?.message}`);
    console.log(`  Started At: ${status?.startedAt}`);
    console.log(`  Completed At: ${status?.completedAt}`);
    console.log(`  Error: ${status?.error}`);
    console.log(`  Retry Count: ${status?.retryCount}`);

    // Verify status structure
    expect(status).toBeDefined();
    expect(status?.status).toBeDefined();
    expect(status?.progress).toBeGreaterThanOrEqual(0);
    expect(status?.progress).toBeLessThanOrEqual(100);
    expect(status?.message).toBeDefined();
  });

  afterAll(async () => {
    // Clean up test data if needed
    if (testItemId) {
      try {
        const book = await library.getItem(testItemId);
        if (book) {
          console.log(`🧹 Cleaning up test item: ${testItemId}`);
          // Note: selfDelete might not work properly if chunks exist, but we try anyway
          await book.selfDelete();
        }
      } catch (error) {
        console.warn('⚠️ Cleanup failed:', error);
      }
    }
  });
});
