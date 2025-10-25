import {
  S3Client,
  PutObjectCommand,
  ObjectCannedACL,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

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
 * Configurable S3 service class for file upload, download, and management
 * Supports both AWS S3 and Aliyun OSS
 */
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly endpoint: string;
  private readonly region: string;

  constructor(config: S3ServiceConfig) {
    this.validateConfig(config);
    
    this.bucketName = config.bucketName;
    this.region = config.region;
    this.endpoint = config.endpoint;

    this.s3Client = new S3Client({
      region: config.region,
      endpoint: `https://${config.region}.${config.endpoint}`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? false, // Default to virtual hosted style for Aliyun OSS
      signingRegion: config.signingRegion || config.region,
    });
  }

  /**
   * Validates the configuration object
   */
  private validateConfig(config: S3ServiceConfig): void {
    const requiredFields = ['accessKeyId', 'secretAccessKey', 'bucketName', 'region', 'endpoint'];
    const missingFields = requiredFields.filter(field => !config[field as keyof S3ServiceConfig]);

    if (missingFields.length > 0) {
      throw new S3ServiceError(
        S3ServiceErrorType.CONFIGURATION_ERROR,
        `Missing required configuration fields: ${missingFields.join(', ')}`
      );
    }
  }

  /**
   * Generates the public URL for a file in S3
   */
  private generatePublicUrl(key: string): string {
    return `https://${this.bucketName}.${this.region}.${this.endpoint}/${key}`;
  }

  /**
   * Uploads a buffer to S3 and returns the public URL of the uploaded file
   *
   * @param buffer - The file content to upload as a Buffer
   * @param fileName - The name/key for the file in S3
   * @param options - Upload options including content type and ACL
   * @returns Promise resolving to upload result with URL and metadata
   * @throws S3ServiceError if upload fails
   */
  async uploadToS3(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      console.log(
        `[S3Service] Uploading to S3: bucket=${this.bucketName}, key=${fileName}, contentType=${options.contentType}`,
      );

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: options.contentType,
        // Note: ACL parameter is removed for Aliyun OSS compatibility
      });

      console.log(`[S3Service] Sending command to S3...`);
      await this.s3Client.send(command);
      console.log(`[S3Service] Upload successful`);

      const url = this.generatePublicUrl(fileName);
      console.log(`[S3Service] Generated URL: ${url}`);

      return {
        url,
        bucket: this.bucketName,
        key: fileName,
      };
    } catch (error) {
      console.error('[S3Service] Error uploading to S3:', error);
      
      if (error instanceof Error) {
        console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
        throw new S3ServiceError(
          S3ServiceErrorType.UPLOAD_ERROR,
          `Failed to upload file to S3: ${error.message}`,
          error
        );
      }
      
      console.error('[S3Service] Unknown error type');
      throw new S3ServiceError(
        S3ServiceErrorType.UPLOAD_ERROR,
        'Failed to upload file to S3: Unknown error'
      );
    }
  }

  /**
   * Generates a presigned URL for direct upload to S3 from client-side applications
   *
   * @param fileName - The name/key for the file in S3
   * @param options - Signed URL options including content type and expiration
   * @returns Promise resolving to a presigned URL that can be used for direct uploads
   * @throws S3ServiceError if URL generation fails
   */
  async getSignedUploadUrl(
    fileName: string,
    options: SignedUrlOptions
  ): Promise<string> {
    try {
      console.log(
        `[S3Service] Generating signed URL: bucket=${this.bucketName}, key=${fileName}, expiresIn=${options.expiresIn || 3600}`,
      );

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: options.contentType,
        // Note: ACL parameter is removed for Aliyun OSS compatibility
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: options.expiresIn || 3600 
      });
      
      console.log(`[S3Service] Signed URL generated successfully`);
      return signedUrl;
    } catch (error) {
      console.error('[S3Service] Error generating signed URL:', error);
      
      if (error instanceof Error) {
        console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
        throw new S3ServiceError(
          S3ServiceErrorType.SIGNED_URL_ERROR,
          `Failed to generate signed URL: ${error.message}`,
          error
        );
      }
      
      console.error('[S3Service] Unknown error type');
      throw new S3ServiceError(
        S3ServiceErrorType.SIGNED_URL_ERROR,
        'Failed to generate signed URL: Unknown error'
      );
    }
  }

  /**
   * Uploads a PDF file from a local file path to S3
   *
   * @param pdfPath - The local file system path to the PDF file
   * @param s3Key - Optional custom key/name for the file in S3. If not provided, uses the filename from pdfPath
   * @param options - Upload options including ACL
   * @returns Promise resolving to upload result with URL and metadata
   * @throws S3ServiceError if file doesn't exist, is not a PDF, or upload fails
   */
  async uploadPdfFromPath(
    pdfPath: string,
    s3Key?: string,
    options: { acl?: ObjectCannedACL } = {}
  ): Promise<UploadResult> {
    try {
      console.log(
        `[S3Service] uploadPdfFromPath: path=${pdfPath}, s3Key=${s3Key}`,
      );

      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        throw new S3ServiceError(
          S3ServiceErrorType.FILE_NOT_FOUND,
          `PDF file not found at path: ${pdfPath}`
        );
      }

      // Check if file is a PDF
      const fileExtension = path.extname(pdfPath).toLowerCase();
      if (fileExtension !== '.pdf') {
        throw new S3ServiceError(
          S3ServiceErrorType.INVALID_FILE_TYPE,
          `File is not a PDF: ${pdfPath}`
        );
      }

      // Read the PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      console.log(`[S3Service] Read PDF file: ${pdfBuffer.length} bytes`);

      // Use filename from path if s3Key is not provided
      const fileName = s3Key || path.basename(pdfPath);
      console.log(`[S3Service] Using fileName: ${fileName}`);

      // Upload to S3 using the existing uploadToS3 function
      const result = await this.uploadToS3(pdfBuffer, fileName, {
        contentType: 'application/pdf',
        acl: options.acl || 'private',
      });
      
      console.log(`[S3Service] uploadPdfFromPath successful: ${result.url}`);
      return result;
    } catch (error) {
      console.error('[S3Service] Error uploading PDF from path:', error);
      
      if (error instanceof S3ServiceError) {
        throw error;
      }
      
      if (error instanceof Error) {
        console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
        throw new S3ServiceError(
          S3ServiceErrorType.UPLOAD_ERROR,
          `Failed to upload PDF from path: ${error.message}`,
          error
        );
      }
      
      console.error('[S3Service] Unknown error type');
      throw new S3ServiceError(
        S3ServiceErrorType.UPLOAD_ERROR,
        'Failed to upload PDF from path: Unknown error'
      );
    }
  }

  /**
   * Generates a presigned URL for downloading a file from S3
   *
   * @param bucketName - The bucket name (optional, uses default bucket if not provided)
   * @param s3Key - The key/name of the file in S3
   * @param options - Download URL options including expiration time
   * @returns Promise resolving to a presigned download URL
   * @throws S3ServiceError if URL generation fails
   */
  async getSignedDownloadUrl(
    s3Key: string,
    options: DownloadUrlOptions & { bucketName?: string } = {}
  ): Promise<string> {
    try {
      const bucketName = options.bucketName || this.bucketName;
      
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
      });
      
      const signedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: options.expiresIn || 3600 
      });
      
      return signedUrl;
    } catch (error) {
      console.error('[S3Service] Error generating download URL:', error);
      
      if (error instanceof Error) {
        throw new S3ServiceError(
          S3ServiceErrorType.DOWNLOAD_ERROR,
          `Failed to generate download URL: ${error.message}`,
          error
        );
      }
      
      throw new S3ServiceError(
        S3ServiceErrorType.DOWNLOAD_ERROR,
        'Failed to generate download URL: Unknown error'
      );
    }
  }

  /**
   * Deletes a file from S3
   *
   * @param s3Key - The key/name of the file in S3 to delete
   * @returns Promise resolving to true if deletion was successful
   * @throws S3ServiceError if deletion fails
   */
  async deleteFromS3(s3Key: string): Promise<boolean> {
    try {
      console.log(
        `[S3Service] Deleting from S3: bucket=${this.bucketName}, key=${s3Key}`,
      );

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      console.log(`[S3Service] Sending delete command to S3...`);
      await this.s3Client.send(command);
      console.log(`[S3Service] Delete successful`);
      return true;
    } catch (error) {
      console.error('[S3Service] Error deleting from S3:', error);
      
      if (error instanceof Error) {
        console.error(`[S3Service] Error details: ${error.name} - ${error.message}`);
        throw new S3ServiceError(
          S3ServiceErrorType.DELETE_ERROR,
          `Failed to delete file from S3: ${error.message}`,
          error
        );
      }
      
      console.error('[S3Service] Unknown error type');
      throw new S3ServiceError(
        S3ServiceErrorType.DELETE_ERROR,
        'Failed to delete file from S3: Unknown error'
      );
    }
  }

  /**
   * Gets the bucket name used by this service instance
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Gets the region used by this service instance
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Gets the endpoint used by this service instance
   */
  getEndpoint(): string {
    return this.endpoint;
  }
}