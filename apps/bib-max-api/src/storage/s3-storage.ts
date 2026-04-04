import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import type {
  IStorageService,
  S3StorageConfig,
  StorageUploadOptions,
  StorageUploadResult,
  PresignedUrlResult,
} from "./types.js";

const DEFAULT_PRESIGN_TTL = 3600; // 1 hour

export class S3StorageService implements IStorageService {
  private client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl;

    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async upload(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      Metadata: options.metadata,
    });

    const result = await this.client.send(command);

    return {
      key: options.key,
      size: typeof options.body === "object" && "length" in options.body ? options.body.length : 0,
      etag: result.ETag,
    };
  }

  async get(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const result = await this.client.send(command);
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
        return false;
      }
      throw err;
    }
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = DEFAULT_PRESIGN_TTL,
  ): Promise<PresignedUrlResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });
    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = DEFAULT_PRESIGN_TTL,
  ): Promise<PresignedUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });
    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  getPublicUrl(key: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    const base = this.publicUrl.replace(/\/+$/, "");
    return `${base}/${key}`;
  }
}
