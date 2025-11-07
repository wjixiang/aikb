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

// Mock service for testing
export { MockS3Service } from './mock';

// Factory functions for easy instantiation
export {
  createS3ServiceFromEnv,
  createS3Service,
  createAWSS3Service,
  createAliyunOSSService,
} from './factory';

// Legacy function exports for backward compatibility
import { ObjectCannedACL } from '@aws-sdk/client-s3';
import type { S3Service } from './S3Service';

// Lazy initialization for default instance
let defaultS3Service: S3Service | null = null;
let initializationAttempted = false;

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
 * @deprecated Use S3Service class instance instead
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
