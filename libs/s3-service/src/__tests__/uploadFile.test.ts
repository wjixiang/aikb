import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile } from '../index';
import { createS3Service } from '../factory';
import type { S3ServiceConfig } from '../types';

// Mock the factory module
vi.mock('../factory', () => ({
  createS3Service: vi.fn(),
  createS3ServiceFromEnv: vi.fn(),
}));

// Mock the S3Service class
vi.mock('../S3Service', () => ({
  S3Service: vi.fn().mockImplementation(() => ({
    uploadToS3: vi.fn(),
  })),
}));

describe('uploadFile', () => {
  const mockS3Config: S3ServiceConfig = {
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  };

  const mockBuffer = Buffer.from('test content');
  const mockUploadResult = {
    url: 'https://test-bucket.us-east-1.amazonaws.com/test-key',
    bucket: 'test-bucket',
    key: 'test-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should work with custom S3 config', async () => {
    const mockService = {
      uploadToS3: vi.fn().mockResolvedValue(mockUploadResult),
    };

    vi.mocked(createS3Service).mockReturnValue(mockService as any);

    const result = await uploadFile(
      mockS3Config,
      'test-key',
      mockBuffer,
      'text/plain',
      'private',
    );

    expect(createS3Service).toHaveBeenCalledWith(mockS3Config);
    expect(mockService.uploadToS3).toHaveBeenCalledWith(
      mockBuffer,
      'test-key',
      {
        contentType: 'text/plain',
        acl: 'private',
      },
    );
    expect(result).toEqual(mockUploadResult);
  });

  it('should use default content type when not provided', async () => {
    const mockService = {
      uploadToS3: vi.fn().mockResolvedValue(mockUploadResult),
    };

    vi.mocked(createS3Service).mockReturnValue(mockService as any);

    const result = await uploadFile(mockS3Config, 'test-key', mockBuffer);

    expect(createS3Service).toHaveBeenCalledWith(mockS3Config);
    expect(mockService.uploadToS3).toHaveBeenCalledWith(
      mockBuffer,
      'test-key',
      {
        contentType: 'application/octet-stream',
        acl: 'private',
      },
    );
    expect(result).toEqual(mockUploadResult);
  });

  it('should throw error when s3Config is missing', async () => {
    await expect(
      uploadFile(null as any, 'test-key', mockBuffer),
    ).rejects.toThrow('Missing required parameter: s3Config is required');
  });

  it('should throw error when s3Key is missing', async () => {
    await expect(uploadFile(mockS3Config, '', mockBuffer)).rejects.toThrow(
      'Missing required parameter: s3Key is required',
    );
  });

  it('should throw error when buffer is missing', async () => {
    await expect(
      uploadFile(mockS3Config, 'test-key', Buffer.alloc(0)),
    ).rejects.toThrow(
      'Missing required parameter: buffer is required and cannot be empty',
    );
  });

  it('should work with minimal parameters using custom config', async () => {
    const mockService = {
      uploadToS3: vi.fn().mockResolvedValue(mockUploadResult),
    };

    vi.mocked(createS3Service).mockReturnValue(mockService as any);

    const result = await uploadFile(mockS3Config, 'test-key', mockBuffer);

    expect(createS3Service).toHaveBeenCalledWith(mockS3Config);
    expect(mockService.uploadToS3).toHaveBeenCalledWith(
      mockBuffer,
      'test-key',
      {
        contentType: 'application/octet-stream',
        acl: 'private',
      },
    );
    expect(result).toEqual(mockUploadResult);
  });
});
