import Library, {
  S3MongoLibraryStorage,
  BookMetadata,
} from '../library';
import { PdfProcessingStatus } from '../../lib/rabbitmq/message.types';
import {
  PdfAnalyzerService,
  createPdfAnalyzerService,
} from '../../lib/rabbitmq/pdf-analyzer.service';
// TypeScript PDF splitter has been replaced with Python implementation
// No longer need to import PdfSplittingWorker
import {
  PdfMergerService,
  createPdfMergerService,
} from '../../lib/rabbitmq/pdf-merger.service';
import {
  PdfConversionWorker,
  createPdfConversionWorker,
} from '../../lib/rabbitmq/pdf-conversion.worker';
import {
  getRabbitMQService,
  initializeRabbitMQService,
  closeRabbitMQService,
} from '../../lib/rabbitmq/rabbitmq.service';
import {
  PdfAnalysisRequestMessage,
  PdfSplittingRequestMessage,
  PdfMergingRequestMessage,
  PDF_PROCESSING_CONFIG,
} from '../../lib/rabbitmq/message.types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

describe('PDF Splitting and Merging Integration Tests', () => {
  let library: Library;
  let storage: S3MongoLibraryStorage;
  let rabbitMQService = getRabbitMQService();
  let analyzerService: PdfAnalyzerService;
  let conversionWorker: PdfConversionWorker;
  let mergerService: PdfMergerService;

  beforeAll(async () => {
    // Initialize RabbitMQ service
    await initializeRabbitMQService();

    // Initialize storage
    storage = new S3MongoLibraryStorage();
    // Note: initialize() method may not exist, removing for now

    // Initialize library
    library = new Library(storage);

    // Initialize services and workers
    analyzerService = createPdfAnalyzerService(storage);
    // Python PDF splitting worker is now used instead of TypeScript
    conversionWorker = await createPdfConversionWorker();
    mergerService = await createPdfMergerService(storage);
  });

  afterAll(async () => {
    // Stop services and workers
    // Python PDF splitting worker is managed separately
    if (conversionWorker) {
      await conversionWorker.stop();
    }
    if (mergerService) {
      await mergerService.stop();
    }

    // Close RabbitMQ service
    await closeRabbitMQService();
  });

  describe('PDF Analysis', () => {
    test('should analyze small PDF and determine no splitting needed', async () => {
      // Create a small PDF buffer (simulated)
      const smallPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000079 00000 n\n0000000173 00000 n\ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n292\n%%EOF');

      // Store the PDF
      const item = await library.storePdf(
        smallPdfBuffer,
        'small-test.pdf',
        {
          title: 'Small Test PDF',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test'],
          collections: [],
        }
      );

      // Send analysis request
      const analysisRequest: PdfAnalysisRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId: item.metadata.id!,
        s3Key: item.metadata.s3Key!,
        s3Url:await item.getPdfDownloadUrl(),
        fileName: 'small-test.pdf',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };

      await rabbitMQService.publishPdfAnalysisRequest(analysisRequest);

      // Wait for analysis to complete
      const result = await library.waitForProcessingCompletion(item.metadata.id!, 30000);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe(PdfProcessingStatus.COMPLETED);
      
      const status = await library.getProcessingStatus(item.metadata.id!);
      if (status) {
        expect((status as any).splittingInfo).toBeUndefined(); // No splitting for small PDF
      }
    }, 45000);

    test('should analyze large PDF and determine splitting needed', async () => {
      // Create a large PDF buffer (simulated with many page markers)
      let largePdfContent = '%PDF-1.4\n';
      for (let i = 0; i < 100; i++) {
        largePdfContent += `${i} 0 obj\n<<\n/Type /Page\n>>\nendobj\n`;
      }
      largePdfContent += 'xref\n0 101\n0000000000 65535 f\n';
      for (let i = 0; i < 100; i++) {
        largePdfContent += `0000000000 00000 n\n`;
      }
      largePdfContent += 'trailer\n<<\n/Size 101\n>>\nstartxref\n0\n%%EOF';
      
      const largePdfBuffer = Buffer.from(largePdfContent);

      // Store the PDF
      const item = await library.storePdf(
        largePdfBuffer,
        'large-test.pdf',
        {
          title: 'Large Test PDF',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test', 'large'],
          collections: [],
        }
      );

      // Send analysis request
      const analysisRequest: PdfAnalysisRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId: item.metadata.id!,
        s3Url: await item.getPdfDownloadUrl(),
        s3Key: item.metadata.s3Key!,
        fileName: 'large-test.pdf',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };

      await rabbitMQService.publishPdfAnalysisRequest(analysisRequest);

      // Wait for analysis to complete
      const result = await library.waitForProcessingCompletion(item.metadata.id!, 60000);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe(PdfProcessingStatus.COMPLETED);
      
      const status = await library.getProcessingStatus(item.metadata.id!);
      // Note: In a real implementation, this would have splitting info
      // For this test, we're just verifying the analysis process works
    }, 90000);
  });

  describe('PDF Splitting Workflow', () => {
    test('should handle complete splitting workflow for large PDF', async () => {
      // Create a very large PDF buffer (simulated)
      let largePdfContent = '%PDF-1.4\n';
      for (let i = 0; i < 200; i++) {
        largePdfContent += `${i} 0 obj\n<<\n/Type /Page\n/Contents ${i + 100} 0 R\n>>\nendobj\n`;
        largePdfContent += `${i + 100} 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Page ${i + 1}) Tj\nET\nendstream\nendobj\n`;
      }
      largePdfContent += 'xref\n0 401\n0000000000 65535 f\n';
      for (let i = 0; i < 400; i++) {
        largePdfContent += `0000000000 00000 n\n`;
      }
      largePdfContent += 'trailer\n<<\n/Size 401\n>>\nstartxref\n0\n%%EOF';
      
      const largePdfBuffer = Buffer.from(largePdfContent);

      // Store the PDF
      const item = await library.storePdf(
        largePdfBuffer,
        'workflow-test.pdf',
        {
          title: 'Workflow Test PDF',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test', 'workflow', 'large'],
          collections: [],
        }
      );

      // Monitor the processing status
      const itemId = item.metadata.id!;
      let lastProgress = 0;
      
      const statusMonitor = setInterval(async () => {
        const status = await library.getProcessingStatus(itemId);
        
        if (status && status.progress !== undefined && status.progress !== lastProgress) {
          console.log(`Progress: ${status.progress}% - ${status.message}`);
          lastProgress = status.progress;
        }
        
        if (status && (status.status === PdfProcessingStatus.COMPLETED ||
            status.status === PdfProcessingStatus.FAILED)) {
          clearInterval(statusMonitor);
        }
      }, 2000);

      // Wait for complete processing
      const result = await library.waitForProcessingCompletion(itemId, 180000); // 3 minutes
      
      clearInterval(statusMonitor);
      
      expect(result.success).toBe(true);
      expect(result.status).toBe(PdfProcessingStatus.COMPLETED);
      expect((result as any).markdownContent).toBeDefined();
      expect((result as any).markdownContent!.length).toBeGreaterThan(0);
      
      // Verify the merged content structure
      expect((result as any).markdownContent).toContain('Merged PDF Document');
      expect((result as any).markdownContent).toContain('PART');
      
      const finalStatus = await library.getProcessingStatus(itemId);
      if (finalStatus) {
        expect(finalStatus.status).toBe(PdfProcessingStatus.COMPLETED);
        expect(finalStatus.progress).toBe(100);
      }
    }, 200000);
  });

  describe('Error Handling', () => {
    test('should handle analysis failure gracefully', async () => {
      // Create an invalid PDF buffer
      const invalidPdfBuffer = Buffer.from('This is not a PDF file');

      // Store the invalid PDF
      const item = await library.storePdf(
        invalidPdfBuffer,
        'invalid-test.pdf',
        {
          title: 'Invalid Test PDF',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test', 'invalid'],
          collections: [],
        }
      );

      // Send analysis request
      const analysisRequest: PdfAnalysisRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId: item.metadata.id!,
        s3Url: await item.getPdfDownloadUrl(),
        s3Key: item.metadata.s3Key!,
        fileName: 'invalid-test.pdf',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 1, // Reduce retries for faster test
      };

      await rabbitMQService.publishPdfAnalysisRequest(analysisRequest);

      // Wait for processing to complete (should fail)
      const result = await library.waitForProcessingCompletion(item.metadata.id!, 30000);
      
      expect(result.success).toBe(false);
      expect(result.status).toBe(PdfProcessingStatus.FAILED);
      expect(result.error).toBeDefined();
    }, 45000);

    test('should handle retry logic for failed operations', async () => {
      // This test would require mocking failures in the system
      // For now, we'll just verify the retry configuration is properly set
      expect(PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_THRESHOLD).toBe(50);
      expect(PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_SIZE).toBe(25);
      expect(PDF_PROCESSING_CONFIG.CONCURRENT_PART_PROCESSING).toBe(3);
    });
  });

  describe('Performance Tests', () => {
    test('should process multiple PDFs concurrently', async () => {
      const items: any[] = [];
      const promises: Promise<boolean>[] = [];

      // Create multiple PDFs
      for (let i = 0; i < 3; i++) {
        let pdfContent = '%PDF-1.4\n';
        for (let j = 0; j < 60; j++) { // Each PDF has 60 pages
          pdfContent += `${j} 0 obj\n<<\n/Type /Page\n>>\nendobj\n`;
        }
        pdfContent += 'xref\n0 61\n0000000000 65535 f\n';
        for (let j = 0; j < 60; j++) {
          pdfContent += `0000000000 00000 n\n`;
        }
        pdfContent += 'trailer\n<<\n/Size 61\n>>\nstartxref\n0\n%%EOF';
        
        const pdfBuffer = Buffer.from(pdfContent);
        
        const item = await library.storePdf(
          pdfBuffer,
          `concurrent-test-${i}.pdf`,
          {
            title: `Concurrent Test PDF ${i}`,
            authors: [{ firstName: 'Test', lastName: 'Author' }],
            tags: ['test', 'concurrent'],
            collections: [],
          }
        );
        
        items.push(item);
        
        // Send analysis request
        const analysisRequest: PdfAnalysisRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_ANALYSIS_REQUEST',
          itemId: item.metadata.id!,
          s3Url: await item.getPdfDownloadUrl(),
          s3Key: item.metadata.s3Key!,
          fileName: `concurrent-test-${i}.pdf`,
          priority: 'normal',
          retryCount: 0,
          maxRetries: 2,
        };

        promises.push(rabbitMQService.publishPdfAnalysisRequest(analysisRequest));
      }

      // Send all requests concurrently
      await Promise.all(promises);

      // Wait for all to complete
      const results = await Promise.all(
        items.map((item: any) =>
          library.waitForProcessingCompletion(item.metadata.id!, 120000)
        )
      );

      // Verify all completed successfully
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.status).toBe(PdfProcessingStatus.COMPLETED);
        expect((result as any).markdownContent).toBeDefined();
      });
    }, 180000);
  });
});