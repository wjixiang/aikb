import * as yauzl from 'yauzl';
import * as fs from 'fs';
import * as path from 'path';
import { createLoggerWithPrefix } from 'log-management';

/**
 * Options for zip processing operations
 */
export interface ZipProcessOptions {
  /** Whether to extract markdown content */
  extractMarkdown?: boolean;
  /** Whether to extract all files */
  extractAllFiles?: boolean;
  /** Target directory for file extraction */
  targetDir?: string;
  /** Item ID for logging and processing */
  itemId?: string;
  /** Whether to process images in markdown */
  processImages?: boolean;
  /** Function to process images in markdown content */
  imageProcessor?: (content: string, itemId: string, baseDir: string) => Promise<string>;
}

/**
 * Result of zip processing operation
 */
export interface ZipProcessResult {
  /** Extracted markdown content */
  markdownContent?: string | null;
  /** Whether any files were extracted */
  extractedFiles?: boolean;
}

/**
 * A dedicated class for handling zip file operations
 * Provides unified processing for different zip extraction needs
 */
export class ZipProcessor {
  private logger = createLoggerWithPrefix('pdf2md-service-ZipProcessor');

  /**
   * Process zip buffer with configurable options
   * This is the main method that handles all zip operations
   */
  async processZipBuffer(
    zipBuffer: Buffer,
    options: ZipProcessOptions = {}
  ): Promise<ZipProcessResult> {
    const {
      extractMarkdown = true,
      extractAllFiles = false,
      targetDir,
      itemId,
      processImages = false,
      imageProcessor,
    } = options;

    return new Promise((resolve, reject) => {
      let markdownContent: string | null = null;
      let extractedFiles = false;
      let tempDir: string | null = null;

      // Create temporary directory if needed
      if (extractAllFiles && !targetDir) {
        tempDir = path.join(
          process.env['MINERU_DOWNLOAD_DIR'] || './mineru-downloads',
          `temp-${itemId || 'unknown'}-${Date.now()}`,
        );
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const cleanup = () => {
        if (tempDir && fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      };

      // Use yauzl.fromBuffer with the Buffer directly
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          cleanup();
          this.logger.error(`Error opening zip file: ${err}`);
          return reject(err);
        }

        if (!zipfile) {
          cleanup();
          return reject(new Error('Failed to open zip file'));
        }

        // Read entries
        zipfile.readEntry();

        zipfile.on('entry', (entry) => {
          // Check if the entry is full.md and we need to extract markdown
          if (
            extractMarkdown &&
            (entry.fileName === 'full.md' || entry.fileName.endsWith('/full.md'))
          ) {
            // Open the entry stream for markdown content
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                cleanup();
                this.logger.error(
                  `Error opening entry stream for ${entry.fileName}: ${err}`,
                );
                return reject(err);
              }

              if (!readStream) {
                cleanup();
                return reject(
                  new Error(`Failed to open read stream for ${entry.fileName}`),
                );
              }

              // Collect the markdown data
              const chunks: Buffer[] = [];
              readStream.on('data', (chunk) => {
                chunks.push(chunk);
              });

              readStream.on('end', () => {
                const content = Buffer.concat(chunks).toString('utf8');
                markdownContent = content;
                // Continue reading next entries
                zipfile.readEntry();
              });

              readStream.on('error', (err) => {
                cleanup();
                this.logger.error(
                  `Error reading entry ${entry.fileName}: ${err}`,
                );
                reject(err);
              });
            });
          } else if (extractAllFiles && !/\/$/.test(entry.fileName)) {
            // Extract non-directory files (images, etc.)
            extractedFiles = true;
            const extractTo = targetDir || tempDir!;

            // Create directory structure if needed
            const fullPath = path.join(extractTo, entry.fileName);
            const dirPath = path.dirname(fullPath);

            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }

            // Open the entry stream
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                cleanup();
                this.logger.error(
                  `Error opening entry stream for ${entry.fileName}: ${err}`,
                );
                return reject(err);
              }

              if (!readStream) {
                cleanup();
                return reject(
                  new Error(`Failed to open read stream for ${entry.fileName}`),
                );
              }

              // Create write stream
              const writeStream = fs.createWriteStream(fullPath);

              readStream.pipe(writeStream);

              writeStream.on('finish', () => {
                // Continue reading next entries
                zipfile.readEntry();
              });

              writeStream.on('error', (err) => {
                cleanup();
                this.logger.error(
                  `Error writing file ${entry.fileName}: ${err}`,
                );
                reject(err);
              });

              readStream.on('error', (err) => {
                cleanup();
                this.logger.error(
                  `Error reading entry ${entry.fileName}: ${err}`,
                );
                reject(err);
              });
            });
          } else {
            // Skip this entry and read the next one
            zipfile.readEntry();
          }
        });

        zipfile.on('end', async () => {
          // When all entries have been processed
          try {
            let processedContent = markdownContent;

            // If we extracted files and have markdown content, process images
            if (
              processImages &&
              extractedFiles &&
              markdownContent &&
              itemId &&
              imageProcessor
            ) {
              const baseDir = targetDir || tempDir!;
              processedContent = await imageProcessor(
                markdownContent,
                itemId,
                baseDir,
              );
            }

            cleanup();
            resolve({
              markdownContent: processedContent,
              extractedFiles,
            });
          } catch (error) {
            cleanup();
            reject(error);
          }
        });

        zipfile.on('error', (err) => {
          cleanup();
          this.logger.error(`Zip file error: ${err}`);
          reject(err);
        });
      });
    });
  }

  /**
   * Extract only markdown content from zip buffer
   */
  async extractMarkdownFromZip(zipBuffer: Buffer): Promise<string | null> {
    try {
      const result = await this.processZipBuffer(zipBuffer, {
        extractMarkdown: true,
        extractAllFiles: false,
      });
      return result.markdownContent || null;
    } catch (error) {
      this.logger.error(`Error extracting markdown from zip: ${error}`);
      return null;
    }
  }

  /**
   * Extract all files from zip buffer to a directory
   */
  async extractAllFilesFromZip(
    zipBuffer: Buffer,
    targetDir: string,
  ): Promise<boolean> {
    try {
      await this.processZipBuffer(zipBuffer, {
        extractMarkdown: false,
        extractAllFiles: true,
        targetDir,
      });
      return true;
    } catch (error) {
      this.logger.error(`Error extracting files from zip: ${error}`);
      return false;
    }
  }

  /**
   * Extract all files and markdown from zip buffer with image processing
   */
  async extractAllFilesAndMarkdownFromZip(
    zipBuffer: Buffer,
    itemId: string,
    imageProcessor?: (content: string, itemId: string, baseDir: string) => Promise<string>,
  ): Promise<{ markdownContent: string | null }> {
    const result = await this.processZipBuffer(zipBuffer, {
      extractMarkdown: true,
      extractAllFiles: true,
      itemId,
      processImages: true,
      imageProcessor,
    });
    return { markdownContent: result.markdownContent || null };
  }
}