import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Library, { HashUtils } from '../liberary';
import { S3MongoLibraryStorage } from '../liberary';
import { MinerUPdfConvertor } from '../MinerUPdfConvertor';

// Mock the MinerUPdfConvertor for testing
vi.mock('../MinerUPdfConvertor');

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
        .mockImplementation((metadata) => Promise.resolve(metadata)),
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
      getMetadata: vi.fn().mockResolvedValue(null),
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
    };

    // Create the library instance
    library = new Library(mockStorage, mockPdfConvertor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should upload PDF to S3 and convert to Markdown', async () => {
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
    expect(mockPdfConvertor.convertPdfToMarkdown).toHaveBeenCalled();
    expect(mockStorage.saveMarkdown).toHaveBeenCalled();
    expect(result.metadata.title).toBe('Test Document');
  });

  it('should handle conversion errors gracefully', async () => {
    // Arrange
    const pdfPath = '/path/to/test.pdf';
    const pdfBuffer = Buffer.from('test pdf content');
    const fileName = 'test.pdf';
    const metadata = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: ['test'],
    };

    // Mock conversion failure
    mockPdfConvertor.convertPdfToMarkdown.mockResolvedValue({
      success: false,
      error: 'Conversion failed',
    });

    // Mock the hash generation
    vi.spyOn(HashUtils, 'generateHashFromBuffer').mockReturnValue('hash-123');

    // Act
    const result = await library.storePdf(pdfBuffer, fileName, metadata);

    // Assert
    expect(mockStorage.uploadPdf).toHaveBeenCalledWith(pdfBuffer, fileName);
    expect(mockStorage.saveMetadata).toHaveBeenCalled();
    expect(mockStorage.saveMarkdown).not.toHaveBeenCalled();
    expect(result.metadata.title).toBe('Test Document');
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
    expect(mockStorage.saveMarkdown).not.toHaveBeenCalled();
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
    expect(mockPdfConvertor.convertPdfToMarkdown).not.toHaveBeenCalled();
    expect(mockStorage.saveMarkdown).not.toHaveBeenCalled();
    expect(result.metadata.id).toBe('existing-123');
  });
});
