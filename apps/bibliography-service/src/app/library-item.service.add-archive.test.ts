import { Test, TestingModule } from '@nestjs/testing';
import { LibraryItemService } from './library-item.service';
import { AddItemArchiveDto } from 'library-shared';
import { vi } from 'vitest';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Library, LibraryItem } from 'bibliography';
import { S3Service } from '@aikb/s3-service';

// Mock the bibliography library
vi.mock('bibliography', () => ({
  S3MongoLibraryStorage: vi.fn().mockImplementation(() => ({
    addArchiveToMetadata: vi.fn().mockResolvedValue(undefined),
    updateMetadata: vi.fn().mockResolvedValue({}),
    getPdfDownloadUrl: vi.fn().mockResolvedValue('http://example.com'),
  })),
  Library: vi.fn().mockImplementation((storage) => ({
    storage,
    storePdf: vi.fn().mockResolvedValue({}),
    getItem: vi.fn().mockResolvedValue({}),
    searchItems: vi.fn().mockResolvedValue([]),
    deleteItem: vi.fn().mockResolvedValue(true),
  })),
}));

// Create a mock storage instance with addArchiveToMetadata method
const mockStorage = {
  // PDF operations
  uploadPdf: vi
    .fn()
    .mockResolvedValue({
      id: 'test-pdf-id',
      name: 'test.pdf',
      s3Key: 'test-key',
      url: 'test-url',
      createDate: new Date(),
    }),
  uploadPdfFromPath: vi
    .fn()
    .mockResolvedValue({
      id: 'test-pdf-id',
      name: 'test.pdf',
      s3Key: 'test-key',
      url: 'test-url',
      createDate: new Date(),
    }),
  getPdfDownloadUrl: vi.fn().mockResolvedValue('http://example.com'),
  getPdf: vi.fn().mockResolvedValue(Buffer.from('test pdf content')),

  // Metadata operations
  saveMetadata: vi.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
  getMetadata: vi.fn().mockResolvedValue({ id: 'test-id', title: 'Test' }),
  getMetadataByHash: vi
    .fn()
    .mockResolvedValue({ id: 'test-id', title: 'Test' }),
  updateMetadata: vi.fn().mockResolvedValue({}),
  addArchiveToMetadata: vi.fn().mockResolvedValue(undefined),
  searchMetadata: vi.fn().mockResolvedValue([]),
  deleteMetadata: vi.fn().mockResolvedValue(true),

  // Collection operations
  saveCollection: vi
    .fn()
    .mockResolvedValue({ id: 'test-collection-id', name: 'Test Collection' }),
  getCollections: vi.fn().mockResolvedValue([]),
  addItemToCollection: vi.fn().mockResolvedValue(undefined),
  removeItemFromCollection: vi.fn().mockResolvedValue(undefined),
  deleteCollection: vi.fn().mockResolvedValue(true),

  // Citation operations
  saveCitation: vi
    .fn()
    .mockResolvedValue({ id: 'test-citation-id', itemId: 'test-item-id' }),
  getCitations: vi.fn().mockResolvedValue([]),
  deleteCitations: vi.fn().mockResolvedValue(true),

  // Markdown operations
  saveMarkdown: vi.fn().mockResolvedValue(undefined),
  getMarkdown: vi.fn().mockResolvedValue('test markdown'),
  deleteMarkdown: vi.fn().mockResolvedValue(true),
};

describe('LibraryItemService - Add Archive', () => {
  let service: LibraryItemService;
  let module: TestingModule;
  let mockLibrary: any;

  beforeEach(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_bibliography';

    module = await Test.createTestingModule({
      imports: [
        ClientsModule.register([
          {
            name: 'PDF_2_MARKDOWN_SERVICE',
            transport: Transport.RMQ,
            options: {
              urls: ['amqp://admin:admin123@rabbitmq:5672/my_vhost'],
              queue: 'test_queue',
              connectionInitOptions: { timeout: 30000 },
              heartbeat: 60,
              prefetchCount: 1,
            },
          },
        ]),
      ],
      providers: [
        LibraryItemService,
        {
          provide: 'S3_SERVICE',
          useValue: {
            getSignedUploadUrl: vi.fn(),
            getSignedDownloadUrl: vi.fn(),
            uploadToS3: vi.fn(),
            deleteFromS3: vi.fn(),
          },
        },
      ],
    })
      .overrideProvider('PDF_2_MARKDOWN_SERVICE')
      .useValue({
        emit: vi.fn(),
      })
      .compile();

    service = module.get<LibraryItemService>(LibraryItemService);

    // Create a mock library with our storage
    mockLibrary = new Library(mockStorage);

    // Replace the library property on the service instance
    (service as any).library = mockLibrary;
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addArchiveToItem', () => {
    const mockItem: LibraryItem = {
      getItemId: () => 'test-item-id',
      metadata: {
        id: 'test-item-id',
        title: 'Test Item',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        tags: ['test'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        archives: [
          {
            fileType: 'pdf',
            fileSize: 100000,
            fileHash: 'existing-hash',
            addDate: new Date(),
            s3Key: 'library/pdfs/2024/existing-file.pdf',
          },
        ],
      },
      addArchiveToMetadata: vi.fn().mockResolvedValue(true),
    } as any;

    it('should add an archive to an existing item', async () => {
      const addItemArchiveDto: AddItemArchiveDto = {
        fileType: 'pdf',
        fileSize: 200000,
        fileHash: 'new-hash',
        s3Key: 'library/pdfs/2024/new-file.pdf',
        pageCount: 25,
        wordCount: 5000,
      };

      // Mock getItem to return our test item
      const getItemMock = vi
        .fn()
        .mockResolvedValueOnce(mockItem)
        .mockResolvedValueOnce({
          ...mockItem,
          metadata: {
            ...mockItem.metadata,
            archives: [
              ...mockItem.metadata.archives,
              {
                fileType: 'pdf',
                fileSize: 200000,
                fileHash: 'new-hash',
                addDate: new Date(),
                s3Key: 'library/pdfs/2024/new-file.pdf',
                pageCount: 25,
                wordCount: 5000,
              },
            ],
          },
        });

      // Update the library mock with our getItem mock
      mockLibrary.getItem = getItemMock;

      const result = await service.addArchiveToItem(
        'test-item-id',
        addItemArchiveDto,
      );

      expect(result).toBeDefined();
      expect(result.metadata.archives).toHaveLength(2);
      expect(result.metadata.archives[1]).toMatchObject({
        fileType: 'pdf',
        fileSize: 200000,
        fileHash: 'new-hash',
        s3Key: 'library/pdfs/2024/new-file.pdf',
        pageCount: 25,
        wordCount: 5000,
      });
      expect(result.metadata.archives[1].addDate).toBeInstanceOf(Date);
    });

    it('should throw error when item does not exist', async () => {
      const addItemArchiveDto: AddItemArchiveDto = {
        fileType: 'pdf',
        fileSize: 200000,
        fileHash: 'new-hash',
        s3Key: 'library/pdfs/2024/new-file.pdf',
      };

      // Mock getItem to return null (item not found)
      const getItemMock = vi.fn().mockResolvedValueOnce(null);

      // Update the library mock with our getItem mock
      mockLibrary.getItem = getItemMock;

      await expect(
        service.addArchiveToItem('non-existent-id', addItemArchiveDto),
      ).rejects.toThrow('Library item with ID non-existent-id not found');
    });

    it('should call storage addArchiveToMetadata with correct parameters', async () => {
      const addItemArchiveDto: AddItemArchiveDto = {
        fileType: 'pdf',
        fileSize: 200000,
        fileHash: 'new-hash',
        s3Key: 'library/pdfs/2024/new-file.pdf',
      };

      // Mock getItem to return our test item and then the updated item
      const getItemMock = vi
        .fn()
        .mockResolvedValueOnce(mockItem)
        .mockResolvedValueOnce(mockItem); // Return the same item for simplicity

      // Update the library mock with our getItem mock
      mockLibrary.getItem = getItemMock;

      const result = await service.addArchiveToItem(
        'test-item-id',
        addItemArchiveDto,
      );

      expect(mockItem.addArchiveToMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          fileType: 'pdf',
          fileSize: 200000,
          fileHash: 'new-hash',
          s3Key: 'library/pdfs/2024/new-file.pdf',
          addDate: expect.any(Date),
        }),
      );
    });

    it('should handle optional fields correctly', async () => {
      const addItemArchiveDto: AddItemArchiveDto = {
        fileType: 'pdf',
        fileSize: 150000,
        fileHash: 'minimal-hash',
        s3Key: 'library/pdfs/2024/minimal-file.pdf',
        // pageCount and wordCount are optional
      };

      // Mock getItem to return our test item
      const getItemMock = vi
        .fn()
        .mockResolvedValueOnce(mockItem)
        .mockResolvedValueOnce({
          ...mockItem,
          metadata: {
            ...mockItem.metadata,
            archives: [
              ...mockItem.metadata.archives,
              {
                fileType: 'pdf',
                fileSize: 150000,
                fileHash: 'minimal-hash',
                addDate: new Date(),
                s3Key: 'library/pdfs/2024/minimal-file.pdf',
                // pageCount and wordCount should be undefined
              },
            ],
          },
        });

      // Update the library mock with our getItem mock
      mockLibrary.getItem = getItemMock;

      const result = await service.addArchiveToItem(
        'test-item-id',
        addItemArchiveDto,
      );

      expect(result).toBeDefined();
      expect(result.metadata.archives).toHaveLength(2);
      expect(result.metadata.archives[1]).toMatchObject({
        fileType: 'pdf',
        fileSize: 150000,
        fileHash: 'minimal-hash',
        s3Key: 'library/pdfs/2024/minimal-file.pdf',
      });
      expect(result.metadata.archives[1].pageCount).toBeUndefined();
      expect(result.metadata.archives[1].wordCount).toBeUndefined();
    });
  });
});
