// Main S3Service class and types
export { S3Service } from './S3Service';
export type {
  S3ServiceConfig,
  UploadOptions,
  SignedUrlOptions,
  UploadResult,
  DownloadUrlOptions,
} from './types';
export { S3ServiceErrorType, S3ServiceError } from './types';

// Import types for internal use
import type { UploadResult as UploadResultType } from './types';

// Mock service for testing
export { MockS3Service } from './mock';

// Factory functions for easy instantiation
export {
  createS3ServiceFromEnv,
  createS3Service,
  createAWSS3Service,
  createAliyunOSSService,
  clearS3ServiceCache,
  getS3ServiceCacheSize,
  getS3ServiceCacheStats,
  preloadS3ServiceCache,
} from './factory';

// Legacy function exports for backward compatibility
import { ObjectCannedACL } from '@aws-sdk/client-s3';
import type { S3Service } from './S3Service';
import { S3ServiceConfig } from './types';

// Lazy initialization for default instance
let defaultS3Service: S3Service | null = null;
let initializationAttempted = false;

/**
 * @deprecated
 * @returns 
 */
async function getDefaultS3Service(): Promise<S3Service> {
  if (!defaultS3Service && !initializationAttempted) {
    initializationAttempted = true;
    try {
      // Lazy import the factory to avoid eager initialization
      const { createS3ServiceFromEnv } = await import('./factory.js');
      defaultS3Service = createS3ServiceFromEnv();
    } catch (error) {
      console.error(
        'Failed to initialize S3 service from environment variables:',
        error,
      );
      throw new Error(
        `S3 service initialization failed: ${error instanceof Error ? error.message : String(error)}. Please ensure required environment variables are set: OSS_ACCESS_KEY_ID, OSS_SECRET_ACCESS_KEY, PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT`,
      );
    }
  }
  if (!defaultS3Service) {
    throw new Error(
      'S3 service not initialized. Please ensure required environment variables are set: OSS_ACCESS_KEY_ID, OSS_SECRET_ACCESS_KEY, PDF_OSS_BUCKET_NAME, OSS_REGION, S3_ENDPOINT',
    );
  }
  return defaultS3Service;
}

/**
 * Uploads a buffer to S3 and returns the public URL
 * @deprecated use uploadFile instead
 */
export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: ObjectCannedACL = 'private',
): Promise<string> {
  const service = await getDefaultS3Service();
  const result = await service.uploadToS3(buffer, fileName, {
    contentType,
    acl,
  });
  return result.url;
}


/**
 * Uploads a file to S3-compatible storage using the provided configuration
 *
 * @param s3Config - S3 service configuration object containing credentials and settings
 * @param s3Key - The key/name for the file in S3 (acts as the file path)
 * @param buffer - The file content as a Buffer
 * @param contentType - The MIME type of the file (default: 'application/octet-stream')
 * @param acl - The access control level for the uploaded file (default: 'private')
 *
 * @returns Promise resolving to upload result with URL and metadata
 *
 * @throws {Error} When s3Config is null or undefined
 * @throws {Error} When s3Key is empty or undefined
 * @throws {Error} When buffer is empty, null, or undefined
 * @throws {S3ServiceError} When the upload to S3 fails
 *
 * @example
 * ```typescript
 * const s3Config: S3ServiceConfig = {
 *   accessKeyId: 'your-access-key-id',
 *   secretAccessKey: 'your-secret-access-key',
 *   bucketName: 'your-bucket-name',
 *   region: 'us-east-1',
 *   endpoint: 'amazonaws.com',
 * };
 *
 * const fileBuffer = Buffer.from('Hello, World!', 'utf-8');
 *
 * const result = await uploadFile(
 *   s3Config,
 *   'uploads/hello.txt',
 *   fileBuffer,
 *   'text/plain',
 *   'private'
 * );
 *
 * console.log('File uploaded:', result.url);
 * ```
 *
 * @example
 * ```typescript
 * // Minimal parameters with defaults
 * const result = await uploadFile(
 *   s3Config,
 *   'uploads/data.bin',
 *   fileBuffer
 * );
 * // Uses default contentType: 'application/octet-stream' and acl: 'private'
 * ```
 */
export async function uploadFile(
  s3Config: S3ServiceConfig,
  s3Key: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream',
  acl: ObjectCannedACL = 'private',
): Promise<UploadResultType> {
  // Validate required parameters
  if (!s3Config) {
    throw new Error('Missing required parameter: s3Config is required');
  }
  
  if (!s3Key || s3Key.trim() === '') {
    throw new Error('Missing required parameter: s3Key is required');
  }
  
  if (!buffer || buffer.length === 0) {
    throw new Error('Missing required parameter: buffer is required and cannot be empty');
  }
  
  try {
    // Create a new service instance with the provided config
    const { createS3Service } = await import('./factory.js');
    const service = createS3Service(s3Config);
    
    // Upload the file using the service
    const result = await service.uploadToS3(buffer, s3Key, {
      contentType,
      acl,
    });
    
    return result;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Legacy function: Generates a presigned URL for direct upload to S3
 */
export async function getSignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600,
  acl: ObjectCannedACL = 'private',
): Promise<string> {
  const service = await getDefaultS3Service();
  return await service.getSignedUploadUrl(s3Key, {
    contentType,
    expiresIn,
    acl,
  });
}

/**
 * Legacy function: Uploads a PDF file from a local file path to S3
 * @deprecated Use S3Service class instance instead
 */
export async function uploadPdfFromPath(
  pdfPath: string,
  s3Key?: string,
  acl: ObjectCannedACL = 'private',
): Promise<string> {
  const service = await getDefaultS3Service();
  const result = await service.uploadPdfFromPath(pdfPath, s3Key, {
    acl,
  });
  return result.url;
}

/**
 * Legacy function: Gets a presigned URL for downloading a PDF
 */
export async function getPdfDownloadUrl(s3Key: string): Promise<string> {
  const service = await getDefaultS3Service();
  return await service.getSignedDownloadUrl(s3Key);
}

/**
 * Legacy function: Deletes a file from S3
 * @deprecated Use S3Service class instance instead
 */
export async function deleteFromS3(s3Key: string): Promise<boolean> {
  const service = await getDefaultS3Service();
  return await service.deleteFromS3(s3Key);
}

/**
 * Legacy function: Gets a signed URL for download
 * @deprecated Use S3Service class instance instead
 */
export async function getSignedUrlForDownload(
  bucketName: string,
  s3Key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return await (
    await getDefaultS3Service()
  ).getSignedDownloadUrl(s3Key, {
    bucketName,
    expiresIn: expiresInSeconds,
  });
}
