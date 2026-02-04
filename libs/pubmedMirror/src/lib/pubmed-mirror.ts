import { Client, FileInfo } from 'basic-ftp';
import {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    S3ClientConfig,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { SyncResult } from './types';

// ============================================================================
// Configuration
// ============================================================================

interface PubmedMirrorConfig {
    ftpHost: string;
    ftpBaselinePath: string;
    bucketName: string;
    s3Endpoint?: string;
    s3AccessKeyId?: string;
    s3SecretAccessKey?: string;
    s3Region?: string;
}

const createConfig = (): PubmedMirrorConfig => {
    const bucketName = process.env['MIRROR_BUCKET_NAME'] || 'pubmed-mirror';
    const s3Endpoint = process.env['S3_ENDPOINT'];
    const s3AccessKeyId = process.env['S3_ACCESS_KEY_ID'];
    const s3SecretAccessKey = process.env['S3_SECRET_ACCESS_KEY'];
    const s3Region = process.env['S3_REGION'] || 'oss-cn-beijing';

    return {
        ftpHost: 'ftp.ncbi.nlm.nih.gov',
        ftpBaselinePath: 'pubmed/baseline',
        bucketName,
        s3Endpoint,
        s3AccessKeyId,
        s3SecretAccessKey,
        s3Region,
    };
};

const config = createConfig();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current year as string
 */
const getCurrentYear = (): string => new Date().getFullYear().toString();

/**
 * Create and configure a new FTP client
 */
const createFtpClient = (verbose = true): Client => {
    const client = new Client();
    client.ftp.verbose = verbose;
    return client;
};

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

const getS3Client = (): S3Client => {
    if (!s3ClientInstance) {
        s3ClientInstance = createS3Client();
    }
    return s3ClientInstance;
};

// ============================================================================
// FTP Operations
// ============================================================================

/**
 * Connect to FTP server and navigate to baseline directory
 */
const connectToFtpBaseline = async (client: Client): Promise<void> => {
    await client.access({
        host: config.ftpHost,
    });
    await client.cd(config.ftpBaselinePath);
};

/**
 * List all files in the PubMed baseline FTP directory
 */
export const listPubmedAnnualIndexViaFtp = async (): Promise<FileInfo[]> => {
    const ftpClient = createFtpClient();

    try {
        await connectToFtpBaseline(ftpClient);
        const files = await ftpClient.list();
        console.log(`Found ${files.length} files`);
        return files;
    } finally {
        ftpClient.close();
    }
};

// ============================================================================
// S3/OSS Operations
// ============================================================================

/**
 * Upload file buffer to OSS
 */
const uploadToOSS = async (key: string, buffer: Buffer, year: string): Promise<void> => {
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
 */
const listSyncedFiles = async (year: string): Promise<string[]> => {
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
 */
const fileExistsInOSS = async (filename: string, year: string): Promise<boolean> => {
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

// ============================================================================
// File Sync Operations
// ============================================================================

/**
 * Download a file from FTP and upload it to OSS
 */
const downloadAndUploadFile = async (
    ftpClient: Client,
    filename: string,
    year: string,
): Promise<void> => {
    const tempDir = tmpdir();
    const tempFilePath = path.join(tempDir, filename);

    try {
        // Download file to temporary location
        await ftpClient.downloadTo(tempFilePath, filename);

        // Read the file into a buffer
        const buffer = fs.readFileSync(tempFilePath);

        // Upload to OSS with year prefix
        await uploadToOSS(filename, buffer, year);
    } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
};

/**
 * Sync all pending annual PubMed baseline files from FTP to OSS
 * @param year - The year to sync files for (defaults to current year)
 * @returns Sync result with total, success, and error counts
 */
export const syncAnnualPubmedIndexFiles = async (year?: string): Promise<SyncResult> => {
    const targetYear = year || getCurrentYear();
    const ftpClient = createFtpClient();

    try {
        // Connect to FTP server
        await connectToFtpBaseline(ftpClient);

        // Get list of files
        const files = await ftpClient.list();
        console.log(`Found ${files.length} files in baseline directory`);

        // Get list of already synced files from OSS for the specific year
        const syncedFiles = await listSyncedFiles(targetYear);
        const syncedFileNames = new Set(syncedFiles);

        // Filter files that need to be synced
        const filesToSync = files.filter((file) => {
            if (!file.name.endsWith('.gz')) return false;
            return !syncedFileNames.has(file.name);
        });

        console.log(
            `Need to sync ${filesToSync.length} files (${files.length - filesToSync.length} already synced)`,
        );

        // Sync files
        let successCount = 0;
        let errorCount = 0;

        for (const file of filesToSync) {
            try {
                console.log(`Downloading and uploading ${file.name}...`);
                await downloadAndUploadFile(ftpClient, file.name, targetYear);
                successCount++;
                console.log(`Successfully synced ${file.name}`);
            } catch (error) {
                errorCount++;
                console.error(`Failed to sync ${file.name}:`, error);
            }
        }

        console.log(`Sync complete: ${successCount} succeeded, ${errorCount} failed`);

        return {
            total: filesToSync.length,
            success: successCount,
            error: errorCount,
        };
    } finally {
        ftpClient.close();
    }
};

// ============================================================================
// Public API
// ============================================================================

/**
 * PubMed Mirror API for syncing baseline files from FTP to OSS
 */
export const PubmedMirror = {
    /**
     * List all annual baseline files from FTP
     */
    async listFiles(): Promise<FileInfo[]> {
        return listPubmedAnnualIndexViaFtp();
    },

    /**
     * List all synced files from OSS for a specific year
     * @param year - The year to list synced files for (defaults to current year)
     */
    async listSyncedFiles(year?: string): Promise<string[]> {
        return listSyncedFiles(year || getCurrentYear());
    },

    /**
     * Check sync status - compare FTP files with OSS files for a specific year
     * @param year - The year to check sync status for (defaults to current year)
     */
    async checkSyncStatus(year?: string): Promise<{
        total: number;
        synced: number;
        pending: number;
    }> {
        const targetYear = year || getCurrentYear();
        const ftpFiles = await listPubmedAnnualIndexViaFtp();
        const syncedFiles = await listSyncedFiles(targetYear);
        const syncedFileSet = new Set(syncedFiles);

        const gzFiles = ftpFiles.filter((f) => f.name.endsWith('.gz'));
        const syncedCount = gzFiles.filter((f) => syncedFileSet.has(f.name)).length;

        return {
            total: gzFiles.length,
            synced: syncedCount,
            pending: gzFiles.length - syncedCount,
        };
    },

    /**
     * Sync all pending files from FTP to OSS for a specific year
     * @param year - The year to sync files for (defaults to current year)
     */
    async sync(year?: string): Promise<SyncResult> {
        return syncAnnualPubmedIndexFiles(year);
    },

    /**
     * Sync a specific file from FTP to OSS for a specific year
     * @param filename - The filename to sync
     * @param year - The year to sync the file for (defaults to current year)
     */
    async syncFile(filename: string, year?: string): Promise<void> {
        const targetYear = year || getCurrentYear();
        const ftpClient = createFtpClient();

        try {
            await connectToFtpBaseline(ftpClient);
            await downloadAndUploadFile(ftpClient, filename, targetYear);
            console.log(`Successfully synced ${filename}`);
        } finally {
            ftpClient.close();
        }
    },
};

// Export for backward compatibility (deprecated - use PubmedMirror instead)
/**
 * @deprecated Use PubmedMirror instead
 */
export const PumpedMirror = PubmedMirror;

// Export S3 client for advanced use cases
export const ossClient = getS3Client();
