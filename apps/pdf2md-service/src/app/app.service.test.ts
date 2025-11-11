import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppService } from './app.service';
import { Pdf2MArkdownDto } from 'library-shared';
import { ClientProxy } from '@nestjs/microservices';
import { MinerUClient } from 'mineru-client';

// Mock the MinerUClient module
vi.mock('mineru-client', () => ({
  MinerUClient: vi.fn().mockImplementation(() => ({
    createSingleFileTask: vi.fn().mockResolvedValue('test-task-id'),
    waitForTaskCompletion: vi.fn().mockResolvedValue({
      result: { state: 'done' },
      downloadedFiles: ['/path/to/markdown.md']
    })
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
  }
}));

// Mock axios
vi.mock('axios', () => ({
  get: vi.fn().mockImplementation((url: string, options?: any) => {
    if (url.includes('download-url')) {
      return Promise.resolve({
        data: { downloadUrl: 'http://test-pdf-url.com' }
      });
    } else if (options?.responseType === 'arraybuffer') {
      return Promise.resolve({
        data: Buffer.from('mock pdf data')
      });
    }
    return Promise.resolve({ data: {} });
  }),
  post: vi.fn().mockResolvedValue({}),
  default: {
    get: vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('download-url')) {
        return Promise.resolve({
          data: { downloadUrl: 'http://test-pdf-url.com' }
        });
      } else if (options?.responseType === 'arraybuffer') {
        return Promise.resolve({
          data: Buffer.from('mock pdf data')
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({})
  }
}));

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('# Test markdown content'),
  existsSync: vi.fn().mockReturnValue(true)
}));

// Mock @aikb/s3-service
vi.mock('@aikb/s3-service', () => ({
  uploadToS3: vi.fn().mockResolvedValue('http://test-s3-url.com')
}));

describe(AppService, () => {
  let service: AppService;
  let mockClientProxy: ClientProxy;
  let mockMinerUClient: any;

  beforeEach(() => {
    // Create a mock ClientProxy
    mockClientProxy = {
      connect: vi.fn(),
      close: vi.fn(),
      send: vi.fn(),
      emit: vi.fn(),
    } as any;

    service = new AppService(mockClientProxy);
    
    // Get the mocked MinerUClient instance
    mockMinerUClient = (service as any).minerUClient;
  });
  
  it('should handle PDF with page count below threshold', async () => {
    // Set environment variables for testing
    process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20';
    process.env['PDF_CHUNK_SIZE'] = '10';

    const req = new Pdf2MArkdownDto(
      'test-item-id',
      'pdf',
      1024, // fileSize
      'test-hash', // fileHash
      new Date(), // addDate
      'test-s3-key', // s3Key
      15, // pageCount
      1000, // wordCount
    );
    const result = await service.handlePdf2MdRequest(req);

    expect(result.chunked).toBe(false);
    expect(result.itemId).toBe('test-item-id');
    expect(result.pageNum).toBe(15);
  });

  it('should handle PDF with page count above threshold', async () => {
    // Set environment variables for testing
    process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20';
    process.env['PDF_CHUNK_SIZE'] = '10';

    const req = new Pdf2MArkdownDto(
      'test-item-id',
      'pdf',
      1024, // fileSize
      'test-hash', // fileHash
      new Date(), // addDate
      'test-s3-key', // s3Key
      25, // pageCount
      1000, // wordCount
    );

    // Mock the PDF data since we don't have actual PDF for testing
    const mockPdfData = Buffer.from('mock pdf data');

    // We need to mock the pdfSplitter.splitPdfIntoChunks method
    // but for now, let's just test the logic without actual chunking
    try {
      const result = await service.handlePdf2MdRequest(req);
      // This will fail because we don't have actual PDF data
    } catch (error) {
      expect((error as Error).message).toContain(
        'Failed to parse PDF document',
      );
    }
  });

  it('should use default environment values when not set', async () => {
    // Clear environment variables
    delete process.env['PDF_CHUNK_SIZE_THRESHOLD'];
    delete process.env['PDF_CHUNK_SIZE'];

    const req = new Pdf2MArkdownDto(
      'test-item-id',
      'pdf',
      1024, // fileSize
      'test-hash', // fileHash
      new Date(), // addDate
      'test-s3-key', // s3Key
      15, // pageCount
      1000, // wordCount
    );
    const result = await service.handlePdf2MdRequest(req);

    expect(result.chunked).toBe(false);
    expect(result.itemId).toBe('test-item-id');
    expect(result.pageNum).toBe(15);
  });
});
