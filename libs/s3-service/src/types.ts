import { ObjectCannedACL } from '@aws-sdk/client-s3';

/**
 * Configuration interface for S3Service
 */
export interface S3ServiceConfig {
  /** AWS/Aliyun OSS access key ID */
  accessKeyId: string;
  /** AWS/Aliyun OSS secret access key */
  secretAccessKey: string;
  /** Default bucket name for operations */
  bucketName: string;
  /** S3/OSS region */
  region: string;
  /** S3/OSS endpoint (without protocol) */
  endpoint: string;
  /** Whether to use path style (true for S3, false for Aliyun OSS) */
  forcePathStyle?: boolean;
  /** Custom signing region (defaults to region if not provided) */
  signingRegion?: string;
}

/**
 * Upload options interface
 */
export interface UploadOptions {
  /** The MIME type of the file */
  contentType: string;
  /** The access control level for the uploaded file */
  acl?: ObjectCannedACL;
}

/**
 * Signed URL options interface
 */
export interface SignedUrlOptions {
  /** The MIME type of the file */
  contentType: string;
  /** The expiration time for the signed URL in seconds */
  expiresIn?: number;
  /** The access control level for the uploaded file */
  acl?: ObjectCannedACL;
}

/**
 * Upload result interface
 */
export interface UploadResult {
  /** The public URL of the uploaded file */
  url: string;
  /** The bucket name where the file was uploaded */
  bucket: string;
  /** The key/name of the file in S3 */
  key: string;
}

/**
 * Download URL options interface
 */
export interface DownloadUrlOptions {
  /** The expiration time for the signed URL in seconds */
  expiresIn?: number;
}

/**
 * Error types for S3 operations
 */
export enum S3ServiceErrorType {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  DELETE_ERROR = 'DELETE_ERROR',
  SIGNED_URL_ERROR = 'SIGNED_URL_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
}

/**
 * Custom error class for S3 service operations
 */
export class S3ServiceError extends Error {
  constructor(
    public type: S3ServiceErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'S3ServiceError';
  }
}