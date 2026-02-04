import { Client, FileInfo } from 'basic-ftp';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { SyncResult } from './types.js';
import {
    getS3Client,
    uploadToOSS,
    listSyncedBaselineFiles,
    fileExistsInOSS,
    getBucketName,
} from './oss-storage.js';
import Bottleneck from 'bottleneck'

// ============================================================================
// Configuration
// ============================================================================

interface PubmedMirrorConfig {
    ftpHost: string;
    ftpBaselinePath: string;
}

const createConfig = (): PubmedMirrorConfig => {
    return {
        ftpHost: 'ftp.ncbi.nlm.nih.gov',
        ftpBaselinePath: 'pubmed/baseline',
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
const createFtpClient = (verbose = false): Client => {
    const client = new Client();
    client.ftp.verbose = verbose;
    return client;
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
// File Sync Operations
// ============================================================================

/**
 * Sleep for a specified number of milliseconds
 */
const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Download a file from FTP and upload it to OSS with retry logic
 */
const downloadAndUploadFile = async (
    ftpClient: Client,
    filename: string,
    year: string,
    attempt: number = 1,
    maxAttempts: number = 3,
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
    } catch (error) {
        if (attempt < maxAttempts) {
            // Exponential backoff: 2^attempt seconds
            const backoffTime = Math.pow(2, attempt) * 1000;
            console.warn(
                `Attempt ${attempt}/${maxAttempts} failed for ${filename}. ` +
                `Retrying in ${backoffTime}ms... Error: ${error}`
            );
            await sleep(backoffTime);

            // Clean up temp file before retry
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            return downloadAndUploadFile(ftpClient, filename, year, attempt + 1, maxAttempts);
        }
        throw error;
    } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
};

interface FileSyncTask {
    file: FileInfo;
    retry: number;
}

/**
 * Sync all pending annual PubMed baseline files from FTP to OSS
 * @param year - The year to sync files for (defaults to current year)
 * @param maxRetries - Maximum number of retry attempts per file (default: 3)
 * @returns Sync result with total, success, and error counts
 */
export const syncAnnualPubmedIndexFiles = async (
    year?: string,
    maxRetries: number = 3,
): Promise<SyncResult> => {
    const targetYear = year || getCurrentYear();
    const ftpClient = createFtpClient();

    try {
        // Connect to FTP server
        await connectToFtpBaseline(ftpClient);

        // Get list of files
        const files = await ftpClient.list();
        console.log(`Found ${files.length} files in baseline directory`);

        // Get list of already synced files from OSS for the specific year
        const syncedFiles = await listSyncedBaselineFiles(targetYear);
        const syncedFileNames = new Set(syncedFiles);

        // Filter files that need to be synced
        const initialFilesToSync = files.filter((file) => {
            if (!file.name.endsWith('.gz')) return false;
            return !syncedFileNames.has(file.name);
        });

        console.log(
            `Need to sync ${initialFilesToSync.length} files (${files.length - initialFilesToSync.length} already synced)`,
        );

        // Sync files with retry mechanism
        let successCount = 0;
        let errorCount = 0;
        const totalFiles = initialFilesToSync.length;

        // Create a queue for files to sync
        let filesToSync: FileSyncTask[] = initialFilesToSync.map((file) => ({
            file,
            retry: 0,
        }));

        const limiter = new Bottleneck({
            minTime: 333,
            maxConcurrent: 5,
        });

        // Process files until queue is empty
        while (filesToSync.length > 0) {
            const currentBatch = [...filesToSync];
            filesToSync = []; // Clear the queue

            const syncPromises = currentBatch.map((task) =>
                limiter.schedule(async () => {
                    const { file, retry } = task;
                    console.log(
                        `[${retry + 1}/${maxRetries}] Downloading and uploading ${file.name}...`,
                    );

                    const client = createFtpClient();
                    try {
                        await connectToFtpBaseline(client);
                        await downloadAndUploadFile(
                            client,
                            file.name,
                            targetYear,
                            retry + 1,
                            maxRetries,
                        );
                        successCount++;
                        console.log(`Successfully synced ${file.name}`);
                    } catch (error) {
                        if (retry < maxRetries - 1) {
                            console.warn(
                                `Failed to sync ${file.name}, queuing for retry (${retry + 1}/${maxRetries}):`,
                                error,
                            );
                            // Re-queue for retry
                            filesToSync.push({
                                file,
                                retry: retry + 1,
                            });
                        } else {
                            errorCount++;
                            console.error(
                                `Failed to sync ${file.name} after ${maxRetries} attempts:`,
                                error,
                            );
                        }
                    } finally {
                        client.close();
                    }
                }),
            );

            // Wait for all sync operations in this batch to complete
            await Promise.all(syncPromises);

            if (filesToSync.length > 0) {
                console.log(
                    `${filesToSync.length} files remaining, starting retry batch...`,
                );
            }
        }

        console.log(
            `Sync complete: ${successCount} succeeded, ${errorCount} failed out of ${totalFiles} total`,
        );

        return {
            total: totalFiles,
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
    async listSyncedBaselineFiles(year?: string): Promise<string[]> {
        return listSyncedBaselineFiles(year || getCurrentYear());
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
        const syncedFiles = await listSyncedBaselineFiles(targetYear);
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
     * @param maxRetries - Maximum number of retry attempts per file (default: 3)
     */
    async sync(year?: string, maxRetries: number = 3): Promise<SyncResult> {
        return syncAnnualPubmedIndexFiles(year, maxRetries);
    },

    /**
     * Sync a specific file from FTP to OSS for a specific year
     * @param filename - The filename to sync
     * @param year - The year to sync the file for (defaults to current year)
     * @param maxRetries - Maximum number of retry attempts (default: 3)
     */
    async syncFile(
        filename: string,
        year?: string,
        maxRetries: number = 3,
    ): Promise<void> {
        const targetYear = year || getCurrentYear();
        const ftpClient = createFtpClient();

        try {
            await connectToFtpBaseline(ftpClient);
            await downloadAndUploadFile(
                ftpClient,
                filename,
                targetYear,
                1,
                maxRetries,
            );
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
export const PubmedMirrorDeprecated = PubmedMirror;

// Export S3 client for advanced use cases
export const ossClient = getS3Client();
