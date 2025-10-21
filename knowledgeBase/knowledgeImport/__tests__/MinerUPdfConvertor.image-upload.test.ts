import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MinerUPdfConvertor } from '../MinerU/MinerUPdfConvertor';
import type { ImageUploadResult } from '../MinerU/MinerUPdfConvertor';

// Mock the S3 service
vi.mock('../../../lib/s3Service/S3Service', () => ({
  uploadToS3: vi.fn(),
  uploadPdfFromPath: vi.fn(),
}));

// Mock the MinerU client
vi.mock('../MinerU/MinerUClient', () => ({
  MinerUClient: vi.fn().mockImplementation(() => ({
    processSingleFile: vi.fn(),
    processBatchFiles: vi.fn(),
    waitForBatchTaskCompletion: vi.fn(),
    createBatchUrlTask: vi.fn(),
    cancelTask: vi.fn(),
    getTaskResult: vi.fn(),
    validateToken: vi.fn(),
  })),
  SingleFileRequest: {},
  TaskResult: {},
  MinerUDefaultConfig: {
    token: '',
    baseUrl: '',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
  },
}));

// Mock yauzl for ZIP file handling
vi.mock('yauzl', () => ({
  default: {
    open: vi.fn(),
  },
}));

// Mock fs for file operations
vi.mock('fs', async () => {
  const actual = await import('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    rmSync: vi.fn(),
    unlinkSync: vi.fn(),
    createReadStream: vi.fn(),
  };
});

describe('MinerUPdfConvertor Image Upload', () => {
  let converter: MinerUPdfConvertor;
  const mockConfig = {
    token: 'test-token',
    baseUrl: 'https://test.api.com',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    downloadDir: './test/download',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    converter = new MinerUPdfConvertor(mockConfig);
  });

  it('should include uploadedImages in ConversionResult when images are found', async () => {
    const { uploadToS3 } = await import('../../../lib/s3Service/S3Service.js');
    const yauzl = await import('yauzl');

    // Mock successful image uploads
    const mockUploadToS3 = uploadToS3 as any;
    mockUploadToS3.mockResolvedValue(
      'https://test-bucket.s3.amazonaws.com/images/test-image.jpg',
    );

    // Mock ZIP file with images
    const mockZipfile = {
      on: vi.fn(),
      readEntry: vi.fn(),
    };

    const mockYauzl = yauzl.default as any;
    mockYauzl.open.mockImplementation((zipPath, options, callback) => {
      // Simulate successful ZIP opening
      callback(null, mockZipfile);

      // Set up event handlers
      setTimeout(() => {
        const handlers = mockZipfile.on.mock.calls;
        const entryHandler = handlers.find((call) => call[0] === 'entry');

        if (entryHandler) {
          const entryCallback = entryHandler[1];

          // Simulate markdown file entry
          entryCallback({
            fileName: 'output.md',
          });

          // Simulate image file entry
          entryCallback({
            fileName: 'images/test-image.jpg',
          });
        }

        const endHandler = handlers.find((call) => call[0] === 'end');
        if (endHandler) {
          const endCallback = endHandler[1];
          endCallback();
        }
      }, 0);
    });

    // Mock the client to return a successful result
    const mockClient = (converter as any).client;
    mockClient.processSingleFile.mockResolvedValue({
      downloadedFiles: ['test-file.zip'],
      result: { task_id: 'test-task-id' },
    });

    // Execute the conversion
    const result = await converter.convertPdfToMarkdownFromS3(
      'https://test-s3-url.com/file.pdf',
    );

    // Verify the result includes uploaded images
    expect(result.success).toBe(true);
    expect(result.uploadedImages).toBeDefined();
    expect(Array.isArray(result.uploadedImages)).toBe(true);

    if (result.uploadedImages) {
      expect(result.uploadedImages.length).toBeGreaterThan(0);
      expect(result.uploadedImages[0]).toMatchObject({
        originalPath: 'images/test-image.jpg',
        s3Url: 'https://test-bucket.s3.amazonaws.com/images/test-image.jpg',
        fileName: expect.stringContaining('test-image.jpg'),
      });
    }
  });

  it('should update markdown content with S3 URLs', async () => {
    const { uploadToS3 } = await import('../../../lib/s3Service/S3Service.js');
    const yauzl = await import('yauzl');

    // Mock successful image uploads
    const mockUploadToS3 = uploadToS3 as any;
    mockUploadToS3.mockResolvedValue(
      'https://test-bucket.s3.amazonaws.com/images/test-image.jpg',
    );

    // Mock ZIP file with images and markdown content
    const mockZipfile = {
      on: vi.fn(),
      readEntry: vi.fn(),
    };

    const mockYauzl = yauzl.default as any;
    mockYauzl.open.mockImplementation((zipPath, options, callback) => {
      callback(null, mockZipfile);

      setTimeout(() => {
        const handlers = mockZipfile.on.mock.calls;

        // Set up entry handler
        const entryHandler = handlers.find((call) => call[0] === 'entry');
        if (entryHandler) {
          const entryCallback = entryHandler[1];

          // Simulate markdown file entry with image references
          entryCallback({
            fileName: 'output.md',
          });

          // Simulate image file entry
          entryCallback({
            fileName: 'images/test-image.jpg',
          });
        }

        // Set up end handler
        const endHandler = handlers.find((call) => call[0] === 'end');
        if (endHandler) {
          const endCallback = endHandler[1];
          endCallback();
        }
      }, 0);
    });

    // Mock read stream for markdown content
    const mockReadStream = {
      on: vi.fn(),
    };

    (mockZipfile as any).openReadStream = vi.fn((entry, callback) => {
      if (entry.fileName === 'output.md') {
        // Mock markdown content with image references
        const mockChunks = [
          Buffer.from(
            '# Test Document\n\nHere is an image: ![Test Image](images/test-image.jpg)\n\nAnother reference: ./images/test-image.jpg',
          ),
        ];

        setTimeout(() => {
          const handlers = mockReadStream.on.mock.calls;

          // Data event
          const dataHandler = handlers.find((call) => call[0] === 'data');
          if (dataHandler) {
            mockChunks.forEach((chunk) => dataHandler[1](chunk));
          }

          // End event
          const endHandler = handlers.find((call) => call[0] === 'end');
          if (endHandler) {
            endHandler[1]();
          }
        }, 0);

        callback(null, mockReadStream);
      } else if (entry.fileName === 'images/test-image.jpg') {
        // Mock image content
        const mockImageChunk = Buffer.from('fake-image-content');

        setTimeout(() => {
          const handlers = mockReadStream.on.mock.calls;

          // Data event
          const dataHandler = handlers.find((call) => call[0] === 'data');
          if (dataHandler) {
            dataHandler[1](mockImageChunk);
          }

          // End event
          const endHandler = handlers.find((call) => call[0] === 'end');
          if (endHandler) {
            endHandler[1]();
          }
        }, 0);

        callback(null, mockReadStream);
      }
    });

    // Mock the client
    const mockClient = (converter as any).client;
    mockClient.processSingleFile.mockResolvedValue({
      downloadedFiles: ['test-file.zip'],
      result: { task_id: 'test-task-id' },
    });

    // Execute the conversion
    const result = await converter.convertPdfToMarkdownFromS3(
      'https://test-s3-url.com/file.pdf',
    );

    // Verify the markdown content has been updated with S3 URLs
    expect(result.success).toBe(true);
    expect(result.data).toContain(
      'https://test-bucket.s3.amazonaws.com/images/test-image.jpg',
    );
    expect(result.data).not.toContain('images/test-image.jpg');
  });

  it('should handle image upload failures gracefully', async () => {
    const { uploadToS3 } = await import('../../../lib/s3Service/S3Service.js');
    const yauzl = await import('yauzl');

    // Mock failed image upload
    const mockUploadToS3 = uploadToS3 as any;
    mockUploadToS3.mockRejectedValue(new Error('Upload failed'));

    // Mock ZIP file with images
    const mockZipfile = {
      on: vi.fn(),
      readEntry: vi.fn(),
    };

    const mockYauzl = yauzl.default as any;
    mockYauzl.open.mockImplementation((zipPath, options, callback) => {
      callback(null, mockZipfile);

      setTimeout(() => {
        const handlers = mockZipfile.on.mock.calls;

        const entryHandler = handlers.find((call) => call[0] === 'entry');
        if (entryHandler) {
          const entryCallback = entryHandler[1];

          entryCallback({
            fileName: 'output.md',
          });

          entryCallback({
            fileName: 'images/test-image.jpg',
          });
        }

        const endHandler = handlers.find((call) => call[0] === 'end');
        if (endHandler) {
          const endCallback = endHandler[1];
          endCallback();
        }
      }, 0);
    });

    // Mock the client
    const mockClient = (converter as any).client;
    mockClient.processSingleFile.mockResolvedValue({
      downloadedFiles: ['test-file.zip'],
      result: { task_id: 'test-task-id' },
    });

    // Execute the conversion
    const result = await converter.convertPdfToMarkdownFromS3(
      'https://test-s3-url.com/file.pdf',
    );

    // Verify the conversion still succeeds even if image upload fails
    expect(result.success).toBe(true);
    expect(result.uploadedImages).toBeDefined();
    expect(result.uploadedImages?.length).toBe(0); // No images uploaded successfully
  });
});
