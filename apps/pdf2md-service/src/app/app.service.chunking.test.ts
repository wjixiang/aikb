import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppService } from './app.service';
import { Pdf2MArkdownDto } from 'library-shared';
import { ClientProxy } from '@nestjs/microservices';
import * as fs from 'fs';

// Mock axios with named exports - declare variables before mock
const mockGet = vi.fn();
const mockPost = vi.fn();

// Mock external dependencies
vi.mock('pdf-lib');
vi.mock('mineru-client');
vi.mock('@aikb/s3-service', () => ({
  uploadFile: vi.fn().mockResolvedValue({ url: 'http://test-s3-url.com' }),
  uploadToS3: vi.fn().mockResolvedValue('http://test-s3-url.com'),
  getPdfDownloadUrl: vi
    .fn()
    .mockResolvedValue('http://test-s3-download-url.com'),
  createS3Service: vi.fn().mockReturnValue({
    uploadToS3: vi.fn().mockResolvedValue({ key: 'test-key', url: 'http://test-s3-url.com' }),
    getSignedDownloadUrl: vi.fn().mockResolvedValue('http://test-s3-download-url.com'),
  }),
}));
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock axios
vi.mock('axios', () => ({
  get: vi.fn().mockImplementation((url: string, options?: any) => {
    // Check for arraybuffer first to ensure correct response type
    if (options?.responseType === 'arraybuffer') {
      return Promise.resolve({
        data: Buffer.from('mock pdf data'),
      });
    } else if (url.includes('download-url')) {
      return Promise.resolve({
        data: { downloadUrl: 'http://test-pdf-url.com' },
      });
    }
    return Promise.resolve({ data: {} });
  }),
  post: vi.fn().mockResolvedValue({}),
  default: {
    get: vi.fn().mockImplementation((url: string, options?: any) => {
      // Check for arraybuffer first to ensure correct response type
      if (options?.responseType === 'arraybuffer') {
        return Promise.resolve({
          data: Buffer.from('mock pdf data'),
        });
      } else if (url.includes('download-url')) {
        return Promise.resolve({
          data: { downloadUrl: 'http://test-pdf-url.com' },
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({}),
  },
}));

// Create a mock that can handle different page counts based on test needs
let mockPageCount = 25; // Default for chunking tests

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockImplementation((pdfBytes: Buffer) => {
      return {
        getPageCount: vi.fn().mockImplementation(() => mockPageCount),
      };
    }),
    create: vi.fn().mockResolvedValue({
      copyPages: vi.fn().mockResolvedValue([{}]),
      addPage: vi.fn(),
      save: vi.fn().mockResolvedValue(Buffer.from('mock pdf chunk')),
    }),
  },
}));

const mockMinerUClient = {
  createSingleFileTask: vi.fn(),
  waitForTaskCompletion: vi.fn(),
  config: {
    token: 'test-token',
    baseUrl: 'https://test-api.com',
    downloadDir: './test-downloads',
  },
};

vi.mock('mineru-client', () => ({
  MinerUClient: vi.fn(() => mockMinerUClient),
  MinerUDefaultConfig: {
    token: 'test-token',
    baseUrl: 'https://test-api.com',
    downloadDir: './test-downloads',
  },
}));

describe('AppService - PDF Chunking Fixed Tests', () => {
  let service: AppService;
  let mockBibliographyGrpcClient: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock BibliographyGrpcClient
    mockBibliographyGrpcClient = {
      client: vi.fn(),
      bibliographyServiceService: vi.fn(),
      onModuleInit: vi.fn(),
      createLibraryItem: vi.fn(),
      updateLibraryItem: vi.fn(),
      deleteLibraryItem: vi.fn(),
      getLibraryItem: vi.fn(),
      listLibraryItems: vi.fn(),
      updateLibraryItemMarkdown: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((observer) => {
          observer.next({ item: { id: 'test-item-id' } });
          observer.complete();
        }),
      }),
    };

    // Create mock AmqpConnection
    const mockAmqpConnection = {
      publish: vi.fn().mockResolvedValue({}),
    } as any;

    service = new AppService(mockBibliographyGrpcClient, mockAmqpConnection);

    // Setup MinerU client mocks
    mockMinerUClient.createSingleFileTask.mockResolvedValue('test-task-id');
    mockMinerUClient.waitForTaskCompletion.mockResolvedValue({
      result: { state: 'done' },
      downloadedFiles: ['/path/to/markdown.md'],
    });

    // Setup axios mocks
    mockGet.mockResolvedValue({
      data: { downloadUrl: 'http://test-pdf-url.com' },
    });
    mockPost.mockResolvedValue({});

    // Setup fs mock
    const mockFs = vi.mocked(fs);
    mockFs.readFileSync.mockReturnValue('# Test markdown content');
    mockFs.existsSync.mockReturnValue(true);

    // Setup S3 mock
    vi.doMock('@aikb/s3-service', () => ({
      uploadFile: vi
        .fn()
        .mockResolvedValue({ url: 'https://mock-s3-url.com/file.pdf' }),
      uploadToS3: vi.fn().mockResolvedValue('https://mock-s3-url.com/file.pdf'),
    }));

    // Reset mock page count to default
    mockPageCount = 25;
  });

  describe('PDF Chunking Logic', () => {
    it('should identify when chunking is needed based on page count', async () => {
      // Set environment variables for testing
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20';
      process.env['PDF_CHUNK_SIZE'] = '10';
      process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'] = 'http://test-endpoint.com';

      // Test case 1: Page count below threshold - should not chunk
      mockPageCount = 15; // Set mock page count for this test
      const reqBelowThreshold = new Pdf2MArkdownDto(
        'test-item-1',
        'pdf',
        1024,
        'test-hash-1',
        new Date(),
        'test-s3-key-1',
        15, // pageCount - below threshold
        1000,
      );

      const result1 = await service.handlePdf2MdRequest(reqBelowThreshold);

      // Verify no chunking occurred
      expect(result1.chunked).toBe(false);
      expect(result1.itemId).toBe('test-item-1');
      expect(result1.pageNum).toBe(15);

      // Test case 2: Page count above threshold - should chunk
      mockPageCount = 25; // Set mock page count for this test
      const reqAboveThreshold = new Pdf2MArkdownDto(
        'test-item-2',
        'pdf',
        1024,
        'test-hash-2',
        new Date(),
        'test-s3-key-2',
        25, // pageCount - above threshold
        1000,
      );

      const result2 = await service.handlePdf2MdRequest(reqAboveThreshold);

      // Verify chunking occurred
      expect(result2.chunked).toBe(true);
      expect(result2.itemId).toBe('test-item-2');
      expect(result2.pageNum).toBe(25);
      expect(result2.chunkCount).toBe(3); // 25 pages / 10 per chunk = 3 chunks
      expect(result2.chunkSize).toBe(10);
    });

    it('should use correct chunk size calculations', async () => {
      // Test different chunk size configurations
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '10';
      process.env['PDF_CHUNK_SIZE'] = '3';
      process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'] = 'http://test-endpoint.com';

      mockPageCount = 11; // Set mock page count for this test
      const req = new Pdf2MArkdownDto(
        'test-item-chunk-calc',
        'pdf',
        1024,
        'test-hash',
        new Date(),
        'test-s3-key',
        11, // pageCount - should create 4 chunks (3+3+3+2)
        1000,
      );

      const result = await service.handlePdf2MdRequest(req);

      // Verify chunking occurred with correct calculations
      expect(result.chunked).toBe(true);
      expect(result.itemId).toBe('test-item-chunk-calc');
      expect(result.pageNum).toBe(11);
      expect(result.chunkCount).toBe(4); // 11 pages / 3 per chunk = 4 chunks
      expect(result.chunkSize).toBe(3);
    });

    it('should handle edge case when page count equals threshold', async () => {
      // Test when page count exactly equals threshold
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20';
      process.env['PDF_CHUNK_SIZE'] = '10';
      process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'] = 'http://test-endpoint.com';

      mockPageCount = 20; // Set mock page count for this test
      const req = new Pdf2MArkdownDto(
        'test-item-equal-threshold',
        'pdf',
        1024,
        'test-hash',
        new Date(),
        'test-s3-key',
        20, // pageCount - exactly equals threshold
        1000,
      );

      const result = await service.handlePdf2MdRequest(req);

      // Verify no chunking occurred (equal to threshold means no chunking)
      expect(result.chunked).toBe(false);
      expect(result.itemId).toBe('test-item-equal-threshold');
      expect(result.pageNum).toBe(20);
    });

    it('should use default values when environment variables are not set', async () => {
      // Clear environment variables
      delete process.env['PDF_CHUNK_SIZE_THRESHOLD'];
      delete process.env['PDF_CHUNK_SIZE'];
      process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'] = 'http://test-endpoint.com';

      mockPageCount = 25; // Set mock page count for this test
      const req = new Pdf2MArkdownDto(
        'test-item-defaults',
        'pdf',
        1024,
        'test-hash',
        new Date(),
        'test-s3-key',
        25, // pageCount - above default threshold of 20
        1000,
      );

      const result = await service.handlePdf2MdRequest(req);

      // Verify chunking occurred with default values
      expect(result.chunked).toBe(true);
      expect(result.itemId).toBe('test-item-defaults');
      expect(result.pageNum).toBe(25);
      expect(result.chunkCount).toBe(3); // 25 pages / 10 (default) per chunk = 3 chunks
      expect(result.chunkSize).toBe(10); // default chunk size
    });
  });

  describe('PDF Splitting Logic', () => {
    it('should calculate correct page ranges for chunks', async () => {
      // Test internal splitting logic
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '10';
      process.env['PDF_CHUNK_SIZE'] = '5';
      process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'] = 'http://test-endpoint.com';

      mockPageCount = 12; // Set mock page count for this test
      const req = new Pdf2MArkdownDto(
        'test-item-page-ranges',
        'pdf',
        1024,
        'test-hash',
        new Date(),
        'test-s3-key',
        12, // pageCount - should create 3 chunks (5+5+2)
        1000,
      );

      const result = await service.handlePdf2MdRequest(req);

      // Verify chunking occurred with correct page ranges
      expect(result.chunked).toBe(true);
      expect(result.itemId).toBe('test-item-page-ranges');
      expect(result.pageNum).toBe(12);
      expect(result.chunkCount).toBe(3); // 12 pages / 5 per chunk = 3 chunks
      expect(result.chunkSize).toBe(5);

      // Verify chunk page ranges
      expect(result.chunks![0]).toMatchObject({
        chunkIndex: 0,
        startPage: 1,
        endPage: 5,
      });
      expect(result.chunks![1]).toMatchObject({
        chunkIndex: 1,
        startPage: 6,
        endPage: 10,
      });
      expect(result.chunks![2]).toMatchObject({
        chunkIndex: 2,
        startPage: 11,
        endPage: 12,
      });
    });

    it('should handle single page chunks', async () => {
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '5';
      process.env['PDF_CHUNK_SIZE'] = '1';
      process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'] = 'http://test-endpoint.com';

      mockPageCount = 3; // Set mock page count for this test
      const req = new Pdf2MArkdownDto(
        'test-item-single-page',
        'pdf',
        1024,
        'test-hash',
        new Date(),
        'test-s3-key',
        3, // pageCount - should create 3 chunks of 1 page each
        1000,
      );

      const result = await service.handlePdf2MdRequest(req);

      // Verify single page chunks
      expect(result.chunked).toBe(false); // 3 pages with threshold 5 means no chunking
      expect(result.itemId).toBe('test-item-single-page');
      expect(result.pageNum).toBe(3);
      // Since no chunking, chunkCount and chunkSize should not be present
      expect(result.chunkCount).toBeUndefined();
      expect(result.chunkSize).toBeUndefined();
      // Since no chunking, chunks should not be present
      expect(result.chunks).toBeUndefined();
    });
  });
});
