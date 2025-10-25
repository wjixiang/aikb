import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Service } from '../S3Service';
import { S3ServiceError, S3ServiceErrorType, S3ServiceConfig } from '../types';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const createMockS3Client = (shouldFail = false) => ({
    send: vi.fn().mockImplementation(() => {
      if (shouldFail) {
        throw new Error('Upload failed');
      }
      return {};
    }),
    config: {
      requestHandler: {},
      apiVersion: '2006-03-01',
    } as any,
    destroy: vi.fn(),
    middlewareStack: {
      add: vi.fn(),
      addRelativeTo: vi.fn(),
      remove: vi.fn(),
      removeByTag: vi.fn(),
      use: vi.fn(),
      concat: vi.fn(),
      applyToStack: vi.fn(),
      clone: vi.fn().mockReturnValue({
        add: vi.fn(),
        addRelativeTo: vi.fn(),
        remove: vi.fn(),
        removeByTag: vi.fn(),
        use: vi.fn(),
        concat: vi.fn(),
        applyToStack: vi.fn(),
        clone: vi.fn(),
      }),
    } as any,
  });

  return {
    S3Client: vi.fn().mockImplementation(() => createMockS3Client(false)),
    PutObjectCommand: vi.fn().mockImplementation((params) => ({ params })),
    GetObjectCommand: vi.fn().mockImplementation((params) => ({ params })),
    DeleteObjectCommand: vi.fn().mockImplementation((params) => ({ params })),
    ObjectCannedACL: {
      private: 'private',
      'public-read': 'public-read',
    },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.com'),
}));

// Mock fs and path for PDF upload tests
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('mock pdf content')),
}));

vi.mock('path', () => ({
  extname: vi.fn().mockReturnValue('.pdf'),
  basename: vi.fn().mockReturnValue('test-file.pdf'),
}));

describe('S3Service', () => {
  let s3Service: S3Service;
  let mockConfig: S3ServiceConfig;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    mockConfig = {
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucketName: 'test-bucket',
      region: 'us-east-1',
      endpoint: 'aliyuncs.com',
      forcePathStyle: false,
    };

    s3Service = new S3Service(mockConfig);
  });

  describe('constructor', () => {
    it('should create an S3Service instance with valid config', () => {
      expect(s3Service).toBeInstanceOf(S3Service);
      expect(s3Service.getBucketName()).toBe('test-bucket');
      expect(s3Service.getRegion()).toBe('us-east-1');
      expect(s3Service.getEndpoint()).toBe('aliyuncs.com');
    });

    it('should throw error for missing required config fields', () => {
      const invalidConfig = {
        accessKeyId: 'test-key',
        // Missing other required fields
      } as S3ServiceConfig;

      expect(() => new S3Service(invalidConfig)).toThrow(S3ServiceError);
      expect(() => new S3Service(invalidConfig)).toThrow('Missing required configuration fields');
    });
  });

  describe('uploadToS3', () => {
    it('should return the correct upload result', async () => {
      const buffer = Buffer.from('test content');
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      const result = await s3Service.uploadToS3(buffer, fileName, { contentType });

      expect(result.url).toBe('https://test-bucket.us-east-1.aliyuncs.com/test-file.txt');
      expect(result.bucket).toBe('test-bucket');
      expect(result.key).toBe('test-file.txt');
    });

    it('should handle upload errors', async () => {
      // Create a service that will fail
      const { S3Client } = await import('@aws-sdk/client-s3');
      vi.mocked(S3Client).mockImplementation(() => ({
        send: vi.fn().mockRejectedValue(new Error('Upload failed')),
        config: {
          requestHandler: {},
          apiVersion: '2006-03-01',
        } as any,
        destroy: vi.fn(),
        middlewareStack: {
          add: vi.fn(),
          addRelativeTo: vi.fn(),
          remove: vi.fn(),
          removeByTag: vi.fn(),
          use: vi.fn(),
          concat: vi.fn(),
          applyToStack: vi.fn(),
          clone: vi.fn().mockReturnValue({
            add: vi.fn(),
            addRelativeTo: vi.fn(),
            remove: vi.fn(),
            removeByTag: vi.fn(),
            use: vi.fn(),
            concat: vi.fn(),
            applyToStack: vi.fn(),
            clone: vi.fn(),
          }),
        } as any,
      }));

      const errorS3Service = new S3Service(mockConfig);

      const buffer = Buffer.from('test content');
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      await expect(errorS3Service.uploadToS3(buffer, fileName, { contentType }))
        .rejects.toThrow(S3ServiceError);
      await expect(errorS3Service.uploadToS3(buffer, fileName, { contentType }))
        .rejects.toThrow('Failed to upload file to S3: Upload failed');
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should return a signed URL', async () => {
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      const result = await s3Service.getSignedUploadUrl(fileName, { contentType });

      expect(result).toBe('https://mock-signed-url.com');
    });

    it('should handle URL generation errors', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Override the mock to reject
      vi.mocked(getSignedUrl).mockRejectedValue(
        new Error('URL generation failed'),
      );

      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      await expect(s3Service.getSignedUploadUrl(fileName, { contentType }))
        .rejects.toThrow(S3ServiceError);
      await expect(s3Service.getSignedUploadUrl(fileName, { contentType }))
        .rejects.toThrow('Failed to generate signed URL: URL generation failed');
    });
  });

  describe('uploadPdfFromPath', () => {
    it('should upload PDF from path successfully', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      
      const pdfPath = '/path/to/test.pdf';
      const s3Key = 'uploads/test.pdf';

      const result = await s3Service.uploadPdfFromPath(pdfPath, s3Key);

      expect(result.url).toBe('https://test-bucket.us-east-1.aliyuncs.com/uploads/test.pdf');
      expect(result.bucket).toBe('test-bucket');
      expect(result.key).toBe('uploads/test.pdf');
    });

    it('should handle file not found error', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);

      const pdfPath = '/path/to/nonexistent.pdf';

      await expect(s3Service.uploadPdfFromPath(pdfPath))
        .rejects.toThrow(S3ServiceError);
      await expect(s3Service.uploadPdfFromPath(pdfPath))
        .rejects.toThrow('PDF file not found at path: /path/to/nonexistent.pdf');
    });

    it('should handle invalid file type error', async () => {
      const { existsSync } = await import('fs');
      const { extname } = await import('path');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(extname).mockReturnValue('.txt');

      const pdfPath = '/path/to/test.txt';

      await expect(s3Service.uploadPdfFromPath(pdfPath))
        .rejects.toThrow(S3ServiceError);
      await expect(s3Service.uploadPdfFromPath(pdfPath))
        .rejects.toThrow('File is not a PDF: /path/to/test.txt');
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should return a signed download URL', async () => {
      const s3Key = 'test-file.pdf';

      const result = await s3Service.getSignedDownloadUrl(s3Key);

      expect(result).toBe('https://mock-signed-url.com');
    });

    it('should return a signed download URL with custom bucket', async () => {
      const s3Key = 'test-file.pdf';
      const customBucket = 'custom-bucket';

      const result = await s3Service.getSignedDownloadUrl(s3Key, { bucketName: customBucket });

      expect(result).toBe('https://mock-signed-url.com');
    });

    it('should handle download URL generation errors', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      // Override the mock to reject
      vi.mocked(getSignedUrl).mockRejectedValue(
        new Error('Download URL generation failed'),
      );

      const s3Key = 'test-file.pdf';

      await expect(s3Service.getSignedDownloadUrl(s3Key))
        .rejects.toThrow(S3ServiceError);
      await expect(s3Service.getSignedDownloadUrl(s3Key))
        .rejects.toThrow('Failed to generate download URL: Download URL generation failed');
    });
  });

  describe('deleteFromS3', () => {
    it('should delete file successfully', async () => {
      const s3Key = 'test-file.txt';

      const result = await s3Service.deleteFromS3(s3Key);

      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');

      // Create a new mock that rejects
      vi.mocked(S3Client).mockImplementation(() => ({
        send: vi.fn().mockRejectedValue(new Error('Delete failed')),
        config: {
          requestHandler: {},
          apiVersion: '2006-03-01',
        } as any,
        destroy: vi.fn(),
        middlewareStack: {
          add: vi.fn(),
          addRelativeTo: vi.fn(),
          remove: vi.fn(),
          removeByTag: vi.fn(),
          use: vi.fn(),
          concat: vi.fn(),
          applyToStack: vi.fn(),
          clone: vi.fn().mockReturnValue({
            add: vi.fn(),
            addRelativeTo: vi.fn(),
            remove: vi.fn(),
            removeByTag: vi.fn(),
            use: vi.fn(),
            concat: vi.fn(),
            applyToStack: vi.fn(),
            clone: vi.fn(),
          }),
        } as any,
      }));

      const errorS3Service = new S3Service(mockConfig);

      const s3Key = 'test-file.txt';

      await expect(errorS3Service.deleteFromS3(s3Key))
        .rejects.toThrow(S3ServiceError);
      await expect(errorS3Service.deleteFromS3(s3Key))
        .rejects.toThrow('Failed to delete file from S3: Delete failed');
    });
  });
});