import { createLoggerWithPrefix } from "@/lib/console/logger";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import OSS from "ali-oss";

/**
 * Configuration for S3 sync service
 */
export interface NoteS3SyncConfig {
  /**
   * Name of the S3 bucket containing the notes
   */
  s3Bucket: string;
  /**
   * Prefix path within the S3 bucket where notes are stored
   */
  s3Prefix: string;
  /**
   * MongoDB collection name where notes should be synced
   */
  mongoCollection: string;
  /**
   * Sync direction between S3 and MongoDB
   * @remarks Currently only 'download-only' is supported
   */
  syncDirection: "download-only" | "upload-only" | "bidirectional";
}

/**
 * Plan for synchronization between S3 and MongoDB
 */
interface SyncPlan {
  filesToDownload: string[];
  filesToUpload: string[];
  stats: {
    totalS3Files: number;
    totalMongoNotes: number;
    newFiles: number;
    existingFiles: number;
  };
}

/**
 * Service for synchronizing notes between S3 storage and MongoDB
 */
export class S3SyncService {
  private s3Client: S3Client;
  logger = createLoggerWithPrefix("knowledgeBaseSync");

  /**
   * Creates a new S3SyncService instance
   * @remarks Initializes S3 and MongoDB clients using environment variables
   */
  constructor() {
    this.logger.info("Initializing S3SyncService");

    const s3Config: any = {};

    // Configure S3 endpoint if provided
    if (process.env.S3_ENDPOINT) {
      s3Config.endpoint = process.env.S3_ENDPOINT;
      this.logger.debug(`Using custom S3 endpoint: {endpoint: ${process.env.S3_ENDPOINT}}`);
    }

    // Configure S3 region if provided
    if (process.env.S3_REGION) {
      s3Config.region = process.env.S3_REGION;
      this.logger.debug(`Using custom S3 region: {region: ${process.env.S3_REGION}}`);
    } else {
      s3Config.region = "cn-north-1"; // Default for China region
      this.logger.debug("Using default S3 region: {region: cn-north-1}");
    }

    // Handle Aliyun OSS specific configuration
    const isAliyun = process.env.S3_ENDPOINT?.includes("aliyuncs.com");
    if (isAliyun) {
      // Use virtual hosted style for Aliyun OSS
      s3Config.forcePathStyle = false;
      this.logger.debug("Using virtual hosted style for Aliyun OSS");
    } else if (process.env.S3_ENDPOINT) {
      // Use path style for other custom endpoints
      s3Config.forcePathStyle = true;
      this.logger.debug("Using path style for custom endpoint");
    }

    // Add credentials configuration
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
      this.logger.debug("Using AWS credentials from environment");
    }

    this.logger.debug(`Creating S3 client with config: ${JSON.stringify(s3Config)}`);
    this.s3Client = new S3Client(s3Config);
    this.logger.debug(`Creating MongoDB client with URI: {uri: ${process.env.MONGODB_URI}}`);
  }

  /**
   * Generates a synchronization plan between S3 and MongoDB
   * @param config - Sync configuration
   * @returns Promise resolving to the sync plan
   */
  private async generateSyncPlan(config: NoteS3SyncConfig): Promise<SyncPlan> {
    this.logger.info(`Generating sync plan: {bucket: ${config.s3Bucket}, prefix: ${config.s3Prefix}, collection: ${config.mongoCollection}, direction: ${config.syncDirection}}`);

    // Get files from S3
    const s3Files = await this.listS3Files(config.s3Bucket, config.s3Prefix);
    this.logger.debug(`Found S3 files: {count: ${s3Files.length}, sample: [${s3Files.slice(0, 5).join(", ")}]}`);

    // Get notes from MongoDB
    const { db } = await connectToDatabase();
    const collection = db.collection(config.mongoCollection);
    const mongoNotes = await collection.find().toArray();
    this.logger.debug(`Found MongoDB notes: {count: ${mongoNotes.length}, sample: [${mongoNotes.slice(0, 5).map((n) => n.key).join(", ")}]}`);

    const plan: SyncPlan = {
      filesToDownload: [],
      filesToUpload: [],
      stats: {
        totalS3Files: s3Files.length,
        totalMongoNotes: mongoNotes.length,
        newFiles: 0,
        existingFiles: 0,
      },
    };

    // Analyze files to sync
    for (const s3File of s3Files) {
      const existingNote = mongoNotes.find((n) => n.key === s3File);
      if (!existingNote) {
        this.logger.debug(`File needs download: {file: ${s3File}}`);
        plan.filesToDownload.push(s3File);
        plan.stats.newFiles++;
      } else {
        plan.stats.existingFiles++;
      }
    }

    this.logger.info(`Detailed sync plan generated: {filesToDownload: ${plan.filesToDownload.length}, filesToUpload: ${plan.filesToUpload.length}, stats: ${JSON.stringify(plan.stats)}, syncDirection: ${config.syncDirection}, estimatedSize: ${(plan.filesToDownload.length * 100).toLocaleString()} KB (estimate)}`);

    if (plan.filesToDownload.length > 0) {
      this.logger.debug(`Files to download details: {firstFile: ${plan.filesToDownload[0]}, lastFile: ${plan.filesToDownload[plan.filesToDownload.length - 1]}, sampleFiles: [${plan.filesToDownload.slice(0, 5).join(", ")}]}`);
    }

    return plan;
  }

  /**
   * Lists all files in an S3 bucket with given prefix
   * @param bucket - S3 bucket name
   * @param prefix - Path prefix to filter files
   * @returns Promise resolving to array of file keys
   */
  private async listS3Files(bucket: string, prefix: string): Promise<string[]> {
    this.logger.debug(`Listing S3 files: {bucket: ${bucket}, prefix: ${prefix}}`);

    let allFiles: string[] = [];
    let continuationToken: string | undefined;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const response = await this.s3Client.send(command);

        if (response.Contents) {
          const files = response.Contents.map((item) => item.Key!).filter(
            (key) => key,
          );
          allFiles = allFiles.concat(files);
        }

        continuationToken = response.NextContinuationToken;

        this.logger.debug(`S3 list batch: {bucket: ${bucket}, prefix: ${prefix}, batchSize: ${response.Contents?.length || 0}, totalSoFar: ${allFiles.length}, hasMore: ${response.IsTruncated}}`);
      } while (continuationToken);

      // Filter to only include .md files
      const mdFiles = allFiles.filter((key) =>
        key.toLowerCase().endsWith(".md"),
      );

      this.logger.debug(`S3 list complete: {bucket: ${bucket}, prefix: ${prefix}, totalFiles: ${allFiles.length}, mdFiles: ${mdFiles.length}, firstFile: ${mdFiles[0]}, sampleFiles: [${mdFiles.slice(0, 5).join(", ")}]}`);

      return mdFiles;
    } catch (error) {
      this.logger.error(`Failed to list S3 files: {error: ${error}, bucket: ${bucket}, prefix: ${prefix}}`);
      throw error;
    }
  }

  /**
   * Downloads a file from S3
   * @param bucket - S3 bucket name
   * @param key - File key/path in S3
   * @returns Promise resolving to file content as Buffer
   * @throws Error if response body is undefined
   */
  private async downloadFromS3(bucket: string, key: string): Promise<Buffer> {
    this.logger.debug(`Downloading from S3: {bucket: ${bucket}, key: ${key}}`);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      const body = response.Body;
      if (!body) {
        this.logger.error(`S3 response body is undefined: {bucket: ${bucket}, key: ${key}}`);
        throw new Error("S3 response body is undefined");
      }
      const buffer = Buffer.from(await body.transformToByteArray());
      // this.logger.debug('Download completed', {
      //     bucket,
      //     key,
      //     size: buffer.length
      // });
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to download from S3: {error: ${error}, bucket: ${bucket}, key: ${key}}`);
      throw error;
    }
  }

  /**
   * Gets metadata for a file in S3
   * @param bucket - S3 bucket name
   * @param key - File key/path in S3
   * @returns Object containing file metadata (etag, lastModified, etc.)
   */
  public async getFileMetadata(bucket: string, key: string) {
    this.logger.debug(`Getting file metadata: {bucket: ${bucket}, key: ${key}}`);
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      this.logger.debug(`File metadata response: {bucket: ${bucket}, key: ${key}, etag: ${response.ETag}, lastModified: ${response.LastModified}, size: ${response.ContentLength}}`);
      return {
        etag: response.ETag,
        lastModified: response.LastModified,
        contentLength: response.ContentLength,
        contentType: response.ContentType,
      };
    } catch (error) {
      this.logger.error(`Failed to get file metadata: {error: ${error}, bucket: ${bucket}, key: ${key}}`);
      throw error;
    }
  }

  /**
   * Compares a local file's ETag with the S3 version
   * @param bucket - S3 bucket name
   * @param key - File key/path in S3
   * @param localETag - Local file's ETag to compare
   * @returns Promise resolving to true if ETags match, false otherwise
   * @throws Error if S3 operation fails (except NoSuchKey)
   */
  public async compareFileByETag(
    bucket: string,
    key: string,
    localETag: string,
  ): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(bucket, key);
      return metadata.etag === localETag;
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        return false; // File doesn't exist
      }
      throw error;
    }
  }

  public async compareFileByLastModified(
    bucket: string,
    key: string,
    localLastModified: Date,
  ): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(bucket, key);
      if (!metadata.lastModified) return false;
      return metadata.lastModified.getTime() === localLastModified.getTime();
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        return false; // File doesn't exist
      }
      throw error;
    }
  }

  public async compareFileBySize(
    bucket: string,
    key: string,
    localSize: number,
  ): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata(bucket, key);
      return metadata.contentLength === localSize;
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        return false; // File doesn't exist
      }
      throw error;
    }
  }

  public async sync(config: NoteS3SyncConfig) {
    this.logger.info(`Starting sync: {direction: ${config.syncDirection}, bucket: ${config.s3Bucket}, prefix: ${config.s3Prefix}, collection: ${config.mongoCollection}}`);

    if (config.syncDirection !== "download-only") {
      this.logger.error(`Unsupported sync direction: {direction: ${config.syncDirection}}`);
      throw new Error("Only download-only sync is currently supported");
    }

    try {
      const syncPlan = await this.generateSyncPlan(config);
      this.logger.debug(`Sync plan: ${JSON.stringify(syncPlan.stats)}`);
      const { db } = await connectToDatabase();
      const collection = db.collection(config.mongoCollection);

      this.logger.info(
        `Processing files to download: ${syncPlan.filesToDownload.length} files`,
      );
      for (const fileKey of syncPlan.filesToDownload) {
        // this.logger.debug('Downloading file', { fileKey });
        const content = await this.downloadFromS3(config.s3Bucket, fileKey);
        const insertRes = await collection.insertOne({
          key: fileKey,
          content: content.toString("utf-8"),
          lastModified: new Date(),
        });
        // this.logger.debug('File saved to MongoDB', { fileKey });
      }

      this.logger.info("Sync completed successfully");
    } catch (error) {
      this.logger.error(`Sync failed: {error: ${error}}`);
      throw error;
    }
  }
}
