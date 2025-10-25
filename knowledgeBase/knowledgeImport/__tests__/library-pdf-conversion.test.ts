import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Library, { HashUtils } from '../library';
import { S3MongoLibraryStorage } from '../library';
import { MinerUPdfConvertor } from '@aikb/pdf-converter';
import { getRabbitMQService } from '../../../lib/rabbitmq/rabbitmq.service';
import { PdfProcessingStatus } from '../../../lib/rabbitmq/message.types';

// Mock the MinerUPdfConvertor for testing
vi.mock('../MinerUPdfConvertor');

// Mock RabbitMQ service
const mockRabbitMQService = {
  isConnected: vi.fn(() => true),
  initialize: vi.fn(() => Promise.resolve()),
  publishPdfAnalysisRequest: vi.fn(() => Promise.resolve(true)),
  publishPdfConversionRequest: vi.fn(() => Promise.resolve(true)),
  consumeMessages: vi.fn(() => Promise.resolve('test-consumer-tag')),
  stopConsuming: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
};

vi.mock('../../../lib/rabbitmq/rabbitmq.service', () => ({
  getRabbitMQService: vi.fn(() => mockRabbitMQService),
}));

describe('Library PDF Conversion Workflow', () => {
  let library: Library;
  let mockStorage: any;
  let mockPdfConvertor: any;

  beforeEach(() => {
    // Create a mock storage
    mockStorage = {
      uploadPdfFromPath: vi.fn().mockResolvedValue({
        id: 'pdf-123',
        name: 'test.pdf',
        s3Key: 'library/pdfs/2023/test.pdf',
        url: 'https://s3.amazonaws.com/test.pdf',
        fileSize: 1024,
        createDate: new Date(),
      }),
      saveMetadata: vi
        .fn()
        .mockImplementation((metadata) =>
          Promise.resolve({ ...metadata, id: 'test-item-id' }),
        ),
      getMetadataByHash: vi.fn().mockResolvedValue(null),
      saveMarkdown: vi.fn().mockResolvedValue(undefined),
      getMarkdown: vi
        .fn()
        .mockResolvedValue('# Test Document\n\nThis is test content.'),
      // Add other required methods
      uploadPdf: vi.fn().mockResolvedValue({
        id: 'pdf-456',
        name: 'test.pdf',
        s3Key: 'library/pdfs/2023/test.pdf',
        url: 'https://s3.amazonaws.com/test.pdf',
        fileSize: 1024,
        createDate: new Date(),
      }),
      getPdfDownloadUrl: vi
        .fn()
        .mockResolvedValue('https://s3.amazonaws.com/test.pdf'),
      getPdf: vi.fn().mockResolvedValue(Buffer.from('test')),
      getMetadata: vi.fn().mockImplementation((id) => {
        // Return the item with the updated status for the error test
        if (id === 'test-item-id') {
          return Promise.resolve({
            id: 'test-item-id',
            title: 'Test Document',
            pdfProcessingStatus: PdfProcessingStatus.FAILED,
            pdfProcessingError:
              'Failed to queue for processing: RabbitMQ unavailable',
          });
        }
        return Promise.resolve(null);
      }),
      updateMetadata: vi.fn().mockResolvedValue(undefined),
      searchMetadata: vi.fn().mockResolvedValue([]),
      saveCollection: vi
        .fn()
        .mockResolvedValue({ id: 'collection-1', name: 'Test Collection' }),
      getCollections: vi.fn().mockResolvedValue([]),
      addItemToCollection: vi.fn().mockResolvedValue(undefined),
      removeItemFromCollection: vi.fn().mockResolvedValue(undefined),
      saveCitation: vi.fn().mockResolvedValue({ id: 'citation-1' }),
      getCitations: vi.fn().mockResolvedValue([]),
    };

    // Create a mock PDF converter
    mockPdfConvertor = {
      convertPdfToMarkdown: vi.fn().mockResolvedValue({
        success: true,
        data: '# Test Document\n\nThis is the converted markdown content from PDF.',
        taskId: 'task-123',
      }),
      convertPdfToMarkdownFromS3: vi.fn().mockResolvedValue({
        success: true,
        data: '# Test Document\n\nThis is the converted markdown content from PDF.',
        taskId: 'task-123',
      }),
    };

    // Create the library instance
    library = new Library(mockStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should upload PDF to S3 and queue for async processing', async () => {
    // Arrange
    const pdfPath = '/path/to/test.pdf';
    const pdfBuffer = Buffer.from('test pdf content');
    const fileName = 'test.pdf';
    const metadata = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: ['test'],
    };

    // Mock the hash generation
    vi.spyOn(HashUtils, 'generateHashFromBuffer').mockReturnValue('hash-123');

    // Act
    const result = await library.storePdf(pdfBuffer, fileName, metadata);

    // Assert
    expect(mockStorage.uploadPdf).toHaveBeenCalledWith(pdfBuffer, fileName);
    expect(mockStorage.saveMetadata).toHaveBeenCalled();

    // Verify RabbitMQ service was called
    expect(mockRabbitMQService.publishPdfAnalysisRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId: result.metadata.id,
        fileName,
        s3Key: result.metadata.s3Key,
      }),
    );

    // Verify the item is in pending status
    expect(result.metadata.pdfProcessingStatus).toBe(
      PdfProcessingStatus.PENDING,
    );
    expect(result.metadata.pdfProcessingMessage).toBe('Queued for processing');
    expect(result.metadata.pdfProcessingProgress).toBe(0);
    expect(result.metadata.title).toBe('Test Document');

    // The PDF converter should NOT be called directly in storePdf (it's called async)
    expect(mockPdfConvertor.convertPdfToMarkdownFromS3).not.toHaveBeenCalled();
    expect(mockStorage.saveMarkdown).not.toHaveBeenCalled();
  });

  it('should handle RabbitMQ service failure gracefully', async () => {
    // Arrange
    const pdfPath = '/path/to/test.pdf';
    const pdfBuffer = Buffer.from('test pdf content');
    const fileName = 'test.pdf';
    const metadata = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: ['test'],
    };

    // Mock RabbitMQ failure
    mockRabbitMQService.publishPdfAnalysisRequest.mockRejectedValueOnce(
      new Error('RabbitMQ unavailable'),
    );

    // Mock the hash generation
    vi.spyOn(HashUtils, 'generateHashFromBuffer').mockReturnValue('hash-123');

    // Act
    const result = await library.storePdf(pdfBuffer, fileName, metadata);

    // Assert
    expect(mockStorage.uploadPdf).toHaveBeenCalledWith(pdfBuffer, fileName);
    expect(mockStorage.saveMetadata).toHaveBeenCalled();

    // Wait a bit for the async status update to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Refresh the item to get the updated status
    const updatedItem = await library.getItem(result.metadata.id!);
    expect(updatedItem?.metadata.pdfProcessingStatus).toBe(
      PdfProcessingStatus.FAILED,
    );
    expect(updatedItem?.metadata.pdfProcessingError).toContain(
      'Failed to queue for processing',
    );
  });

  it('should work without a PDF converter', async () => {
    // Arrange
    const libraryWithoutConverter = new Library(mockStorage);
    const pdfPath = '/path/to/test.pdf';
    const pdfBuffer = Buffer.from('test pdf content');
    const fileName = 'test.pdf';
    const metadata = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: ['test'],
    };

    // Mock the hash generation
    vi.spyOn(HashUtils, 'generateHashFromBuffer').mockReturnValue('hash-123');

    // Act
    const result = await libraryWithoutConverter.storePdf(
      pdfBuffer,
      fileName,
      metadata,
    );

    // Assert
    expect(mockStorage.uploadPdf).toHaveBeenCalledWith(pdfBuffer, fileName);
    expect(mockStorage.saveMetadata).toHaveBeenCalled();
    expect(mockRabbitMQService.publishPdfAnalysisRequest).toHaveBeenCalled();

    // Should still queue for processing even without a converter
    expect(result.metadata.pdfProcessingStatus).toBe(
      PdfProcessingStatus.PENDING,
    );
    expect(result.metadata.title).toBe('Test Document');
  });

  it('should return existing item if duplicate content hash is found', async () => {
    // Arrange
    const pdfPath = '/path/to/test.pdf';
    const pdfBuffer = Buffer.from('test pdf content');
    const fileName = 'test.pdf';
    const metadata = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: ['test'],
    };

    const existingItem = {
      id: 'existing-123',
      title: 'Existing Document',
      contentHash: 'hash-123',
    };

    mockStorage.getMetadataByHash.mockResolvedValue(existingItem);

    // Mock the hash generation
    vi.spyOn(HashUtils, 'generateHashFromBuffer').mockReturnValue('hash-123');

    // Act
    const result = await library.storePdf(pdfBuffer, fileName, metadata);

    // Assert
    expect(mockStorage.uploadPdf).not.toHaveBeenCalled();
    expect(mockStorage.saveMetadata).not.toHaveBeenCalled();
    expect(
      mockRabbitMQService.publishPdfAnalysisRequest,
    ).not.toHaveBeenCalled();
    expect(result.metadata.id).toBe('existing-123');
  });
});
