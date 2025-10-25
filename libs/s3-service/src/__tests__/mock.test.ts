import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockS3Service } from '../mock';
import { S3ServiceError, S3ServiceErrorType } from '../types';

describe('MockS3Service', () => {
  let mockService: MockS3Service;

  beforeEach(() => {
    mockService = new MockS3Service();
  });

  describe('constructor', () => {
    it('should create MockS3Service with default config', () => {
      expect(mockService.getBucketName()).toBe('mock-bucket');
      expect(mockService.getRegion()).toBe('mock-region');
      expect(mockService.getEndpoint()).toBe('mock-endpoint.com');
    });

    it('should create MockS3Service with custom config', () => {
      const customService = new MockS3Service({
        bucketName: 'custom-bucket',
        region: 'custom-region',
        endpoint: 'custom-endpoint.com',
      });

      expect(customService.getBucketName()).toBe('custom-bucket');
      expect(customService.getRegion()).toBe('custom-region');
      expect(customService.getEndpoint()).toBe('custom-endpoint.com');
    });
  });

  describe('uploadToS3', () => {
    it('should return mock upload result', async () => {
      const buffer = Buffer.from('test content');
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      const result = await mockService.uploadToS3(buffer, fileName, { contentType });

      expect(result.url).toBe('https://mock-bucket.mock-endpoint.com/test-file.txt');
      expect(result.bucket).toBe('mock-bucket');
      expect(result.key).toBe('test-file.txt');
    });

    it('should simulate upload delay', async () => {
      const startTime = Date.now();
      
      await mockService.uploadToS3(
        Buffer.from('test content'),
        'test-file.txt',
        { contentType: 'text/plain' }
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 100ms (simulated delay)
      expect(duration).toBeGreaterThanOrEqual(90);
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should return mock signed upload URL', async () => {
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      const result = await mockService.getSignedUploadUrl(fileName, { contentType });

      expect(result).toContain('https://mock-bucket.mock-endpoint.com/test-file.txt');
      expect(result).toContain('signature=mock-signature');
      expect(result).toContain('expires=');
    });

    it('should simulate URL generation delay', async () => {
      const startTime = Date.now();
      
      await mockService.getSignedUploadUrl(
        'test-file.txt',
        { contentType: 'text/plain' }
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 50ms (simulated delay)
      expect(duration).toBeGreaterThanOrEqual(40);
    });
  });

  describe('uploadPdfFromPath', () => {
    it('should return mock PDF upload result', async () => {
      const pdfPath = '/path/to/test.pdf';
      const s3Key = 'uploads/test.pdf';

      const result = await mockService.uploadPdfFromPath(pdfPath, s3Key);

      expect(result.url).toBe('https://mock-bucket.mock-endpoint.com/uploads/test.pdf');
      expect(result.bucket).toBe('mock-bucket');
      expect(result.key).toBe('uploads/test.pdf');
    });

    it('should use filename from path when s3Key is not provided', async () => {
      const pdfPath = '/path/to/document.pdf';

      const result = await mockService.uploadPdfFromPath(pdfPath);

      expect(result.key).toBe('document.pdf');
      expect(result.url).toBe('https://mock-bucket.mock-endpoint.com/document.pdf');
    });

    it('should simulate PDF processing delay', async () => {
      const startTime = Date.now();
      
      await mockService.uploadPdfFromPath('/path/to/test.pdf');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 150ms (simulated delay)
      expect(duration).toBeGreaterThanOrEqual(140);
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should return mock signed download URL', async () => {
      const s3Key = 'test-file.pdf';

      const result = await mockService.getSignedDownloadUrl(s3Key);

      expect(result).toContain('https://mock-bucket.mock-endpoint.com/test-file.pdf');
      expect(result).toContain('signature=mock-download-signature');
      expect(result).toContain('expires=');
    });

    it('should return mock signed download URL with custom bucket', async () => {
      const s3Key = 'test-file.pdf';
      const customBucket = 'custom-bucket';

      const result = await mockService.getSignedDownloadUrl(s3Key, { bucketName: customBucket });

      expect(result).toContain('https://custom-bucket.mock-endpoint.com/test-file.pdf');
      expect(result).toContain('signature=mock-download-signature');
      expect(result).toContain('expires=');
    });

    it('should simulate download URL generation delay', async () => {
      const startTime = Date.now();
      
      await mockService.getSignedDownloadUrl('test-file.pdf');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 50ms (simulated delay)
      expect(duration).toBeGreaterThanOrEqual(40);
    });
  });

  describe('deleteFromS3', () => {
    it('should return true for successful deletion', async () => {
      const s3Key = 'test-file.txt';

      const result = await mockService.deleteFromS3(s3Key);

      expect(result).toBe(true);
    });

    it('should simulate deletion delay', async () => {
      const startTime = Date.now();
      
      await mockService.deleteFromS3('test-file.txt');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should take at least 100ms (simulated delay)
      expect(duration).toBeGreaterThanOrEqual(90);
    });
  });

  describe('error simulation methods', () => {
    it('should simulate upload error', async () => {
      const buffer = Buffer.from('test content');
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';

      await expect(
        mockService.uploadWithError(buffer, fileName, { contentType }, 'Custom upload error')
      ).rejects.toThrow(S3ServiceError);
      
      await expect(
        mockService.uploadWithError(buffer, fileName, { contentType }, 'Custom upload error')
      ).rejects.toThrow('Custom upload error');
    });

    it('should simulate download URL error', async () => {
      const s3Key = 'test-file.pdf';

      await expect(
        mockService.getSignedDownloadUrlWithError(s3Key, 'Custom download error')
      ).rejects.toThrow(S3ServiceError);
      
      await expect(
        mockService.getSignedDownloadUrlWithError(s3Key, 'Custom download error')
      ).rejects.toThrow('Custom download error');
    });
  });
});