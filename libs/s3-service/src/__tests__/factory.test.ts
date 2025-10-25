import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createS3ServiceFromEnv,
  createS3Service,
  createAWSS3Service,
  createAliyunOSSService,
} from '../factory';
import { S3Service } from '../S3Service';

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Factory Functions', () => {
  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.OSS_ACCESS_KEY_ID;
    delete process.env.OSS_SECRET_ACCESS_KEY;
    delete process.env.PDF_OSS_BUCKET_NAME;
    delete process.env.OSS_REGION;
    delete process.env.S3_ENDPOINT;
    
    vi.resetModules();
  });

  describe('createS3ServiceFromEnv', () => {
    it('should create S3Service from environment variables', () => {
      // Set up environment variables
      process.env.OSS_ACCESS_KEY_ID = 'env-key';
      process.env.OSS_SECRET_ACCESS_KEY = 'env-secret';
      process.env.PDF_OSS_BUCKET_NAME = 'env-bucket';
      process.env.OSS_REGION = 'env-region';
      process.env.S3_ENDPOINT = 'env-endpoint.com';

      const service = createS3ServiceFromEnv();

      expect(service).toBeInstanceOf(S3Service);
      expect(service.getBucketName()).toBe('env-bucket');
      expect(service.getRegion()).toBe('env-region');
      expect(service.getEndpoint()).toBe('env-endpoint.com');
    });

    it('should throw error when environment variables are missing', () => {
      // Don't set environment variables
      
      expect(() => createS3ServiceFromEnv()).toThrow(
        'Missing required environment variables: OSS_ACCESS_KEY_ID, OSS_SECRET_ACCESS_KEY, PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT'
      );
    });

    it('should throw error when some environment variables are missing', () => {
      // Set only some environment variables
      process.env.OSS_ACCESS_KEY_ID = 'env-key';
      process.env.OSS_SECRET_ACCESS_KEY = 'env-secret';
      // Missing other required variables
      
      expect(() => createS3ServiceFromEnv()).toThrow(
        'Missing required environment variables: PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT'
      );
    });
  });

  describe('createS3Service', () => {
    it('should create S3Service with custom config', () => {
      const config = {
        accessKeyId: 'custom-key',
        secretAccessKey: 'custom-secret',
        bucketName: 'custom-bucket',
        region: 'custom-region',
        endpoint: 'custom-endpoint.com',
        forcePathStyle: true,
      };

      const service = createS3Service(config);

      expect(service).toBeInstanceOf(S3Service);
      expect(service.getBucketName()).toBe('custom-bucket');
      expect(service.getRegion()).toBe('custom-region');
      expect(service.getEndpoint()).toBe('custom-endpoint.com');
    });
  });

  describe('createAWSS3Service', () => {
    it('should create S3Service optimized for AWS S3', () => {
      const service = createAWSS3Service(
        'aws-key',
        'aws-secret',
        'aws-bucket',
        'us-west-2'
      );

      expect(service).toBeInstanceOf(S3Service);
      expect(service.getBucketName()).toBe('aws-bucket');
      expect(service.getRegion()).toBe('us-west-2');
      expect(service.getEndpoint()).toBe('amazonaws.com');
    });

    it('should use default region when not provided', () => {
      const service = createAWSS3Service(
        'aws-key',
        'aws-secret',
        'aws-bucket'
      );

      expect(service.getRegion()).toBe('us-east-1');
    });
  });

  describe('createAliyunOSSService', () => {
    it('should create S3Service optimized for Aliyun OSS', () => {
      const service = createAliyunOSSService(
        'aliyun-key',
        'aliyun-secret',
        'aliyun-bucket',
        'oss-cn-beijing'
      );

      expect(service).toBeInstanceOf(S3Service);
      expect(service.getBucketName()).toBe('aliyun-bucket');
      expect(service.getRegion()).toBe('oss-cn-beijing');
      expect(service.getEndpoint()).toBe('aliyuncs.com');
    });

    it('should use default region when not provided', () => {
      const service = createAliyunOSSService(
        'aliyun-key',
        'aliyun-secret',
        'aliyun-bucket'
      );

      expect(service.getRegion()).toBe('oss-cn-hangzhou');
    });
  });
});