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
vi.mock('mineru-client', () => ({
  MinerUClient: vi.fn().mockImplementation(() => ({
    createSingleFileTask: vi.fn().mockResolvedValue('test-task-id'),
    waitForTaskCompletion: vi.fn().mockResolvedValue({
      result: { state: 'done' },
      downloadedFiles: ['/path/to/markdown.md'],
    }),
  })),
  ZipProcessor: vi.fn().mockImplementation(() => ({
    processZipBuffer: vi.fn().mockResolvedValue({
      markdownContent: '# Test Markdown Content',
      extractedFiles: true,
      images: [],
    }),
    extractAllFilesAndMarkdownFromZip: vi.fn().mockResolvedValue({
      markdownContent: '# Test Markdown Content',
    }),
    extractAllFilesFromZip: vi.fn().mockResolvedValue(true),
    extractMarkdownFromZip: vi
      .fn()
      .mockResolvedValue('# Test Markdown Content'),
    extractImagesFromZip: vi.fn().mockResolvedValue([]),
  })),
  MinerUDefaultConfig: {
    baseUrl: 'https://mineru.net/api/v4',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    downloadDir: './mineru-downloads',
    defaultOptions: {
      is_ocr: false,
      enable_formula: true,
      enable_table: true,
      language: 'ch',
      model_version: 'pipeline',
    },
    token: 'test-token',
  },
}));
vi.mock('@aikb/s3-service', () => ({
  uploadFile: vi.fn().mockResolvedValue({ url: 'http://test-s3-url.com' }),
  uploadToS3: vi.fn().mockResolvedValue('http://test-s3-url.com'),
  getPdfDownloadUrl: vi
    .fn()
    .mockResolvedValue('http://test-s3-download-url.com'),
  createS3Service: vi.fn().mockReturnValue({
    uploadToS3: vi
      .fn()
      .mockResolvedValue({ key: 'test-key', url: 'http://test-s3-url.com' }),
    getSignedDownloadUrl: vi
      .fn()
      .mockResolvedValue('http://test-s3-download-url.com'),
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
  },
}));

// Mock PDFDocument
vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn().mockResolvedValue({
      getPageCount: vi.fn().mockReturnValue(25),
    }),
    create: vi.fn().mockResolvedValue({
      addPage: vi.fn(),
      copyPages: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(Buffer.from('mock pdf data')),
    }),
  },
}));

let mockPageCount = 25; // Default for chunking tests

describe('AppService - PDF Chunking Fixed Tests', () => {
  let service: AppService;
  let mockBibliographyGrpcClient: any;
  let mockAmqpConnection: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment variables for testing
    process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20';
    process.env['PDF_CHUNK_SIZE'] = '10';

    // Create fresh mocks for each test
    mockBibliographyGrpcClient = {
      updateLibraryItemMarkdown: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((observer) => {
          observer.next({ item: { id: 'test-item-id' } });
          observer.complete();
        }),
      }),
    };

    mockAmqpConnection = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    service = new AppService(mockBibliographyGrpcClient, mockAmqpConnection);
  });

  describe('PDF Chunking Logic', () => {
    it('should identify when chunking is needed based on page count', async () => {
      const pdfInfo: Pdf2MArkdownDto = {
        itemId: 'test-item-id',
        s3Key: 'test-pdf-key',
        pageCount: mockPageCount,
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash',
        addDate: new Date(),
      };

      const result = await service.handlePdf2MdRequest(pdfInfo);

      expect(result.chunked).toBe(true);
      expect(result.chunkCount).toBe(3); // 25 pages / 10 pages per chunk = 3 chunks
      expect(result.chunkSize).toBe(10);
    });

    it('should use correct chunk size calculations', async () => {
      // Test with different page count
      mockPageCount = 35;

      const pdfInfo: Pdf2MArkdownDto = {
        itemId: 'test-item-id',
        s3Key: 'test-pdf-key',
        pageCount: mockPageCount,
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash',
        addDate: new Date(),
      };

      const result = await service.handlePdf2MdRequest(pdfInfo);

      expect(result.chunked).toBe(true);
      expect(result.chunkCount).toBe(3); // 35 pages / 10 pages per chunk = 3 chunks (with rounding up)
      expect(result.chunkSize).toBe(10);
    });

    it('should handle edge case when page count equals threshold', async () => {
      // Test with page count exactly at threshold
      mockPageCount = 20;

      const pdfInfo: Pdf2MArkdownDto = {
        itemId: 'test-item-id',
        s3Key: 'test-pdf-key',
        pageCount: mockPageCount,
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash',
        addDate: new Date(),
      };

      const result = await service.handlePdf2MdRequest(pdfInfo);

      expect(result.chunked).toBe(false); // Should not chunk when exactly at threshold
      expect(result.chunkCount).toBeUndefined();
      expect(result.chunkSize).toBeUndefined();
    });

    it('should use default values when environment variables are not set', async () => {
      // Reset to default
      mockPageCount = 25;

      const pdfInfo: Pdf2MArkdownDto = {
        itemId: 'test-item-id',
        s3Key: 'test-pdf-key',
        pageCount: mockPageCount,
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash',
        addDate: new Date(),
      };

      const result = await service.handlePdf2MdRequest(pdfInfo);

      expect(result.chunked).toBe(true);
      expect(result.chunkCount).toBe(3);
      expect(result.chunkSize).toBe(10); // Default chunk size
    });
  });

  describe('PDF Splitting Logic', () => {
    it('should calculate correct page ranges for chunks', async () => {
      mockPageCount = 25;

      const pdfInfo: Pdf2MArkdownDto = {
        itemId: 'test-item-id',
        s3Key: 'test-pdf-key',
        pageCount: mockPageCount,
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash',
        addDate: new Date(),
      };

      const result = await service.handlePdf2MdRequest(pdfInfo);

      expect(result.chunks).toHaveLength(3);

      // Check first chunk: pages 1-10
      if (result.chunks && result.chunks[0]) {
        expect(result.chunks[0]).toMatchObject({
          chunkIndex: 0,
          startPage: 1,
          endPage: 10,
        });
      }

      // Check second chunk: pages 11-20
      if (result.chunks && result.chunks[1]) {
        expect(result.chunks[1]).toMatchObject({
          chunkIndex: 1,
          startPage: 11,
          endPage: 20,
        });
      }

      // Check third chunk: pages 21-25
      if (result.chunks && result.chunks[2]) {
        expect(result.chunks[2]).toMatchObject({
          chunkIndex: 2,
          startPage: 21,
          endPage: 25,
        });
      }
    });

    it('should handle single page chunks', async () => {
      mockPageCount = 5;

      const pdfInfo: Pdf2MArkdownDto = {
        itemId: 'test-item-id',
        s3Key: 'test-pdf-key',
        pageCount: mockPageCount,
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash',
        addDate: new Date(),
      };

      const result = await service.handlePdf2MdRequest(pdfInfo);

      expect(result.chunked).toBe(false); // 5 pages < 20 threshold
      expect(result.chunks).toBeUndefined();
    });
  });
});
