import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

export type FileType = 'baseline' | 'updatefiles';

const getLocalRoot = (): string => {
    return process.env['PUBMED_MIRROR_DIR'] || './data';
};

/**
 * Ensure a directory exists, creating it recursively if needed
 */
const ensureDir = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Get the full directory path for a file type and year
 */
const getDirPath = (fileType: FileType, year: string): string => {
    return path.join(getLocalRoot(), fileType, year);
};

// ============================================================================
// Local Storage Operations
// ============================================================================

/**
 * Upload (save) a file buffer to local storage
 */
export const uploadToLocal = async (
    fileType: FileType,
    filename: string,
    buffer: Buffer,
    year: string,
): Promise<void> => {
    const dirPath = getDirPath(fileType, year);
    ensureDir(dirPath);
    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, buffer);
};

/**
 * Download (read) a file from local storage
 */
export const downloadLocalFile = async (
    fileType: FileType,
    filename: string,
    year: string,
): Promise<Buffer> => {
    const filePath = path.join(getDirPath(fileType, year), filename);
    return fs.readFileSync(filePath);
};

/**
 * List all files in local storage for a specific file type and year
 */
export const listLocalFiles = async (
    fileType: FileType,
    year: string,
): Promise<string[]> => {
    const dirPath = getDirPath(fileType, year);
    if (!fs.existsSync(dirPath)) {
        return [];
    }
    return fs.readdirSync(dirPath);
};

/**
 * Get file names mapped to their sizes in local storage
 */
export const getLocalFileSizes = (
    fileType: FileType,
    year: string,
): Map<string, number> => {
    const dirPath = getDirPath(fileType, year);
    const sizeMap = new Map<string, number>();
    if (!fs.existsSync(dirPath)) {
        return sizeMap;
    }
    for (const name of fs.readdirSync(dirPath)) {
        const filePath = path.join(dirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            sizeMap.set(name, stat.size);
        }
    }
    return sizeMap;
};

/**
 * Check if a file exists in local storage
 */
export const localFileExists = async (
    fileType: FileType,
    filename: string,
    year: string,
): Promise<boolean> => {
    const filePath = path.join(getDirPath(fileType, year), filename);
    return fs.existsSync(filePath);
};

export { getLocalRoot };
