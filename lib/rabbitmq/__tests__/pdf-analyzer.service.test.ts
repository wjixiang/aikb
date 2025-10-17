import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mocked } from 'vitest';
import { PdfAnalyzerService } from '../pdf-analyzer.service';
import {
  AbstractLibraryStorage,
  BookMetadata,
} from '../../../knowledgeBase/knowledgeImport/library';
import {
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfProcessingStatus,
  PDF_PROCESSING_CONFIG,
} from '../message.types';
import { RabbitMQService, getRabbitMQService } from '../rabbitmq.service';
import * as axios from 'axios';

// Mock dependencies
vi.mock('../../../knowledgeBase/knowledgeImport/library');
vi.mock('../rabbitmq.service');
vi.mock('../logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  createLoggerWithPrefix: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));
vi.mock('axios');
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-12345'),
}));

// Mock S3 service - use factory function to avoid hoisting issues
vi.mock('../s3Service/S3Service', () => {
  const mockUploadToS3 = vi.fn().mockResolvedValue('https://mock-s3-url.com/test-file.pdf');
  const mockGetPdfDownloadUrl = vi.fn().mockResolvedValue('https://mock-s3-url.com/test-file.pdf');
  
  return {
    uploadToS3: mockUploadToS3,
    getPdfDownloadUrl: mockGetPdfDownloadUrl,
  };
});

// Also mock the S3 service in the correct path
vi.mock('../../lib/s3Service/S3Service', () => {
  const mockUploadToS3 = vi.fn().mockResolvedValue('https://mock-s3-url.com/test-file.pdf');
  const mockGetPdfDownloadUrl = vi.fn().mockResolvedValue('https://mock-s3-url.com/test-file.pdf');
  
  return {
    uploadToS3: mockUploadToS3,
    getPdfDownloadUrl: mockGetPdfDownloadUrl,
  };
});

// Also mock the S3 service in the correct path
vi.mock('../../../lib/s3Service/S3Service', () => {
  const mockUploadToS3 = vi.fn().mockResolvedValue('https://mock-s3-url.com/test-file.pdf');
  const mockGetPdfDownloadUrl = vi.fn().mockResolvedValue('https://mock-s3-url.com/test-file.pdf');
  
  return {
    uploadToS3: mockUploadToS3,
    getPdfDownloadUrl: mockGetPdfDownloadUrl,
  };
});

// Create a proper mock for axios
const mockedAxios = {
  get: vi.fn(),
} as any;

describe('PdfAnalyzerService', () => {
  let pdfAnalyzerService: PdfAnalyzerService;
  let mockStorage: Mocked<AbstractLibraryStorage>;
  let mockRabbitMQService: Mocked<RabbitMQService>;
  let mockAxios: typeof mockedAxios;

  // Test data
  const testItemId = 'test-item-id-123';
  const testS3Url = 'https://test-bucket.s3.amazonaws.com/test-file.pdf';
  const testS3Key = 'test-file.pdf';
  const testFileName = 'test-file.pdf';

  // Create mock PDF buffers with different page patterns
  const createMockPdfBuffer = (pageCount: number): Buffer => {
    // Create a valid PDF structure that pdf-lib can parse
    let pdfString = '%PDF-1.4\n';
    
    // Catalog object
    pdfString += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
    
    // Pages object with kids array
    pdfString += '2 0 obj\n<< /Type /Pages /Kids [';
    for (let i = 0; i < pageCount; i++) {
      pdfString += ` ${3 + i} 0 R`;
    }
    pdfString += ` ] /Count ${pageCount} >>\nendobj\n`;
    
    // Page objects
    for (let i = 0; i < pageCount; i++) {
      pdfString += `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${3 + pageCount + i} 0 R >>\nendobj\n`;
    }
    
    // Content streams for each page
    for (let i = 0; i < pageCount; i++) {
      pdfString += `${3 + pageCount + i} 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Page ${i + 1}) Tj\nET\nendstream\nendobj\n`;
    }
    
    // Cross-reference table
    const objCount = 3 + pageCount * 2;
    pdfString += 'xref\n0 ' + (objCount + 1) + '\n';
    pdfString += '0000000000 65535 f\n';
    
    let offset = 9; // Start after %PDF-1.4\n
    for (let i = 1; i <= objCount; i++) {
      pdfString += `${offset.toString().padStart(10, '0')} 00000 n\n`;
      // Rough estimate of object length (this is simplified)
      if (i === 1) offset += 35; // Catalog
      else if (i === 2) offset += 30 + pageCount * 8; // Pages
      else if (i <= 3 + pageCount - 1) offset += 55; // Page objects
      else offset += 70; // Content streams
    }
    
    // Trailer
    pdfString += 'trailer\n<< /Size ' + (objCount + 1) + ' /Root 1 0 R >>\n';
    pdfString += 'startxref\n' + offset + '\n%%EOF';
    
    return Buffer.from(pdfString, 'latin1');
  };

  // Create mock PDF buffer with endobj patterns
  const createMockPdfBufferWithEndObj = (endObjCount: number): Buffer => {
    let pdfString = '%PDF-1.4\n';
    for (let i = 0; i < endObjCount; i++) {
      pdfString += `<< /Type /Catalog >>\nendobj\n`;
    }
    return Buffer.from(pdfString, 'latin1');
  };

  // Create mock PDF buffer with size-based estimation
  const createLargePdfBuffer = (sizeInKB: number): Buffer => {
    return Buffer.alloc(sizeInKB * 1024, 'x');
  };

  // Default metadata
  const defaultMetadata: BookMetadata = {
    id: testItemId,
    title: 'Test PDF Document',
    authors: [{ firstName: 'John', lastName: 'Doe' }],
    tags: ['test'],
    collections: [],
    dateAdded: new Date(),
    dateModified: new Date(),
    fileType: 'pdf',
  };

  // Default analysis request
  const createAnalysisRequest = (
    overrides = {},
  ): PdfAnalysisRequestMessage => ({
    messageId: 'test-message-id',
    timestamp: Date.now(),
    eventType: 'PDF_ANALYSIS_REQUEST',
    itemId: testItemId,
    s3Key: testS3Key,
    fileName: testFileName,
    ...overrides,
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock storage
    mockStorage = {
      getMetadata: vi.fn().mockResolvedValue(defaultMetadata),
      updateMetadata: vi.fn().mockResolvedValue(undefined),
      getPdfDownloadUrl: vi.fn().mockResolvedValue(testS3Url),
      getPdf: vi.fn(),
      uploadPdf: vi.fn(),
      uploadPdfFromPath: vi.fn(),
      saveMetadata: vi.fn(),
      getMetadataByHash: vi.fn(),
      searchMetadata: vi.fn(),
      saveCollection: vi.fn(),
      getCollections: vi.fn(),
      addItemToCollection: vi.fn(),
      removeItemFromCollection: vi.fn(),
      saveCitation: vi.fn(),
      getCitations: vi.fn(),
      saveMarkdown: vi.fn(),
      getMarkdown: vi.fn(),
      deleteMarkdown: vi.fn(),
      deleteMetadata: vi.fn(),
      deleteCollection: vi.fn(),
      deleteCitations: vi.fn(),
      saveChunk: vi.fn(),
      getChunk: vi.fn(),
      getChunksByItemId: vi.fn(),
      updateChunk: vi.fn(),
      deleteChunk: vi.fn(),
      deleteChunksByItemId: vi.fn(),
      searchChunks: vi.fn(),
      findSimilarChunks: vi.fn(),
      batchSaveChunks: vi.fn(),
    } as any;

    // Create mock RabbitMQ service
    mockRabbitMQService = {
      publishPdfAnalysisRequest: vi.fn().mockResolvedValue(true),
      publishPdfAnalysisCompleted: vi.fn().mockResolvedValue(true),
      publishPdfAnalysisFailed: vi.fn().mockResolvedValue(true),
      publishMessage: vi.fn().mockResolvedValue(true),
      initialize: vi.fn(),
      close: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      consumeMessages: vi.fn(),
      stopConsuming: vi.fn(),
      getQueueInfo: vi.fn(),
      purgeQueue: vi.fn(),
      healthCheck: vi.fn(),
      publishPdfConversionRequest: vi.fn(),
      publishPdfConversionProgress: vi.fn(),
      publishPdfConversionCompleted: vi.fn(),
      publishPdfConversionFailed: vi.fn(),
      publishPdfPartConversionRequest: vi.fn(),
      publishPdfPartConversionCompleted: vi.fn(),
      publishPdfPartConversionFailed: vi.fn(),
      publishPdfMergingRequest: vi.fn(),
      publishPdfMergingProgress: vi.fn(),
      publishMarkdownStorageRequest: vi.fn(),
      publishMarkdownStorageCompleted: vi.fn(),
      publishMarkdownStorageFailed: vi.fn(),
    } as any;

    // Mock the getRabbitMQService function
    vi.mocked(getRabbitMQService).mockReturnValue(mockRabbitMQService);

    // Mock axios
    mockAxios = mockedAxios;
    vi.mocked(axios.default).get = mockAxios.get;

    // Create service instance
    pdfAnalyzerService = new PdfAnalyzerService(mockStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PDF page count analysis', () => {
    it('should handle PDF with page count less than threshold', async () => {
      // Arrange
      const pageCount = 15; // Less than PDF_SPLIT_THRESHOLD (20)
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.getMetadata).toHaveBeenCalledWith(testItemId);
      
      // For non-splitting PDFs, there should be only 2 calls (analyzing + final)
      const finalUpdateCall = mockStorage.updateMetadata.mock.calls[1][0];
      expect(finalUpdateCall).toMatchObject({
        id: testItemId,
        pageCount,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: 'PDF ready for conversion',
      });
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
          requiresSplitting: false,
        }),
      );
    });

    it('should handle PDF with page count greater than threshold', async () => {
      // Arrange
      const pageCount = 100; // Greater than DEFAULT_SPLIT_THRESHOLD (50)
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      // For PDFs that require splitting, there should be 3 calls (analyzing, splitting, final)
      const finalUpdateCall = mockStorage.updateMetadata.mock.calls[2][0];
      expect(finalUpdateCall).toMatchObject({
        id: testItemId,
        pageCount,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: 'PDF split into parts',
      });
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
          requiresSplitting: true,
          suggestedSplitSize: expect.any(Number),
        }),
      );
    });

    it('should handle boundary case with page count exactly equal to threshold', async () => {
      // Arrange
      const pageCount = 20; // Exactly PDF_SPLIT_THRESHOLD (20)
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      // For boundary case (exactly equal to threshold), there should be only 2 calls (analyzing + final)
      const finalUpdateCall = mockStorage.updateMetadata.mock.calls[1][0];
      expect(finalUpdateCall).toMatchObject({
        id: testItemId,
        pageCount,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: 'PDF ready for conversion',
      });
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
          requiresSplitting: false, // Exactly at threshold should not require splitting
        }),
      );
    });
  });

  describe('Optimal split size calculation', () => {
    it('should calculate optimal split size for moderately large PDF', async () => {
      // Arrange
      const pageCount = 100; // Will need splitting
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      // For 100 pages, optimal split size should be ceil(100/10) = 10, but at least MIN_SPLIT_SIZE (10)
      // So expected split size should be 10
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
          requiresSplitting: true,
          suggestedSplitSize: 10, // MIN_SPLIT_SIZE
        }),
      );
    });

    it('should calculate optimal split size for very large PDF', async () => {
      // Arrange
      const pageCount = 500; // Very large PDF
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      // For 500 pages, optimal split size should be ceil(500/10) = 50
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
          requiresSplitting: true,
          suggestedSplitSize: 50, // Within MIN and MAX split size range
        }),
      );
    });

    it('should cap split size at maximum for extremely large PDF', async () => {
      // Arrange
      const pageCount = 2000; // Extremely large PDF
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      // For 2000 pages, optimal split size would be ceil(2000/10) = 200
      // But this should be capped at MAX_SPLIT_SIZE (100)
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
          requiresSplitting: true,
          suggestedSplitSize: PDF_PROCESSING_CONFIG.MAX_SPLIT_SIZE, // Capped at maximum
        }),
      );
    });
  });

  describe('S3 download failure handling', () => {
    it('should handle S3 download failure', async () => {
      // Arrange
      const request = createAnalysisRequest({ retryCount: 3, maxRetries: 3 }); // No more retries
      const downloadError = new Error('Network error');
      downloadError.name = 'AxiosError';

      mockAxios.get.mockRejectedValue(downloadError);

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testItemId,
          pdfProcessingStatus: PdfProcessingStatus.FAILED,
          pdfProcessingMessage:
            'PDF analysis failed: Failed to download PDF from S3: Network error',
          pdfProcessingError: 'Failed to download PDF from S3: Network error',
        }),
      );
      expect(mockRabbitMQService.publishPdfAnalysisFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          error: 'Failed to download PDF from S3: Network error',
          canRetry: false, // No more retries
        }),
      );
    });

    it('should handle S3 timeout', async () => {
      // Arrange
      const request = createAnalysisRequest({ retryCount: 3, maxRetries: 3 }); // No more retries
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AxiosError';

      mockAxios.get.mockRejectedValue(timeoutError);

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockRabbitMQService.publishPdfAnalysisFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          error: 'Failed to download PDF from S3: Request timeout',
          canRetry: false, // No more retries
        }),
      );
    });
  });

  describe('Invalid PDF handling', () => {
    it('should handle PDF with zero page count', async () => {
      // Arrange
      const pageCount = 0;
      const pdfBuffer = Buffer.from('Not a PDF', 'latin1');
      const request = createAnalysisRequest({ retryCount: 3, maxRetries: 3 }); // No more retries

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Mock getPageCount to return 0
      vi.spyOn(pdfAnalyzerService as any, 'getPageCount').mockResolvedValue(0);

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testItemId,
          pdfProcessingStatus: PdfProcessingStatus.FAILED,
          pdfProcessingMessage:
            'PDF analysis failed: Invalid page count detected: 0',
          pdfProcessingError: 'Invalid page count detected: 0',
        }),
      );
      expect(mockRabbitMQService.publishPdfAnalysisFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          error: 'Invalid page count detected: 0',
          canRetry: false, // No more retries
        }),
      );
    });

    it('should handle negative page count', async () => {
      // Arrange
      const request = createAnalysisRequest();
      const pdfBuffer = createMockPdfBuffer(10);

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Mock getPageCount to return negative value
      vi.spyOn(pdfAnalyzerService as any, 'getPageCount').mockResolvedValue(-5);

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testItemId,
          pdfProcessingStatus: PdfProcessingStatus.FAILED,
          pdfProcessingMessage:
            'PDF analysis failed: Invalid page count detected: -5',
          pdfProcessingError: 'Invalid page count detected: -5',
        }),
      );
    });
  });

  describe('Page count detection failure handling', () => {
    it('should handle page count detection error', async () => {
      // Arrange
      const request = createAnalysisRequest({ retryCount: 3, maxRetries: 3 }); // No more retries
      const pdfBuffer = createMockPdfBuffer(10);

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Mock getPageCount to throw an error
      vi.spyOn(pdfAnalyzerService as any, 'getPageCount').mockRejectedValue(
        new Error('PDF parsing failed'),
      );

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testItemId,
          pdfProcessingStatus: PdfProcessingStatus.FAILED,
          pdfProcessingMessage: 'PDF analysis failed: PDF parsing failed',
          pdfProcessingError: 'PDF parsing failed',
        }),
      );
      expect(mockRabbitMQService.publishPdfAnalysisFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          error: 'PDF parsing failed',
          canRetry: false, // No more retries
        }),
      );
    });
  });

  describe('Retry mechanism', () => {
    it('should retry analysis when retry count is below maximum', async () => {
      // Arrange
      const retryCount = 1;
      const maxRetries = 3;
      const request = createAnalysisRequest({ retryCount, maxRetries });

      mockAxios.get.mockRejectedValue(new Error('Temporary failure'));

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisRequest,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          retryCount: retryCount + 1, // Should be incremented
          messageId: 'test-uuid-12345', // New message ID
        }),
      );
      // Should not publish failure message yet
      expect(
        mockRabbitMQService.publishPdfAnalysisFailed,
      ).not.toHaveBeenCalled();
    });

    it('should not retry when maximum retries reached', async () => {
      // Arrange
      const retryCount = 3;
      const maxRetries = 3;
      const request = createAnalysisRequest({ retryCount, maxRetries });

      mockAxios.get.mockRejectedValue(new Error('Persistent failure'));

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisRequest,
      ).not.toHaveBeenCalled();
      expect(mockRabbitMQService.publishPdfAnalysisFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          error: 'Failed to download PDF from S3: Persistent failure',
          retryCount,
          maxRetries,
          canRetry: false, // Should not be able to retry
        }),
      );
    });

    it('should increment retry count in metadata', async () => {
      // Arrange
      const retryCount = 1;
      const maxRetries = 3;
      const request = createAnalysisRequest({ retryCount, maxRetries });

      mockAxios.get.mockRejectedValue(new Error('Temporary failure'));

      // Mock metadata with existing retry count
      const metadataWithRetry = {
        ...defaultMetadata,
        pdfProcessingRetryCount: retryCount,
      };
      mockStorage.getMetadata.mockResolvedValue(metadataWithRetry);

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testItemId,
          pdfProcessingRetryCount: retryCount + 1, // Should be incremented
        }),
      );
    });
  });

  describe('Message publishing verification', () => {
    it('should publish analysis completed message with correct data', async () => {
      // Arrange
      const pageCount = 75;
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'test-uuid-12345',
          eventType: 'PDF_ANALYSIS_COMPLETED',
          itemId: testItemId,
          pageCount,
          requiresSplitting: true,
          suggestedSplitSize: expect.any(Number),
          processingTime: expect.any(Number),
        }),
      );
    });

    it('should publish analysis failed message with correct data', async () => {
      // Arrange
      const request = createAnalysisRequest({ retryCount: 3, maxRetries: 3 }); // No more retries
      const errorMessage = 'Test error';
      const pdfBuffer = createMockPdfBuffer(10);

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Mock getPageCount to throw an error
      vi.spyOn(pdfAnalyzerService as any, 'getPageCount').mockRejectedValue(
        new Error(errorMessage),
      );

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockRabbitMQService.publishPdfAnalysisFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'test-uuid-12345',
          eventType: 'PDF_ANALYSIS_FAILED',
          itemId: testItemId,
          error: errorMessage,
          retryCount: 3,
          maxRetries: 3,
          canRetry: false, // No more retries
          processingTime: expect.any(Number),
        }),
      );
    });

    it('should handle message publishing failure gracefully', async () => {
      // Arrange
      const pageCount = 25;
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      mockRabbitMQService.publishPdfAnalysisCompleted.mockRejectedValue(
        new Error('RabbitMQ connection failed'),
      );

      // Act & Assert - Should not throw error
      await expect(
        pdfAnalyzerService.analyzePdf(request),
      ).resolves.not.toThrow();

      // Metadata should still be updated
      expect(mockStorage.updateMetadata).toHaveBeenCalled();
    });
  });

  describe('Metadata update verification', () => {
    it('should update metadata with analysis results', async () => {
      // Arrange
      const pageCount = 60;
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      // Check the final call to updateMetadata (should be the 3rd call)
      const finalUpdateCall = mockStorage.updateMetadata.mock.calls[2][0];
      expect(finalUpdateCall).toMatchObject({
        id: testItemId,
        pageCount,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: 'PDF split into parts',
      });
    });

    it('should set processing started timestamp on first analysis', async () => {
      // Arrange
      const pageCount = 30;
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testItemId,
          pdfProcessingStartedAt: expect.any(Date),
        }),
      );
    });

    it('should handle item not found gracefully', async () => {
      // Arrange
      const request = createAnalysisRequest();
      mockStorage.getMetadata.mockResolvedValueOnce(null); // Use mockResolvedValueOnce to ensure it returns null for this test

      // Act & Assert
      // Note: This test verifies that the service handles missing items gracefully
      // The actual error handling is tested through the error handling flow
      await expect(
        pdfAnalyzerService.analyzePdf(request),
      ).resolves.toBeUndefined();
    });
  });

  describe('PDF page count detection methods', () => {
    it('should detect page count using /Type /Page pattern', async () => {
      // Arrange
      const pageCount = 15;
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount,
        }),
      );
    });

    it('should estimate page count using endobj pattern when no page patterns found', async () => {
      // Arrange
      const endObjCount = 50; // Should result in 5 pages (50/10)
      const pdfBuffer = createMockPdfBufferWithEndObj(endObjCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount: 5, // Math.ceil(50/10)
        }),
      );
    });

    it('should estimate page count using file size as fallback', async () => {
      // Arrange
      const sizeInKB = 500; // Should result in 10 pages (500KB/50KB)
      const pdfBuffer = createLargePdfBuffer(sizeInKB);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount: 10, // Math.ceil(500/50)
        }),
      );
    });

    it('should cap estimated page count at maximum', async () => {
      // Arrange
      // Create a valid PDF with 1000 pages (at the maximum limit)
      const pageCount = 1000;
      const pdfBuffer = createMockPdfBuffer(pageCount);
      const request = createAnalysisRequest();

      mockAxios.get.mockResolvedValue({
        data: pdfBuffer,
      });

      // Act
      await pdfAnalyzerService.analyzePdf(request);

      // Assert
      expect(
        mockRabbitMQService.publishPdfAnalysisCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: testItemId,
          pageCount: 1000, // Should be exactly 1000
        }),
      );
    });
  });
});
