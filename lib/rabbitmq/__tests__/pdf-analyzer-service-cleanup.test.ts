import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PdfAnalyzerService,
  createPdfAnalyzerService,
} from '../pdf-analyzer.service';
import { AbstractLibraryStorage } from '../../../knowledgeBase/knowledgeImport/library';
import { getRabbitMQService } from '../rabbitmq.service';
import { deleteFromS3 } from '../../s3Service/S3Service';
import {
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  PdfPartStatus,
  PdfProcessingStatus,
} from '../message.types';

// Mock dependencies
vi.mock('../../s3Service/S3Service');
vi.mock('../rabbitmq.service');
vi.mock('../../logger', () => ({
  default: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('PdfAnalyzerService - Part Cleanup', () => {
  let pdfAnalyzerService: PdfAnalyzerService;
  let mockStorage: any;
  let mockRabbitMQService: any;
  let mockDeleteFromS3: any;
  let mockGetRabbitMQService: any;

  beforeEach(() => {
    // Get the mocked functions
    mockDeleteFromS3 = vi.mocked(deleteFromS3);
    mockGetRabbitMQService = vi.mocked(getRabbitMQService);

    // Create a mock storage
    mockStorage = {
      getMetadata: vi.fn(),
      updateMetadata: vi.fn(),
      saveMarkdown: vi.fn(),
      getMarkdown: vi.fn(),
      deleteItem: vi.fn(),
      searchItems: vi.fn(),
      getItems: vi.fn(),
      updateItem: vi.fn(),
      createItem: vi.fn(),
      getChunk: vi.fn(),
      saveChunk: vi.fn(),
      deleteChunks: vi.fn(),
      searchChunks: vi.fn(),
      getDenseVectorIndexGroup: vi.fn(),
      saveDenseVectorIndexGroup: vi.fn(),
      deleteDenseVectorIndexGroup: vi.fn(),
      searchDenseVectorIndexGroups: vi.fn(),
      getEntity: vi.fn(),
      saveEntity: vi.fn(),
      deleteEntity: vi.fn(),
      searchEntities: vi.fn(),
      getKnowledge: vi.fn(),
      saveKnowledge: vi.fn(),
      deleteKnowledge: vi.fn(),
      searchKnowledge: vi.fn(),
      getEntityRelationships: vi.fn(),
      saveEntityRelationship: vi.fn(),
      deleteEntityRelationship: vi.fn(),
      searchEntityRelationships: vi.fn(),
    } as any;

    // Create a mock RabbitMQ service
    mockRabbitMQService = {
      isConnected: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      consumeMessages: vi.fn().mockResolvedValue('mock-consumer-tag'),
      stopConsuming: vi.fn().mockResolvedValue(undefined),
    };

    // Mock the getRabbitMQService function
    mockGetRabbitMQService.mockReturnValue(mockRabbitMQService);

    // Create the service instance
    pdfAnalyzerService = new PdfAnalyzerService(mockStorage);

    // Mock the deleteFromS3 function
    mockDeleteFromS3.mockResolvedValue(true);
  });

  afterEach(async () => {
    // Stop the service if it's running
    if (pdfAnalyzerService.isServiceRunning()) {
      await pdfAnalyzerService.stop();
    }
    vi.clearAllMocks();
  });

  describe('Service Lifecycle', () => {
    it('should start the service successfully', async () => {
      await pdfAnalyzerService.start();

      expect(pdfAnalyzerService.isServiceRunning()).toBe(true);
      // Note: initialize might not be called if the service is already connected
      expect(mockRabbitMQService.consumeMessages).toHaveBeenCalledTimes(2); // For completed and failed queues
    });

    it('should stop the service successfully', async () => {
      await pdfAnalyzerService.start();
      await pdfAnalyzerService.stop();

      expect(pdfAnalyzerService.isServiceRunning()).toBe(false);
      expect(mockRabbitMQService.stopConsuming).toHaveBeenCalledTimes(2);
    });

    it('should not start if already running', async () => {
      await pdfAnalyzerService.start();
      
      // Reset the mock to track subsequent calls
      mockRabbitMQService.initialize.mockClear();
      
      // Try to start again
      await pdfAnalyzerService.start();

      // Should not initialize again
      expect(mockRabbitMQService.initialize).not.toHaveBeenCalled();
    });
  });

  describe('PDF Part Conversion Completed Handler', () => {
    beforeEach(async () => {
      await pdfAnalyzerService.start();
    });

    it('should handle PDF part conversion completed message and delete S3 file', async () => {
      const itemId = 'test-item-id';
      const partIndex = 1;
      const s3Key = 'test-file_part_1_1-25.pdf';

      // Mock the item metadata with splitting info
      const mockMetadata = {
        itemId,
        pdfSplittingInfo: {
          itemId,
          originalFileName: 'test-file.pdf',
          totalParts: 2,
          parts: [
            {
              partIndex: 0,
              startPage: 0,
              endPage: 24,
              pageCount: 25,
              s3Key: 'test-file_part_1_1-25.pdf',
              status: PdfPartStatus.PENDING,
            },
            {
              partIndex: 1,
              startPage: 25,
              endPage: 49,
              pageCount: 25,
              s3Key: s3Key,
              status: PdfPartStatus.PENDING,
            },
          ],
        },
      };

      mockStorage.getMetadata.mockResolvedValue(mockMetadata);
      mockStorage.updateMetadata.mockResolvedValue(undefined);

      // Create the completed message
      const completedMessage: PdfPartConversionCompletedMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_COMPLETED',
        itemId,
        partIndex,
        totalParts: 2,
        markdownContent: 'Test markdown content',
        pageCount: 25,
        processingTime: 5000,
      };

      // Get the handler function that was registered
      const completedHandler = mockRabbitMQService.consumeMessages.mock.calls[0][1];
      await completedHandler(completedMessage, null);

      // Verify the part status was updated
      expect(mockStorage.updateMetadata).toHaveBeenCalled();
      const updatedMetadata = mockStorage.updateMetadata.mock.calls[0][0];
      expect(updatedMetadata.pdfSplittingInfo.parts[1].status).toBe(PdfPartStatus.COMPLETED);
      expect(updatedMetadata.pdfSplittingInfo.parts[1].processingTime).toBe(5000);

      // Verify the S3 file was deleted
      expect(deleteFromS3).toHaveBeenCalledWith(s3Key);
    });

    it('should handle missing item metadata gracefully', async () => {
      const itemId = 'non-existent-item';

      mockStorage.getMetadata.mockResolvedValue(null);

      const completedMessage: PdfPartConversionCompletedMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_COMPLETED',
        itemId,
        partIndex: 0,
        totalParts: 1,
        markdownContent: 'Test markdown content',
        pageCount: 25,
        processingTime: 5000,
      };

      const completedHandler = mockRabbitMQService.consumeMessages.mock.calls[0][1];
      await completedHandler(completedMessage, null);

      // Should not try to delete or update
      expect(mockStorage.updateMetadata).not.toHaveBeenCalled();
      expect(deleteFromS3).not.toHaveBeenCalled();
    });

    it('should handle missing splitting info gracefully', async () => {
      const itemId = 'test-item-id';

      // Mock metadata without splitting info
      const mockMetadata = {
        itemId,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
      };

      mockStorage.getMetadata.mockResolvedValue(mockMetadata);

      const completedMessage: PdfPartConversionCompletedMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_COMPLETED',
        itemId,
        partIndex: 0,
        totalParts: 1,
        markdownContent: 'Test markdown content',
        pageCount: 25,
        processingTime: 5000,
      };

      const completedHandler = mockRabbitMQService.consumeMessages.mock.calls[0][1];
      await completedHandler(completedMessage, null);

      // Should not try to delete or update
      expect(mockStorage.updateMetadata).not.toHaveBeenCalled();
      expect(deleteFromS3).not.toHaveBeenCalled();
    });
  });

  describe('PDF Part Conversion Failed Handler', () => {
    beforeEach(async () => {
      await pdfAnalyzerService.start();
    });

    it('should handle PDF part conversion failed message and delete S3 file', async () => {
      const itemId = 'test-item-id';
      const partIndex = 1;
      const s3Key = 'test-file_part_2_26-50.pdf';
      const errorMessage = 'Conversion failed due to timeout';

      // Mock the item metadata with splitting info
      const mockMetadata = {
        itemId,
        pdfSplittingInfo: {
          itemId,
          originalFileName: 'test-file.pdf',
          totalParts: 2,
          parts: [
            {
              partIndex: 0,
              startPage: 0,
              endPage: 24,
              pageCount: 25,
              s3Key: 'test-file_part_1_1-25.pdf',
              status: PdfPartStatus.COMPLETED,
            },
            {
              partIndex: 1,
              startPage: 25,
              endPage: 49,
              pageCount: 25,
              s3Key: s3Key,
              status: PdfPartStatus.PENDING,
            },
          ],
        },
      };

      mockStorage.getMetadata.mockResolvedValue(mockMetadata);
      mockStorage.updateMetadata.mockResolvedValue(undefined);

      // Create the failed message
      const failedMessage: PdfPartConversionFailedMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_FAILED',
        itemId,
        partIndex,
        totalParts: 2,
        error: errorMessage,
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 3000,
      };

      // Get the handler function that was registered
      const failedHandler = mockRabbitMQService.consumeMessages.mock.calls[1][1];
      await failedHandler(failedMessage, null);

      // Verify the part status was updated
      expect(mockStorage.updateMetadata).toHaveBeenCalled();
      const updatedMetadata = mockStorage.updateMetadata.mock.calls[0][0];
      expect(updatedMetadata.pdfSplittingInfo.parts[1].status).toBe(PdfPartStatus.FAILED);
      expect(updatedMetadata.pdfSplittingInfo.parts[1].error).toBe(errorMessage);
      expect(updatedMetadata.pdfSplittingInfo.parts[1].processingTime).toBe(3000);

      // Verify the S3 file was deleted even though conversion failed
      expect(deleteFromS3).toHaveBeenCalledWith(s3Key);
    });
  });

  describe('S3 Deletion Error Handling', () => {
    beforeEach(async () => {
      await pdfAnalyzerService.start();
    });

    it('should handle S3 deletion errors gracefully', async () => {
      const itemId = 'test-item-id';
      const partIndex = 0;
      const s3Key = 'test-file_part_1_1-25.pdf';

      // Mock the item metadata with splitting info
      const mockMetadata = {
        itemId,
        pdfSplittingInfo: {
          itemId,
          originalFileName: 'test-file.pdf',
          totalParts: 1,
          parts: [
            {
              partIndex: 0,
              startPage: 0,
              endPage: 24,
              pageCount: 25,
              s3Key: s3Key,
              status: PdfPartStatus.PENDING,
            },
          ],
        },
      };

      mockStorage.getMetadata.mockResolvedValue(mockMetadata);
      mockStorage.updateMetadata.mockResolvedValue(undefined);

      // Mock S3 deletion to fail
      mockDeleteFromS3.mockRejectedValue(new Error('S3 deletion failed'));

      const completedMessage: PdfPartConversionCompletedMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_COMPLETED',
        itemId,
        partIndex,
        totalParts: 1,
        markdownContent: 'Test markdown content',
        pageCount: 25,
        processingTime: 5000,
      };

      const completedHandler = mockRabbitMQService.consumeMessages.mock.calls[0][1];
      
      // Should not throw an error even if S3 deletion fails
      await expect(completedHandler(completedMessage, null)).resolves.not.toThrow();

      // Should still update the metadata
      expect(mockStorage.updateMetadata).toHaveBeenCalled();
    });
  });
});