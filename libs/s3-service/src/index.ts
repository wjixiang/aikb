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
import { createS3ServiceFromEnv } from './factory';
import { ObjectCannedACL } from '@aws-sdk/client-s3';

// Lazy initialization for default instance
let defaultS3Service: ReturnType<typeof createS3ServiceFromEnv> | null = null;

function getDefaultS3Service() {
  if (!defaultS3Service) {
    defaultS3Service = createS3ServiceFromEnv();
  }
  return defaultS3Service;
}

/**
 * Legacy function: Uploads a buffer to S3 and returns the public URL
 * @deprecated Use S3Service class instance instead
 */
export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: ObjectCannedACL = 'private',
): Promise<string> {
  const result = await getDefaultS3Service().uploadToS3(buffer, fileName, {
    contentType,
    acl,
  });
  return result.url;
}

/**
 * Legacy function: Generates a presigned URL for direct upload to S3
 * @deprecated Use S3Service class instance instead
 */
export async function getSignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600,
  acl: ObjectCannedACL = 'private',
): Promise<string> {
  return await getDefaultS3Service().getSignedUploadUrl(s3Key, {
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
  const result = await getDefaultS3Service().uploadPdfFromPath(pdfPath, s3Key, {
    acl,
  });
  return result.url;
}

/**
 * Legacy function: Gets a presigned URL for downloading a PDF
 * @deprecated Use S3Service class instance instead
 */
export async function getPdfDownloadUrl(s3Key: string): Promise<string> {
  return await getDefaultS3Service().getSignedDownloadUrl(s3Key);
}

/**
 * Legacy function: Deletes a file from S3
 * @deprecated Use S3Service class instance instead
 */
export async function deleteFromS3(s3Key: string): Promise<boolean> {
  return await getDefaultS3Service().deleteFromS3(s3Key);
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
  return await getDefaultS3Service().getSignedDownloadUrl(s3Key, {
    bucketName,
    expiresIn: expiresInSeconds,
  });
}
