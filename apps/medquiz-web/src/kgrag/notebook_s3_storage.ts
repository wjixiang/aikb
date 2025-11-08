import { PDF_Chunk } from './notebookEmbedding';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLoggerWithPrefix } from '../lib/console/logger';
import Logger from '../lib/console/logger';

require('dotenv').config(); // Explicitly load environment variables

export interface ImageUploadData {
  /**
   * Binary image data
   */
  imageData: Buffer | Uint8Array;
  /**
   * MIME type of the image
   * Example: 'image/png', 'image/jpeg'
   */
  imageType: string;
}

interface S3StorageConfig {
  region?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export default class notebook_s3_storage {
  private client: S3Client;
  private bucketName: string;
  logger = createLoggerWithPrefix('notebook_s3_storage');

  constructor(config: S3StorageConfig = {}) {
    const region = process.env.AWS_REGION || 'oss-cn-beijing';
    const bucketName = process.env.AWS_S3_BUCKET_NAME || 'textbook-med';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

    if (!region) throw new Error('AWS_REGION environment variable is required');
    if (!bucketName)
      throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
    if (!accessKeyId) throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
    if (!secretAccessKey) throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');

    this.client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
    this.bucketName = bucketName;
  }

  async uploadImage(image: ImageUploadData, key: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: image.imageData,
      ContentType: image.imageType,
    });

    try {
      try {
        try {
          await this.client.send(command);
          this.logger.info(`Successfully deleted chunk: ${key}`);
        } catch (error) {
          this.logger.error(`Failed to delete chunk ${key}: ${error}`);
          throw error;
        }
        this.logger.info(`Successfully deleted chunk: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to delete chunk ${key}: ${error}`);
        throw error;
      }
      this.logger.info(`Successfully deleted chunk: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete chunk ${key}: ${error}`);
      throw error;
    }
    return `s3://${this.bucketName}/${key}`;
  }

  async getChunk(key: string): Promise<PDF_Chunk> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.client.send(command);
    const body = await response.Body?.transformToString();
    if (!body) {
      throw new Error(`No body found for S3 object with key: ${key}`);
    }
    return JSON.parse(body) as PDF_Chunk;
  }

  async deleteChunk(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(command);
  }

  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const url = await getSignedUrl(this.client, command, { expiresIn });
      this.logger.info(
        `Generated presigned URL for ${key} (expires in ${expiresIn}s)`,
      );
      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for ${key}: ${error}`,
      );
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      // Simple operation to verify credentials and bucket access
      await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: '.connection_test', // Non-existent key is fine - we just need to verify bucket access
        }),
      );
      return true;
    } catch (error) {
      console.error('S3 connection check failed:', error);
      return false;
    }
  }
}
