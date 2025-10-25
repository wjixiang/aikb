import { ObjectCannedACL } from '@aws-sdk/client-s3';
import {
  S3ServiceConfig,
  UploadOptions,
  SignedUrlOptions,
  UploadResult,
  DownloadUrlOptions,
  S3ServiceError,
  S3ServiceErrorType,
} from './types';

/**
 * Mock S3 Service for testing purposes
 * Simulates S3 operations without actually connecting to S3
 */
export class MockS3Service {
  private readonly bucketName: string;
  private readonly region: string;
  private readonly endpoint: string;

  constructor(config: Partial<S3ServiceConfig> = {}) {
    this.bucketName = config.bucketName || 'mock-bucket';
    this.region = config.region || 'mock-region';
    this.endpoint = config.endpoint || 'mock-endpoint.com';
  }

  /**
   * Mock upload function that simulates uploading a buffer to S3
   */
  async uploadToS3(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions,
  ): Promise<UploadResult> {
    console.log(
      `[MockS3Service] Mock uploading: bucket=${this.bucketName}, key=${fileName}, contentType=${options.contentType}`,
    );

    // Simulate upload delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const url = `https://${this.bucketName}.${this.endpoint}/${fileName}`;
    console.log(`[MockS3Service] Mock upload successful: ${url}`);

    return {
      url,
      bucket: this.bucketName,
      key: fileName,
    };
  }

  /**
   * Mock function to generate a signed upload URL
   */
  async getSignedUploadUrl(
    fileName: string,
    options: SignedUrlOptions,
  ): Promise<string> {
    console.log(
      `[MockS3Service] Mock generating signed URL: key=${fileName}, expiresIn=${options.expiresIn || 3600}`,
    );

    // Simulate URL generation delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    const url = `https://${this.bucketName}.${this.endpoint}/${fileName}?signature=mock-signature&expires=${Date.now() + (options.expiresIn || 3600) * 1000}`;
    console.log(`[MockS3Service] Mock signed URL generated: ${url}`);
    return url;
  }

  /**
   * Mock function to upload a PDF from a local path
   */
  async uploadPdfFromPath(
    pdfPath: string,
    s3Key?: string,
    options: { acl?: ObjectCannedACL } = {},
  ): Promise<UploadResult> {
    console.log(
      `[MockS3Service] Mock uploadPdfFromPath: path=${pdfPath}, s3Key=${s3Key}`,
    );

    // Simulate file processing delay
    await new Promise((resolve) => setTimeout(resolve, 150));

    const fileName = s3Key || pdfPath.split('/').pop() || 'mock-file.pdf';
    const url = `https://${this.bucketName}.${this.endpoint}/${fileName}`;
    console.log(`[MockS3Service] Mock uploadPdfFromPath successful: ${url}`);

    return {
      url,
      bucket: this.bucketName,
      key: fileName,
    };
  }

  /**
   * Mock function to generate a signed download URL
   */
  async getSignedDownloadUrl(
    s3Key: string,
    options: DownloadUrlOptions & { bucketName?: string } = {},
  ): Promise<string> {
    const bucketName = options.bucketName || this.bucketName;

    console.log(
      `[MockS3Service] Mock generating download URL: bucket=${bucketName}, key=${s3Key}, expiresIn=${options.expiresIn || 3600}`,
    );

    // Simulate URL generation delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    const url = `https://${bucketName}.${this.endpoint}/${s3Key}?signature=mock-download-signature&expires=${Date.now() + (options.expiresIn || 3600) * 1000}`;
    console.log(`[MockS3Service] Mock download URL generated: ${url}`);
    return url;
  }

  /**
   * Mock function to delete a file from S3
   */
  async deleteFromS3(s3Key: string): Promise<boolean> {
    console.log(
      `[MockS3Service] Mock deleting: bucket=${this.bucketName}, key=${s3Key}`,
    );

    // Simulate deletion delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`[MockS3Service] Mock delete successful`);
    return true;
  }

  /**
   * Mock function to simulate upload errors
   */
  async uploadWithError(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions,
    errorMessage: string = 'Mock upload error',
  ): Promise<UploadResult> {
    console.log(`[MockS3Service] Simulating upload error for: ${fileName}`);

    // Simulate processing delay before error
    await new Promise((resolve) => setTimeout(resolve, 100));

    throw new S3ServiceError(S3ServiceErrorType.UPLOAD_ERROR, errorMessage);
  }

  /**
   * Mock function to simulate download URL generation errors
   */
  async getSignedDownloadUrlWithError(
    s3Key: string,
    errorMessage: string = 'Mock download URL error',
  ): Promise<string> {
    console.log(`[MockS3Service] Simulating download URL error for: ${s3Key}`);

    // Simulate processing delay before error
    await new Promise((resolve) => setTimeout(resolve, 50));

    throw new S3ServiceError(S3ServiceErrorType.DOWNLOAD_ERROR, errorMessage);
  }

  /**
   * Gets the bucket name used by this mock service instance
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Gets the region used by this mock service instance
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Gets the endpoint used by this mock service instance
   */
  getEndpoint(): string {
    return this.endpoint;
  }
}

// Legacy mock functions for backward compatibility
const defaultMockS3Service = new MockS3Service();

/**
 * Legacy mock function: Uploads a buffer to mock S3
 */
export async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: string = 'private',
): Promise<string> {
  const result = await defaultMockS3Service.uploadToS3(buffer, fileName, {
    contentType,
    acl: acl as ObjectCannedACL,
  });
  return result.url;
}

/**
 * Legacy mock function: Generates a mock signed upload URL
 */
export async function getSignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn: number = 3600,
  acl: string = 'private',
): Promise<string> {
  return await defaultMockS3Service.getSignedUploadUrl(s3Key, {
    contentType,
    expiresIn,
    acl: acl as ObjectCannedACL,
  });
}

/**
 * Legacy mock function: Mock upload of PDF from path
 */
export async function uploadPdfFromPath(
  pdfPath: string,
  s3Key?: string,
  acl: string = 'private',
): Promise<string> {
  const result = await defaultMockS3Service.uploadPdfFromPath(pdfPath, s3Key, {
    acl: acl as ObjectCannedACL,
  });
  return result.url;
}
