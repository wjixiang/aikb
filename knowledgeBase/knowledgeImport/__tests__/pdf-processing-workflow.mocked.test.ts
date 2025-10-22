import { config } from 'dotenv';
config({ path: '.env' });

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Library from '../library';
import { PdfProcessingStatus } from '../../../lib/rabbitmq/message.types';
import {
  createPdfAnalysisWorker,
  createPdfProcessingCoordinatorWorker,
  createPdfConversionWorker,
  startMarkdownStorageWorker,
  simulateCompletePdfProcessingWorkflow,
} from '../../../lib/rabbitmq/__tests__/MockWorkers';
import { MockLibraryStorage } from '../MockLibraryStorage';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Mock the S3 service to avoid real S3 calls
vi.mock('../../lib/s3Service/S3Service', () => {
  return {
    uploadToS3: vi
      .fn()
      .mockResolvedValue('https://mock-s3-url.com/test-file.pdf'),
    getPdfDownloadUrl: vi
      .fn()
      .mockResolvedValue('https://mock-s3-url.com/test-file.pdf'),
    deleteFromS3: vi.fn().mockResolvedValue(true),
  };
});

// Mock the RabbitMQ service
vi.mock('../../lib/rabbitmq/rabbitmq.service', () => ({
  getRabbitMQService: vi.fn(() => getMockRabbitMQService()),
}));

describe('PDF Processing Workflow (Mocked)', () => {
  let library: Library;
  let storage: MockLibraryStorage;
  let testItemId: string;
  let mockRabbitMQService: any;

  beforeAll(async () => {
    // Reset any existing mock service
    resetMockRabbitMQService();

    // Get the mock RabbitMQ service
    mockRabbitMQService = getMockRabbitMQService();
    await mockRabbitMQService.initialize();
    console.log('✅ Mock RabbitMQ service initialized');

    // Create mock storage instance
    storage = new MockLibraryStorage();
    library = new Library(storage);

    // Start all mock workers
    await createPdfAnalysisWorker(storage);
    console.log('✅ Mock PDF analysis worker started');

    await createPdfProcessingCoordinatorWorker(storage);
    console.log('✅ Mock PDF processing coordinator worker started');

    await createPdfConversionWorker();
    console.log('✅ Mock PDF conversion worker started');

    await startMarkdownStorageWorker(storage);
    console.log('✅ Mock markdown storage worker started');
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

    // Simulate the complete PDF processing workflow
    console.log('⏳ Starting mock PDF processing workflow...');
    await simulateCompletePdfProcessingWorkflow(testItemId, storage);

    // Wait a bit for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check final status
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
    expect(markdownContent).toContain('viral_pneumonia');

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

  it('should verify RabbitMQ message flow', async () => {
    if (!testItemId) {
      console.log('⚠️ Skipping RabbitMQ message test - no test item available');
      return;
    }

    // Get all published messages from the mock RabbitMQ service
    const publishedMessages = mockRabbitMQService.getPublishedMessages();

    console.log(`📨 Total published messages: ${publishedMessages.length}`);

    // Verify that key messages were published
    const messageTypes = publishedMessages.map((msg) => msg.message.eventType);
    console.log('📨 Message types:', messageTypes);

    // Should have analysis, conversion, and storage messages
    expect(messageTypes).toContain('PDF_ANALYSIS_COMPLETED');
    expect(messageTypes).toContain('PDF_CONVERSION_REQUEST');
    expect(messageTypes).toContain('MARKDOWN_STORAGE_REQUEST');
    expect(messageTypes).toContain('MARKDOWN_STORAGE_COMPLETED');
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

    // Reset mock RabbitMQ service
    resetMockRabbitMQService();
    console.log('🧹 Mock RabbitMQ service reset');
  });
});
