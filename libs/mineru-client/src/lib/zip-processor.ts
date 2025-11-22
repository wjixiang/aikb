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
  /** Whether to extract images as buffers */
  extractImages?: boolean;
}

/**
 * Result of zip processing operation
 */
export interface ZipProcessResult {
  /** Extracted markdown content */
  markdownContent?: string | null;
  /** Whether any files were extracted */
  extractedFiles?: boolean;
  /** Extracted image buffers */
  images?: {
    fileName: string;
    buffer: Buffer;
  }[];
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
    options: ZipProcessOptions = {},
  ): Promise<ZipProcessResult> {
    const {
      extractMarkdown = true,
      extractAllFiles = false,
      targetDir,
      itemId,
      extractImages = false,
    } = options;

    return new Promise((resolve, reject) => {
      let markdownContent: string | null = null;
      let extractedFiles = false;
      let images: { fileName: string; buffer: Buffer }[] = [];
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
            (entry.fileName === 'full.md' ||
              entry.fileName.endsWith('/full.md'))
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

              // Check if this is an image file and we need to extract it as buffer
              const isImageFile = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(
                entry.fileName,
              );

              if (extractImages && isImageFile) {
                // Collect image data as buffer
                const chunks: Buffer[] = [];
                readStream.on('data', (chunk) => {
                  chunks.push(chunk);
                });

                readStream.on('end', () => {
                  const imageBuffer = Buffer.concat(chunks);
                  images.push({
                    fileName: path.basename(entry.fileName),
                    buffer: imageBuffer,
                  });
                  // Also write to file if extractAllFiles is enabled
                  const writeStream = fs.createWriteStream(fullPath);
                  writeStream.write(imageBuffer);
                  writeStream.end();

                  writeStream.on('finish', () => {
                    zipfile.readEntry();
                  });

                  writeStream.on('error', (err) => {
                    cleanup();
                    this.logger.error(
                      `Error writing image file ${entry.fileName}: ${err}`,
                    );
                    reject(err);
                  });
                });

                readStream.on('error', (err) => {
                  cleanup();
                  this.logger.error(
                    `Error reading image ${entry.fileName}: ${err}`,
                  );
                  reject(err);
                });
              } else {
                // Create write stream for non-image files or when extractImages is false
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
              }
            });
          } else {
            // Skip this entry and read the next one
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          // When all entries have been processed
          cleanup();
          resolve({
            markdownContent,
            extractedFiles,
            images: extractImages ? images : undefined,
          });
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
   * Extract all files and markdown from zip buffer
   */
  async extractAllFilesAndMarkdownFromZip(
    zipBuffer: Buffer,
    itemId: string,
    targetDir?: string,
  ): Promise<{ markdownContent: string | null }> {
    const result = await this.processZipBuffer(zipBuffer, {
      extractMarkdown: true,
      extractAllFiles: true,
      itemId,
      targetDir,
    });
    return { markdownContent: result.markdownContent || null };
  }

  /**
   * Extract images from zip buffer as buffers
   */
  async extractImagesFromZip(
    zipBuffer: Buffer,
  ): Promise<{ fileName: string; buffer: Buffer }[]> {
    try {
      const result = await this.processZipBuffer(zipBuffer, {
        extractMarkdown: false,
        extractAllFiles: false,
        extractImages: true,
      });
      return result.images || [];
    } catch (error) {
      this.logger.error(`Error extracting images from zip: ${error}`);
      return [];
    }
  }

  /**
   * Extract all files, markdown, and images from zip buffer
   */
  async extractAllFilesMarkdownAndImagesFromZip(
    zipBuffer: Buffer,
    itemId: string,
    targetDir?: string,
  ): Promise<{
    markdownContent: string | null;
    images: { fileName: string; buffer: Buffer }[];
  }> {
    const result = await this.processZipBuffer(zipBuffer, {
      extractMarkdown: true,
      extractAllFiles: true,
      extractImages: true,
      targetDir,
      itemId,
    });
    return {
      markdownContent: result.markdownContent || null,
      images: result.images || [],
    };
  }
}
