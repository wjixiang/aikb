/**
 * S3 Client for rustfs object storage
 *
 * rustfs is an S3-compatible object storage service (MinIO fork)
 * Connect using S3 SDK with custom endpoint
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

// Re-export S3Client type for use in components
export { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3ClientConfig {
    /** S3 endpoint URL */
    endpoint: string;
    /** AWS region */
    region?: string;
    /** Access key ID */
    accessKeyId: string;
    /** Secret access key */
    secretAccessKey: string;
    /** Bucket name */
    bucket?: string;
    /** Force path style (required for MinIO/rustfs) */
    forcePathStyle?: boolean;
}

export interface FileObject {
    key: string;
    size?: number;
    lastModified?: Date;
    isDirectory?: boolean;
}

export interface UploadResult {
    success: boolean;
    key?: string;
    url?: string;
    error?: string;
}

export interface DownloadResult {
    success: boolean;
    content?: string;
    error?: string;
}

/**
 * Create S3 client for rustfs
 */
export function createS3Client(config: S3ClientConfig): S3Client {
    return new S3Client({
        endpoint: config.endpoint,
        region: config.region || 'us-east-1',
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: config.forcePathStyle ?? true,
    });
}

/**
 * Upload file to S3
 */
export async function uploadFile(
    client: S3Client,
    bucket: string,
    key: string,
    content: string | Buffer,
    contentType?: string
): Promise<UploadResult> {
    try {
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: typeof content === 'string' ? Buffer.from(content) : content,
            ContentType: contentType || 'application/octet-stream',
        });

        await client.send(command);

        return {
            success: true,
            key,
        };
    } catch (error) {
        return {
            success: false,
            key,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Download file from S3
 */
export async function downloadFile(
    client: S3Client,
    bucket: string,
    key: string
): Promise<DownloadResult> {
    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const response = await client.send(command);

        if (!response.Body) {
            return {
                success: false,
                error: 'Empty response body',
            };
        }

        const content = await response.Body.transformToString();

        return {
            success: true,
            content,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Delete file from S3
 */
export async function deleteFile(
    client: S3Client,
    bucket: string,
    key: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        await client.send(command);

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * List files in S3 bucket
 */
export async function listFiles(
    client: S3Client,
    bucket: string,
    prefix?: string
): Promise<{ success: boolean; files?: FileObject[]; error?: string }> {
    try {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
        });

        const response = await client.send(command);

        const files: FileObject[] = [];

        if (response.Contents) {
            for (const item of response.Contents) {
                files.push({
                    key: item.Key || '',
                    size: item.Size,
                    lastModified: item.LastModified,
                });
            }
        }

        return {
            success: true,
            files,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Check if bucket exists
 */
export async function bucketExists(
    client: S3Client,
    bucket: string
): Promise<boolean> {
    try {
        const command = new HeadBucketCommand({ Bucket: bucket });
        await client.send(command);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get presigned URL for file download
 */
export async function getPresignedUrl(
    client: S3Client,
    bucket: string,
    key: string,
    expiresIn?: number
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });

    return getSignedUrl(client, command, { expiresIn: expiresIn || 3600 });
}
