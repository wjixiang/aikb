import { config } from 'dotenv';
import { S3Service } from './S3Service';
import { S3ServiceConfig } from './types';

// Cache for S3Service instances with LRU eviction
const s3ServiceCache = new Map<string, S3Service>();
const MAX_CACHE_SIZE = 10; // Limit cache size to prevent memory issues

/**
 * Generates a unique key for S3ServiceConfig object
 * @param config - S3Service configuration object
 * @returns Unique string key for caching
 */
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

/**
 * Manages cache size with LRU eviction
 * @param configKey - Configuration key to add to cache
 */
function manageCacheSize(configKey: string): void {
  if (s3ServiceCache.size >= MAX_CACHE_SIZE) {
    // Remove the oldest entry (first in Map)
    const firstKey = s3ServiceCache.keys().next().value;
    if (firstKey) {
      s3ServiceCache.delete(firstKey);
    }
  }
}

/**
 * Creates an S3Service instance from environment variables
 * This provides backward compatibility with the original implementation
 *
 * Environment variables required:
 * - OSS_ACCESS_KEY_ID: AWS/Aliyun OSS access key ID
 * - OSS_SECRET_ACCESS_KEY: AWS/Aliyun OSS secret access key
 * - PDF_OSS_BUCKET_NAME: Default bucket name for PDF operations
 * - OSS_REGION: S3/OSS region
 * - S3_ENDPOINT: S3/OSS endpoint (without protocol)
 *
 * @returns Configured S3Service instance
 * @throws Error if required environment variables are missing
 * @deprecated use `createS3Service`
 */
export function createS3ServiceFromEnv(): S3Service {
  // Load environment variables
  config();

  // Validate required environment variables
  const requiredEnvVars = [
    'OSS_ACCESS_KEY_ID',
    'OSS_SECRET_ACCESS_KEY',
    'PDF_OSS_BUCKET_NAME',
    'OSS_REGION',
    'S3_ENDPOINT',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }

  const s3Config: S3ServiceConfig = {
    accessKeyId: process.env['OSS_ACCESS_KEY_ID']!,
    secretAccessKey: process.env['OSS_SECRET_ACCESS_KEY']!,
    bucketName: process.env['PDF_OSS_BUCKET_NAME']!,
    region: process.env['OSS_REGION']!,
    endpoint: process.env['S3_ENDPOINT']!,
    forcePathStyle: false, // Use virtual hosted style for Aliyun OSS
    signingRegion: process.env['OSS_REGION'] || 'us-east-1',
  };

  return new S3Service(s3Config);
}

/**
 * Creates an S3Service instance with custom configuration
 * Uses intelligent caching with LRU eviction to balance performance and memory usage
 *
 * Performance considerations:
 * - For frequent calls with same config: High benefit (avoids S3Client creation)
 * - For frequent calls with different configs: Limited benefit (cache churn)
 * - Memory usage: Controlled by MAX_CACHE_SIZE
 *
 * @param config - S3Service configuration object
 * @returns Configured S3Service instance
 */
export function createS3Service(config: S3ServiceConfig): S3Service {
  const configKey = generateConfigKey(config);
  
  // Check if we already have an instance for this configuration
  const cachedInstance = s3ServiceCache.get(configKey);
  if (cachedInstance) {
    return cachedInstance;
  }
  
  // Manage cache size before adding new instance
  manageCacheSize(configKey);
  
  // Create new instance and cache it
  const newInstance = new S3Service(config);
  s3ServiceCache.set(configKey, newInstance);
  
  return newInstance;
}

/**
 * Clears the S3Service instance cache
 * Useful for testing or when you need to force recreation of instances
 */
export function clearS3ServiceCache(): void {
  s3ServiceCache.clear();
}

/**
 * Gets the current cache size (number of cached S3Service instances)
 * @returns Number of cached instances
 */
export function getS3ServiceCacheSize(): number {
  return s3ServiceCache.size;
}

/**
 * Gets cache statistics for monitoring and debugging
 * @returns Object with cache statistics
 */
export function getS3ServiceCacheStats(): {
  size: number;
  maxSize: number;
  keys: string[];
} {
  return {
    size: s3ServiceCache.size,
    maxSize: MAX_CACHE_SIZE,
    keys: Array.from(s3ServiceCache.keys()),
  };
}

/**
 * Preloads common configurations into cache
 * Useful for application startup to warm up the cache
 * @param configs - Array of common configurations to preload
 */
export function preloadS3ServiceCache(configs: S3ServiceConfig[]): void {
  configs.forEach(config => {
    const configKey = generateConfigKey(config);
    if (!s3ServiceCache.has(configKey)) {
      manageCacheSize(configKey);
      s3ServiceCache.set(configKey, new S3Service(config));
    }
  });
}

/**
 * Creates an S3Service instance optimized for AWS S3
 *
 * @param accessKeyId - AWS access key ID
 * @param secretAccessKey - AWS secret access key
 * @param bucketName - S3 bucket name
 * @param region - AWS region
 * @returns Configured S3Service instance for AWS S3
 */
export function createAWSS3Service(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  region: string = 'us-east-1',
): S3Service {
  return new S3Service({
    accessKeyId,
    secretAccessKey,
    bucketName,
    region,
    endpoint: 'amazonaws.com',
    forcePathStyle: true, // Use path style for AWS S3
  });
}

/**
 * Creates an S3Service instance optimized for Aliyun OSS
 *
 * @param accessKeyId - Aliyun OSS access key ID
 * @param secretAccessKey - Aliyun OSS secret access key
 * @param bucketName - OSS bucket name
 * @param region - Aliyun OSS region
 * @returns Configured S3Service instance for Aliyun OSS
 */
export function createAliyunOSSService(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  region: string = 'oss-cn-hangzhou',
): S3Service {
  return new S3Service({
    accessKeyId,
    secretAccessKey,
    bucketName,
    region,
    endpoint: 'aliyuncs.com',
    forcePathStyle: false, // Use virtual hosted style for Aliyun OSS
  });
}
