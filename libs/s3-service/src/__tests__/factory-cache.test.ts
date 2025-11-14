import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createS3Service,
  clearS3ServiceCache,
  getS3ServiceCacheSize,
  getS3ServiceCacheStats,
  preloadS3ServiceCache
} from '../factory';
import type { S3ServiceConfig } from '../types';

// Mock the S3Service class
vi.mock('../S3Service', () => ({
  S3Service: vi.fn().mockImplementation(() => ({
    uploadToS3: vi.fn(),
  })),
}));

describe('S3Service Caching', () => {
  const mockS3Config: S3ServiceConfig = {
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-bucket',
    region: 'us-east-1',
    endpoint: 'amazonaws.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    clearS3ServiceCache();
  });

  it('should cache S3Service instances for same config', () => {
    // Create first instance
    const service1 = createS3Service(mockS3Config);
    expect(getS3ServiceCacheSize()).toBe(1);
    
    // Create second instance with same config
    const service2 = createS3Service(mockS3Config);
    expect(getS3ServiceCacheSize()).toBe(1); // Should still be 1, not 2
    
    // Should return the same instance
    expect(service1).toBe(service2);
  });

  it('should create new instances for different configs', () => {
    const config1 = { ...mockS3Config };
    const config2 = { ...mockS3Config, bucketName: 'different-bucket' };
    
    // Create instances with different configs
    const service1 = createS3Service(config1);
    expect(getS3ServiceCacheSize()).toBe(1);
    
    const service2 = createS3Service(config2);
    expect(getS3ServiceCacheSize()).toBe(2); // Should be 2 now
    
    // Should return different instances
    expect(service1).not.toBe(service2);
  });

  it('should create new instances for configs with different optional properties', () => {
    const config1 = { ...mockS3Config };
    const config2 = { ...mockS3Config, forcePathStyle: true };
    
    // Create instances with different optional properties
    const service1 = createS3Service(config1);
    expect(getS3ServiceCacheSize()).toBe(1);
    
    const service2 = createS3Service(config2);
    expect(getS3ServiceCacheSize()).toBe(2); // Should be 2 now
    
    // Should return different instances
    expect(service1).not.toBe(service2);
  });

  it('should clear cache', () => {
    // Create an instance
    createS3Service(mockS3Config);
    expect(getS3ServiceCacheSize()).toBe(1);
    
    // Clear cache
    clearS3ServiceCache();
    expect(getS3ServiceCacheSize()).toBe(0);
  });

  it('should handle multiple instances with same config after cache clear', () => {
    // Create first instance
    const service1 = createS3Service(mockS3Config);
    expect(getS3ServiceCacheSize()).toBe(1);
    
    // Clear cache
    clearS3ServiceCache();
    expect(getS3ServiceCacheSize()).toBe(0);
    
    // Create new instance with same config
    const service2 = createS3Service(mockS3Config);
    expect(getS3ServiceCacheSize()).toBe(1);
    
    // Should be different instances since cache was cleared
    expect(service1).not.toBe(service2);
  });

  it('should handle complex config objects correctly', () => {
    const complexConfig1: S3ServiceConfig = {
      ...mockS3Config,
      forcePathStyle: true,
      signingRegion: 'custom-region',
    };
    
    const complexConfig2: S3ServiceConfig = {
      ...mockS3Config,
      forcePathStyle: true,
      signingRegion: 'custom-region',
    };
    
    // Create instances with identical complex configs
    const service1 = createS3Service(complexConfig1);
    const service2 = createS3Service(complexConfig2);
    
    expect(getS3ServiceCacheSize()).toBe(1);
    expect(service1).toBe(service2);
  });

  it('should limit cache size with LRU eviction', () => {
    // Create 11 different configs (exceeds MAX_CACHE_SIZE of 10)
    const configs = Array.from({ length: 11 }, (_, i) => ({
      ...mockS3Config,
      bucketName: `bucket-${i}`,
    }));
    
    // Create instances for all configs
    const services = configs.map(config => createS3Service(config));
    
    // Cache should only contain 10 instances
    expect(getS3ServiceCacheSize()).toBe(10);
    
    // First instance should be evicted
    const firstService = services[0];
    const lastService = services[10];
    
    // Creating the first config again should create a new instance
    const firstServiceAgain = createS3Service(configs[0]);
    expect(firstServiceAgain).not.toBe(firstService);
  });

  it('should provide cache statistics', () => {
    createS3Service(mockS3Config);
    
    const stats = getS3ServiceCacheStats();
    
    expect(stats.size).toBe(1);
    expect(stats.maxSize).toBe(10);
    expect(stats.keys).toContain(generateConfigKey(mockS3Config));
  });

  it('should preload configurations', () => {
    const configs = [
      mockS3Config,
      { ...mockS3Config, bucketName: 'bucket-2' },
      { ...mockS3Config, bucketName: 'bucket-3' },
    ];
    
    // Clear cache first
    clearS3ServiceCache();
    expect(getS3ServiceCacheSize()).toBe(0);
    
    // Preload configurations
    preloadS3ServiceCache(configs);
    expect(getS3ServiceCacheSize()).toBe(3);
    
    // Creating instances with preloaded configs should return cached instances
    const service1 = createS3Service(configs[0]);
    const service2 = createS3Service(configs[1]);
    const service3 = createS3Service(configs[2]);
    
    expect(getS3ServiceCacheSize()).toBe(3); // Should still be 3
  });
});

// Helper function for testing
function generateConfigKey(config: S3ServiceConfig): string {
  return JSON.stringify({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucketName: config.bucketName,
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    signingRegion: config.signingRegion,
  });
}