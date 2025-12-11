import { Test, TestingModule } from '@nestjs/testing';
import { LibraryItemService } from './library-item.service';
import { PdfUploadUrlDto, PdfUploadUrlResponseDto } from 'llm-shared/';
import { vi } from 'vitest';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { S3Service } from '@aikb/s3-service';

// Mock the S3Service class
vi.mock('@aikb/s3-service', () => ({
  S3Service: vi.fn().mockImplementation(() => ({
    getSignedUploadUrl: vi
      .fn()
      .mockResolvedValue('https://example.com/presigned-url'),
  })),
  createS3ServiceFromEnv: vi.fn().mockReturnValue({
    getSignedUploadUrl: vi
      .fn()
      .mockResolvedValue('https://example.com/presigned-url'),
  }),
}));

// Mock the bibliography library
vi.mock('bibliography', () => ({
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

describe('LibraryItemService - Upload URL', () => {
  let service: LibraryItemService;
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
      providers: [
        LibraryItemService,
        {
          provide: 'S3_SERVICE',
          useValue: {
            getSignedUploadUrl: vi
              .fn()
              .mockResolvedValue('https://example.com/presigned-url'),
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

  describe('getPdfUploadUrl', () => {
    it('should return a PDF upload URL with S3 key and expiration', async () => {
      const pdfUploadUrlDto: PdfUploadUrlDto = {
        fileName: 'test-file.pdf',
        expiresIn: 3600,
      };

      const result = await service.getPdfUploadUrl(pdfUploadUrlDto);

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBe('https://example.com/presigned-url');
      expect(result.s3Key).toContain('library/pdfs/');
      expect(result.s3Key).toContain('test-file.pdf');
      expect(result.expiresAt).toBeDefined();

      // Verify expiration is in the future
      const expirationDate = new Date(result.expiresAt);
      const now = new Date();
      expect(expirationDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should use default expiration time when not provided', async () => {
      const pdfUploadUrlDto: PdfUploadUrlDto = {
        fileName: 'test-file.pdf',
      };

      const result = await service.getPdfUploadUrl(pdfUploadUrlDto);

      expect(result).toBeDefined();
      expect(result.uploadUrl).toBe('https://example.com/presigned-url');
      expect(result.s3Key).toContain('library/pdfs/');
      expect(result.s3Key).toContain('test-file.pdf');
      expect(result.expiresAt).toBeDefined();

      // Verify expiration is approximately 1 hour from now
      const expirationDate = new Date(result.expiresAt);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 3600000);
      expect(
        Math.abs(expirationDate.getTime() - oneHourFromNow.getTime()),
      ).toBeLessThan(5000); // 5 seconds tolerance
    });

    it('should generate unique S3 keys', async () => {
      const pdfUploadUrlDto: PdfUploadUrlDto = {
        fileName: 'test-file.pdf',
      };

      const result1 = await service.getPdfUploadUrl(pdfUploadUrlDto);
      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result2 = await service.getPdfUploadUrl(pdfUploadUrlDto);

      expect(result1.s3Key).not.toBe(result2.s3Key);
    });
  });
});
