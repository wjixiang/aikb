import { Test, TestingModule } from '@nestjs/testing';
import { LibraryItemController } from './library-item.controller';
import { LibraryItemService } from './library-item.service';
import { PdfUploadUrlDto, PdfUploadUrlResponseDto } from 'library-shared';
import { vi } from 'vitest';
import { ClientsModule, Transport } from '@nestjs/microservices';

// Mock s3-service
vi.mock('@aikb/s3-service', () => ({
  getSignedUploadUrl: vi.fn().mockResolvedValue('https://example.com/presigned-url'),
}));

// Mock bibliography library
vi.mock('@aikb/bibliography', () => ({
  S3MongoLibraryStorage: vi.fn().mockImplementation(() => ({
    updateMetadata: vi.fn().mockResolvedValue({}),
    getPdfDownloadUrl: vi.fn().mockResolvedValue('http://example.com'),
  })),
  Library: vi.fn().mockImplementation(() => ({
    storePdf: vi.fn().mockResolvedValue({}),
    getItem: vi.fn().mockResolvedValue({}),
    searchItems: vi.fn().mockResolvedValue([]),
    deleteItem: vi.fn().mockResolvedValue(true),
  })),
}));

describe('LibraryItemController - Upload URL E2E', () => {
  let controller: LibraryItemController;
  let module: TestingModule;

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
      controllers: [LibraryItemController],
      providers: [LibraryItemService],
    })
      .overrideProvider('PDF_2_MARKDOWN_SERVICE')
      .useValue({
        emit: vi.fn(),
      })
      .compile();

    controller = module.get<LibraryItemController>(LibraryItemController);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUploadUrl', () => {
    it('should return a PDF upload URL with correct structure', async () => {
      const pdfUploadUrlDto: PdfUploadUrlDto = {
        fileName: 'test-document.pdf',
        expiresIn: 7200, // 2 hours
      };

      const result = await controller.getUploadUrl(pdfUploadUrlDto);

      // Verify response structure
      expect(result).toBeDefined();
      expect(result.uploadUrl).toBeDefined();
      expect(result.s3Key).toBeDefined();
      expect(result.expiresAt).toBeDefined();

      // Verify S3 key format
      expect(result.s3Key).toMatch(/^library\/pdfs\/\d{4}\/\d{13}-test-document\.pdf$/);
      
      // Verify upload URL
      expect(result.uploadUrl).toBe('https://example.com/presigned-url');
      
      // Verify expiration is in the future
      const expirationDate = new Date(result.expiresAt);
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 7200000);
      expect(Math.abs(expirationDate.getTime() - twoHoursFromNow.getTime())).toBeLessThan(5000); // 5 seconds tolerance
    });

    it('should handle different file names correctly', async () => {
      const testCases = [
        { fileName: 'research-paper.pdf', expectedPattern: /research-paper\.pdf$/ },
        { fileName: 'user manual.pdf', expectedPattern: /user-manual\.pdf$/ },
        { fileName: 'document with spaces.pdf', expectedPattern: /document-with-spaces\.pdf$/ },
      ];

      for (const testCase of testCases) {
        const pdfUploadUrlDto: PdfUploadUrlDto = {
          fileName: testCase.fileName,
        };

        const result = await controller.getUploadUrl(pdfUploadUrlDto);

        expect(result.s3Key).toMatch(testCase.expectedPattern);
      }
    });

    it('should use default expiration when not provided', async () => {
      const pdfUploadUrlDto: PdfUploadUrlDto = {
        fileName: 'default-expiration.pdf',
      };

      const result = await controller.getUploadUrl(pdfUploadUrlDto);

      // Verify expiration is approximately 1 hour from now
      const expirationDate = new Date(result.expiresAt);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 3600000);
      expect(Math.abs(expirationDate.getTime() - oneHourFromNow.getTime())).toBeLessThan(5000); // 5 seconds tolerance
    });
  });
});