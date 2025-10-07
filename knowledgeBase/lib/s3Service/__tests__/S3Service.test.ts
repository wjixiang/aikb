import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadToS3, getSignedUploadUrl } from '../S3Service';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => {
  const mockS3Client = {
    send: vi.fn().mockResolvedValue({}),
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
  };
  
  return {
    S3Client: vi.fn().mockImplementation(() => mockS3Client),
    PutObjectCommand: vi.fn().mockImplementation((params) => ({ params })),
    ObjectCannedACL: {
      private: 'private',
      'public-read': 'public-read',
    },
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-signed-url.com'),
}));

describe('S3Service', () => {
  beforeEach(() => {
    // Clear require cache to ensure fresh module loading
    vi.resetModules();
    
    // Set up environment variables for tests
    process.env.OSS_ACCESS_KEY_ID = 'test-key';
    process.env.OSS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.PDF_OSS_BUCKET_NAME = 'test-bucket';
    process.env.OSS_REGION = 'us-east-1';
  });

  describe('uploadToS3', () => {
    it('should return the correct S3 URL after upload', async () => {
      // Re-import the module to get fresh environment variables
      const { uploadToS3 } = await import('../S3Service.js');
      
      const buffer = Buffer.from('test content');
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';
      
      const result = await uploadToS3(buffer, fileName, contentType);
      
      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/test-file.txt');
    });

    it('should handle errors during upload', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      
      // Create a new mock that rejects
      const errorMock = vi.fn().mockImplementation(() => ({
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
      
      // Override the mock
      vi.mocked(S3Client).mockImplementation(errorMock);
      
      // Re-import the module to get the new mock
      const { uploadToS3 } = await import('../S3Service.js');
      
      const buffer = Buffer.from('test content');
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';
      
      await expect(uploadToS3(buffer, fileName, contentType)).rejects.toThrow('Failed to upload file to S3: Upload failed');
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should return a signed URL', async () => {
      // Re-import the module to get fresh environment variables
      const { getSignedUploadUrl } = await import('../S3Service.js');
      
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';
      
      const result = await getSignedUploadUrl(fileName, contentType);
      
      expect(result).toBe('https://mock-signed-url.com');
    });

    it('should handle errors during URL generation', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      // Override the mock to reject
      vi.mocked(getSignedUrl).mockRejectedValue(new Error('URL generation failed'));
      
      // Re-import the module to get the new mock
      const { getSignedUploadUrl } = await import('../S3Service.js');
      
      const fileName = 'test-file.txt';
      const contentType = 'text/plain';
      
      await expect(getSignedUploadUrl(fileName, contentType)).rejects.toThrow('Failed to generate signed URL: URL generation failed');
    });
  });
});