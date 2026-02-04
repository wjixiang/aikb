import {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    S3ClientConfig,
} from '@aws-sdk/client-s3';

// ============================================================================
// Configuration
// ============================================================================

interface OSSConfig {
    bucketName: string;
    s3Endpoint?: string;
    s3AccessKeyId?: string;
    s3SecretAccessKey?: string;
    s3Region?: string;
}

const createOSSConfig = (): OSSConfig => {
    const bucketName = process.env['MIRROR_BUCKET_NAME'] || 'pubmed-mirror';
    const s3Endpoint = process.env['S3_ENDPOINT'];
    const s3AccessKeyId = process.env['S3_ACCESS_KEY_ID'];
    const s3SecretAccessKey = process.env['S3_SECRET_ACCESS_KEY'];
    const s3Region = process.env['S3_REGION'] || 'oss-cn-beijing';

    return {
        bucketName,
        s3Endpoint,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3Region,
    };
};

const config = createOSSConfig();

// ============================================================================
// S3 Client
// ============================================================================

/**
 * Create S3 client with configuration
 */
const createS3Client = (): S3Client => {
    const clientConfig: S3ClientConfig = {
        endpoint: config.s3Endpoint,
        credentials: {
            accessKeyId: config.s3AccessKeyId || '',
            secretAccessKey: config.s3SecretAccessKey || '',
        },
        region: config.s3Region,
    };

    return new S3Client(clientConfig);
};

// S3 client singleton
let s3ClientInstance: S3Client | null = null;

/**
 * Get or create S3 client instance
 */
export const getS3Client = (): S3Client => {
    if (!s3ClientInstance) {
        s3ClientInstance = createS3Client();
    }
    return s3ClientInstance;
};

/**
 * Reset S3 client instance (useful for testing)
 */
export const resetS3Client = (): void => {
    if (s3ClientInstance) {
        s3ClientInstance.destroy();
        s3ClientInstance = null;
    }
};

// ============================================================================
// OSS Operations
// ============================================================================

/**
 * Upload file buffer to OSS
 * @param key - The object key (filename)
 * @param buffer - The file content as buffer
 * @param year - The year prefix for the object key
 */
export const uploadToOSS = async (
    key: string,
    buffer: Buffer,
    year: string,
): Promise<void> => {
    const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: `baseline/${year}/${key}`,
        Body: buffer,
        ContentType: 'application/gzip',
    });

    await getS3Client().send(command);
};

/**
 * List all files already synced to OSS for a specific year
 * @param year - The year to list files for
 * @returns Array of filenames (without prefix)
 */
export const listSyncedFiles = async (year: string): Promise<string[]> => {
    const files: string[] = [];
    let continuationToken: string | undefined = undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: `baseline/${year}`,
            ContinuationToken: continuationToken,
        });

        const response = await getS3Client().send(command);

        if (response.Contents) {
            for (const object of response.Contents) {
                if (object.Key) {
                    // Remove 'baseline/{year}' prefix to get filename
                    const filename = object.Key.replace(`baseline/${year}`, '');
                    if (filename) {
                        files.push(filename);
                    }
                }
            }
        }

        continuationToken = response.NextContinuationToken as string | undefined;
    } while (continuationToken);

    return files;
};

/**
 * Check if a file exists in OSS
 * @param filename - The filename to check
 * @param year - The year prefix
 * @returns True if file exists, false otherwise
 */
export const fileExistsInOSS = async (filename: string, year: string): Promise<boolean> => {
    try {
        const command = new HeadObjectCommand({
            Bucket: config.bucketName,
            Key: `baseline/${year}/${filename}`,
        });

        await getS3Client().send(command);
        return true;
    } catch {
        return false;
    }
};

/**
 * Get the bucket name from configuration
 */
export const getBucketName = (): string => config.bucketName;
