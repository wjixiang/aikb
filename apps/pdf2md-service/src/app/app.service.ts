import { Injectable } from '@nestjs/common';
import { Pdf2MArkdownDto, UpdateMarkdownDto } from 'library-shared';
import { get, post, put } from 'axios';
import { PDFDocument } from 'pdf-lib';
import { uploadFile, type S3ServiceConfig } from '@aikb/s3-service';
import { MinerUClient, MinerUDefaultConfig } from 'mineru-client';
import * as fs from 'fs';
import { createLoggerWithPrefix } from '@aikb/log-management';
import * as path from 'path';
import { getPdfDownloadUrl } from '@aikb/s3-service';
import * as yauzl from 'yauzl';

// Internal S3 configuration for this project
const pdf2mdS3Config: S3ServiceConfig = {
  accessKeyId: process.env['OSS_ACCESS_KEY_ID']!,
  secretAccessKey: process.env['OSS_SECRET_ACCESS_KEY']!,
  region: process.env['OSS_REGION']!,
  bucketName: process.env['PDF_OSS_BUCKET_NAME']!,
  endpoint: process.env['S3_ENDPOINT']!
};

/**
 * Internal wrapper function for uploading files to S3
 * Uses new uploadFile function with project-specific configuration
 */
async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: string = 'private'
): Promise<string> {
  const result = await uploadFile(
    pdf2mdS3Config,
    fileName,
    buffer,
    contentType,
    acl as any
  );
  return result.url;
}

@Injectable()
export class AppService {
  private minerUClient: MinerUClient;
  private logger = createLoggerWithPrefix('pdf2md-service-AppService');
  constructor() {
    // Initialize MinerUClient with environment configuration
    this.minerUClient = new MinerUClient({
      ...MinerUDefaultConfig,
      token: process.env['MINERU_TOKEN'] || MinerUDefaultConfig.token,
      baseUrl: process.env['MINERU_BASE_URL'] || MinerUDefaultConfig.baseUrl,
      downloadDir: process.env['MINERU_DOWNLOAD_DIR'] || './mineru-downloads',
    });
  }

  async handlePdf2MdRequest(req: Pdf2MArkdownDto) {
    const pdfInfo: Pdf2MArkdownDto & {
      pdfData: null | Buffer;
      s3Url: null | string;
    } = {
      ...req,
      pdfData: null,
      s3Url: null,
    };

    if (!req.pageCount) {
      // Download pdf and extract page number
      pdfInfo.s3Url = await getPdfDownloadUrl(pdfInfo.s3Key);
      pdfInfo.pdfData = await this.downloadPdfData(pdfInfo.s3Url);
      pdfInfo.pageCount = await this.calculatePageNum(pdfInfo.pdfData);
    }

    // Get chunking parameters from environment variables
    const chunkSizeThreshold = parseInt(
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] || '20',
      10,
    );
    const chunkSize = parseInt(process.env['PDF_CHUNK_SIZE'] || '10', 10);

    this.logger.info(
      `Processing PDF ${pdfInfo.itemId}: Page count: ${pdfInfo.pageCount}, Chunk threshold: ${chunkSizeThreshold}, Chunk size: ${chunkSize}`,
    );

    // Check if chunking is needed
    if (pdfInfo.pageCount && pdfInfo.pageCount > chunkSizeThreshold) {
      this.logger.info(
        `Page count (${pdfInfo.pageCount}) exceeds threshold (${chunkSizeThreshold}), chunking PDF ${pdfInfo.itemId}`,
      );

      if (!pdfInfo.pdfData) {
        // Download PDF data if not available
        if (!pdfInfo.s3Url) {
          pdfInfo.s3Url = await getPdfDownloadUrl(pdfInfo.s3Key);
        }
        pdfInfo.pdfData = await this.downloadPdfData(pdfInfo.s3Url);
      }

      // Split PDF into chunks
      const pdfChunks = await this.splitPdfIntoChunks(
        pdfInfo.pdfData,
        chunkSize,
      );
      this.logger.info(
        `PDF ${pdfInfo.itemId} split into ${pdfChunks.length} chunks`,
      );

      // Upload each chunk to S3
      const uploadPromises = pdfChunks.map(async (chunk, index) => {
        const chunkFileName = `pdf_parts/${pdfInfo.itemId}@${pdfChunks.length}/${index + 1}.pdf`;
        const chunkBuffer = Buffer.from(chunk);

        try {
          const uploadResult = await uploadToS3(
            chunkBuffer,
            chunkFileName,
            'application/pdf',
          );
          this.logger.debug(
            `Uploaded chunk ${index + 1}/${pdfChunks.length} to S3: ${uploadResult}`,
          );
          return {
            chunkIndex: index,
            startPage: index * chunkSize + 1,
            endPage: Math.min((index + 1) * chunkSize, pdfInfo.pageCount!),
            s3Url: uploadResult,
            fileName: chunkFileName,
          };
        } catch (error) {
          this.logger.error(
            `Failed to upload chunk ${index + 1} for PDF ${pdfInfo.itemId}:`,
            error,
          );
          throw new Error(
            `Failed to upload chunk ${index + 1} to S3: ${error}`,
          );
        }
      });

      // Wait for all uploads to complete
      const uploadedChunks = await Promise.all(uploadPromises);
      this.logger.info(
        `All ${uploadedChunks.length} chunks uploaded successfully for PDF ${pdfInfo.itemId}`,
      );

      // Process each chunk individually and merge results
      const chunkResults = await this.processPdfChunks(
        uploadedChunks,
        pdfInfo.itemId,
      );
      const mergedMarkdown = this.mergeMarkdownResults(chunkResults);

      // Update the bibliography service with the complete markdown
      await this.updateBibliographyService(pdfInfo.itemId, mergedMarkdown);

      return {
        itemId: pdfInfo.itemId,
        pageNum: pdfInfo.pageCount,
        chunked: true,
        chunkCount: pdfChunks.length,
        chunkSize: chunkSize,
        markdownContent: mergedMarkdown,
        chunks: uploadedChunks.map((chunk, index) => ({
          chunkIndex: index,
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          s3Url: chunk.s3Url,
          fileName: chunk.fileName,
        })),
      };
    } else {
      // Process as single PDF if no chunking needed
      this.logger.info(`Processing PDF ${pdfInfo.itemId} as single document`);

      // Convert the entire PDF to markdown
      const markdownContent = await this.convertSinglePdfToMarkdown(
        pdfInfo.s3Key!,
        pdfInfo.s3Url!,
        pdfInfo.itemId,
      );

      // Update the bibliography service with the markdown content
      await this.updateBibliographyService(pdfInfo.itemId, markdownContent);

      return {
        itemId: pdfInfo.itemId,
        pageNum: pdfInfo.pageCount,
        chunked: false,
        markdownContent,
      };
    }
  }

  async downloadPdfData(url: string): Promise<Buffer> {
    try {
      const response = await get(url, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to download PDF data for url ${url}: ${errorMessage}`,
      );
    }
  }

  async calculatePageNum(pdfData: Buffer): Promise<number> {
    try {
      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfData);

      // Get page count
      const pageNum = pdfDoc.getPageCount();

      return pageNum;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to calculate page number: ${errorMessage}`);
    }
  }

  private async splitPdf(
    existingPdfBytes: Buffer,
    startPage: number,
    endPage: number,
  ): Promise<Uint8Array> {
    try {
      this.logger.debug(
        `Starting PDF split for PDF: startPage=${startPage}, endPage=${endPage}`,
      );

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      this.logger.debug(`Total pages in PDF: ${totalPages}`);

      if (startPage < 0 || endPage >= totalPages || startPage > endPage) {
        throw new Error(
          `Invalid page range: startPage=${startPage}, endPage=${endPage}, totalPages=${totalPages}`,
        );
      }

      // Create a new PDF document for the split portion
      const newPdfDoc = await PDFDocument.create();

      // Copy pages from the original document to the new one
      const pagesToCopy = endPage - startPage + 1;
      this.logger.debug(
        `Copying pages: startPage=${startPage}, endPage=${endPage}, count=${pagesToCopy}`,
      );

      const copiedPages = await newPdfDoc.copyPages(
        pdfDoc,
        Array.from({ length: pagesToCopy }, (_, i) => startPage + i),
      );

      // Add the copied pages to the new document
      copiedPages.forEach((page, index) => {
        newPdfDoc.addPage(page);
      });

      // Save the new PDF document as bytes
      const newPdfBytes = await newPdfDoc.save();
      this.logger.debug(
        `Created new PDF with byte length: ${newPdfBytes.length}`,
      );

      return newPdfBytes;
    } catch (error) {
      this.logger.error(`Error splitting PDF: ${error}`);
      throw error;
    }
  }

  private async splitPdfIntoChunks(
    existingPdfBytes: Buffer,
    chunkSize: number = 10,
  ): Promise<Uint8Array[]> {
    try {
      this.logger.info(`Starting PDF chunking with chunk size: ${chunkSize}`);

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      this.logger.debug(`Total pages in PDF: ${totalPages}`);

      const chunks: Uint8Array[] = [];
      const numChunks = Math.ceil(totalPages / chunkSize);

      for (let i = 0; i < numChunks; i++) {
        const startPage = i * chunkSize;
        const endPage = Math.min(startPage + chunkSize - 1, totalPages - 1);

        this.logger.debug(
          `Creating chunk ${i + 1}/${numChunks}: pages ${startPage}-${endPage}`,
        );

        const chunkBytes = await this.splitPdf(
          existingPdfBytes,
          startPage,
          endPage,
        );
        chunks.push(chunkBytes);
      }

      this.logger.info(`Created ${chunks.length} PDF chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`Error chunking PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Convert a single PDF to Markdown using MinerU
   */
  private async convertSinglePdfToMarkdown(
    s3Key: string,
    s3Url: string,
    itemId: string,
  ): Promise<string> {
    try {
      this.logger.info(`Converting single PDF to Markdown for item: ${itemId}`);

      // Add diagnostic logging for S3 URL
      this.logger.info(`[DIAGNOSTIC] S3 URL for item ${itemId}: ${s3Url}`);
      if (!s3Url) {
        this.logger.error(
          `[DIAGNOSTIC] CRITICAL: S3 URL is null or undefined for item ${itemId}`,
        );

        // Try to regenerate S3 URL as fallback
        this.logger.info(
          `[FALLBACK] Attempting to regenerate S3 URL for item ${itemId}`,
        );
        s3Url = await getPdfDownloadUrl(s3Key);
        this.logger.info(`[FALLBACK] Regenerated S3 URL: ${s3Url}`);

        if (!s3Url) {
          throw new Error(
            `Failed to generate S3 URL for item ${itemId}. Cannot proceed with MinerU conversion.`,
          );
        }
      }

      // Create a single file task with MinerU
      const taskId = await this.minerUClient.createSingleFileTask({
        url: s3Url,
        is_ocr: false,
        enable_formula: true,
        enable_table: true,
        language: 'en',
        data_id: itemId,
        model_version: 'pipeline',
      });

      this.logger.info(`Created MinerU task: ${taskId} for item: ${itemId}`);

      // Wait for task completion
      const { result, downloadedFiles } =
        await this.minerUClient.waitForTaskCompletion(taskId, {
          pollInterval: 5000,
          timeout: 600000, // 10 minutes
          downloadDir:
            process.env['MINERU_DOWNLOAD_DIR'] || './mineru-downloads',
        });

      if (result.state !== 'done') {
        throw new Error(`MinerU task failed: ${result.err_msg}`);
      }

      // Extract markdown content using the unified function
      const markdownContent = await this.extractMarkdownContent(
        downloadedFiles || null,
        result.full_zip_url || null,
        itemId,
      );

      this.logger.info(
        `Successfully converted PDF to Markdown for item: ${itemId}`,
      );
      return markdownContent;
    } catch (error) {
      this.logger.error(
        `Failed to convert PDF to Markdown for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process multiple PDF chunks and convert each to Markdown
   */
  private async processPdfChunks(
    chunks: any[],
    itemId: string,
  ): Promise<Array<{ chunkIndex: number; markdownContent: string }>> {
    const results: Array<{ chunkIndex: number; markdownContent: string }> = [];

    this.logger.info(
      `Processing ${chunks.length} PDF chunks for item: ${itemId}`,
    );

    for (const chunk of chunks) {
      try {
        this.logger.info(
          `Processing chunk ${chunk.chunkIndex + 1}/${chunks.length} for item: ${itemId}`,
        );

        const markdownContent = await this.convertSinglePdfToMarkdown(
          chunk.fileName,
          chunk.s3Url,
          `${itemId}-chunk-${chunk.chunkIndex}`,
        );

        results.push({
          chunkIndex: chunk.chunkIndex,
          markdownContent,
        });

        this.logger.info(
          `Completed processing chunk ${chunk.chunkIndex + 1}/${chunks.length} for item: ${itemId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process chunk ${chunk.chunkIndex} for item ${itemId}:`,
          error,
        );
        // Continue with other chunks even if one fails
        results.push({
          chunkIndex: chunk.chunkIndex,
          markdownContent: `# Error processing chunk ${chunk.chunkIndex + 1}\n\n${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  /**
   * Merge markdown results from multiple chunks
   */
  private mergeMarkdownResults(
    chunkResults: Array<{ chunkIndex: number; markdownContent: string }>,
  ): string {
    // Sort by chunkIndex to ensure proper order
    const sortedResults = chunkResults.sort(
      (a, b) => a.chunkIndex - b.chunkIndex,
    );

    let mergedMarkdown = '';

    for (const result of sortedResults) {
      if (mergedMarkdown) {
        mergedMarkdown += '\n\n---\n\n'; // Add separator between chunks
      }
      mergedMarkdown += result.markdownContent;
    }

    return mergedMarkdown;
  }

  /**
   * Extract markdown content from downloaded files or zip URL
   * This unified function handles both local files and zip downloads
   */
  private async extractMarkdownContent(
    downloadedFiles: string[] | null,
    zipUrl: string | null,
    itemId: string,
  ): Promise<string> {
    try {
      let markdownContent = '';
      
      // First try to extract from downloaded files
      if (downloadedFiles && downloadedFiles.length > 0) {
        this.logger.debug(`Extracting markdown from downloaded files for item: ${itemId}`);
        
        // Look for markdown files in the downloaded files
        for (const filePath of downloadedFiles) {
          if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
            const content = fs.readFileSync(filePath, 'utf-8');

            // Process images in the markdown and upload to S3
            const processedContent = await this.processAndUploadImages(
              content,
              itemId,
              path.dirname(filePath),
            );

            return processedContent;
          }
        }
        
        this.logger.warn(`No markdown file found in downloaded files for item: ${itemId}`);
      }
      
      // If no markdown found in downloaded files, try zip URL
      if (zipUrl) {
        this.logger.debug(`Downloading and extracting from zip: ${zipUrl} for item: ${itemId}`);

        // Download the zip file
        const response = await get(zipUrl, { responseType: 'arraybuffer' });
        const zipBuffer = Buffer.from(response.data);

        this.logger.debug(
          `Downloaded zip file, size: ${zipBuffer.length} bytes for item: ${itemId}`,
        );

        // Extract all files from zip in a single operation
        const extractResult = await this.extractAllFilesAndMarkdownFromZip(zipBuffer, itemId);
        
        if (extractResult.markdownContent) {
          return extractResult.markdownContent;
        } else {
          this.logger.warn(`Failed to extract full.md from zip file for item: ${itemId}`);
        }
      }
      
      throw new Error('No markdown content available from downloaded files or zip URL');
    } catch (error) {
      this.logger.error(
        `Failed to extract markdown content for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  async extractMdFromZip(zipBuffer: Buffer): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const markdownContents: string[] = [];
      
      // Use yauzl.fromBuffer with the Buffer directly
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          this.logger.error(`Error opening zip file: ${err}`);
          return reject(err);
        }

        if (!zipfile) {
          return reject(new Error('Failed to open zip file'));
        }

        // Read entries
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          // Check if the entry is full.md
          if (entry.fileName === 'full.md' || entry.fileName.endsWith('/full.md')) {
            // Open the entry stream
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                this.logger.error(`Error opening entry stream for ${entry.fileName}: ${err}`);
                return reject(err);
              }

              if (!readStream) {
                return reject(new Error(`Failed to open read stream for ${entry.fileName}`));
              }

              // Collect the data
              const chunks: Buffer[] = [];
              readStream.on('data', (chunk) => {
                chunks.push(chunk);
              });

              readStream.on('end', () => {
                const content = Buffer.concat(chunks).toString('utf8');
                markdownContents.push(content);
                // Continue reading next entries
                zipfile.readEntry();
              });

              readStream.on('error', (err) => {
                this.logger.error(`Error reading entry ${entry.fileName}: ${err}`);
                reject(err);
              });
            });
          } else {
            // Skip this entry and read the next one
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          // When all entries have been processed
          if (markdownContents.length > 0) {
            // Return the first full.md content found
            resolve(markdownContents[0]);
          } else {
            this.logger.warn('No full.md file found in zip archive');
            resolve(null);
          }
        });

        zipfile.on('error', (err) => {
          this.logger.error(`Zip file error: ${err}`);
          reject(err);
        });
      });
    });
  }

  /**
   * Extract all files from zip buffer and process markdown content in a single operation
   */
  private async extractAllFilesAndMarkdownFromZip(
    zipBuffer: Buffer,
    itemId: string
  ): Promise<{ markdownContent: string | null }> {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.env['MINERU_DOWNLOAD_DIR'] || './mineru-downloads', `temp-${itemId}-${Date.now()}`);
      let markdownContent: string | null = null;
      let extractedFiles = false;
      
      // Create temporary directory
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Use yauzl.fromBuffer with Buffer directly
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          // Clean up on error
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          this.logger.error(`Error opening zip file: ${err}`);
          return reject(err);
        }

        if (!zipfile) {
          // Clean up on error
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          return reject(new Error('Failed to open zip file'));
        }

        // Read entries
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          // Check if the entry is full.md
          if (entry.fileName === 'full.md' || entry.fileName.endsWith('/full.md')) {
            // Open the entry stream for markdown content
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                this.logger.error(`Error opening entry stream for ${entry.fileName}: ${err}`);
                return reject(err);
              }

              if (!readStream) {
                return reject(new Error(`Failed to open read stream for ${entry.fileName}`));
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
                this.logger.error(`Error reading entry ${entry.fileName}: ${err}`);
                reject(err);
              });
            });
          } else if (!/\/$/.test(entry.fileName)) {
            // Extract non-directory files (images, etc.)
            extractedFiles = true;
            
            // Create directory structure if needed
            const fullPath = path.join(tempDir, entry.fileName);
            const dirPath = path.dirname(fullPath);
            
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }

            // Open the entry stream
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                this.logger.error(`Error opening entry stream for ${entry.fileName}: ${err}`);
                return reject(err);
              }

              if (!readStream) {
                return reject(new Error(`Failed to open read stream for ${entry.fileName}`));
              }

              // Create write stream
              const writeStream = fs.createWriteStream(fullPath);
              
              readStream.pipe(writeStream);
              
              writeStream.on('finish', () => {
                // Continue reading next entries
                zipfile.readEntry();
              });

              writeStream.on('error', (err) => {
                this.logger.error(`Error writing file ${entry.fileName}: ${err}`);
                reject(err);
              });

              readStream.on('error', (err) => {
                this.logger.error(`Error reading entry ${entry.fileName}: ${err}`);
                reject(err);
              });
            });
          } else {
            // Skip directories and continue reading next entries
            zipfile.readEntry();
          }
        });

        zipfile.on('end', async () => {
          // When all entries have been processed
          try {
            let processedContent = markdownContent;
            
            // If we extracted files and have markdown content, process images
            if (extractedFiles && markdownContent) {
              processedContent = await this.processAndUploadImages(
                markdownContent,
                itemId,
                tempDir,
              );
            }
            
            // Clean up temporary directory
            fs.rmSync(tempDir, { recursive: true, force: true });
            
            resolve({ markdownContent: processedContent });
          } catch (error) {
            // Clean up on error
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
            reject(error);
          }
        });

        zipfile.on('error', (err) => {
          // Clean up on error
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
          this.logger.error(`Zip file error: ${err}`);
          reject(err);
        });
      });
    });
  }

  /**
   * Extract all files from zip buffer to a directory
   */
  private async extractAllFilesFromZip(zipBuffer: Buffer, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use yauzl.fromBuffer with Buffer directly
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          this.logger.error(`Error opening zip file: ${err}`);
          return reject(err);
        }

        if (!zipfile) {
          return reject(new Error('Failed to open zip file'));
        }

        // Read entries
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          // Skip directories
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }

          // Create directory structure if needed
          const fullPath = path.join(targetDir, entry.fileName);
          const dirPath = path.dirname(fullPath);
          
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          // Open the entry stream
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              this.logger.error(`Error opening entry stream for ${entry.fileName}: ${err}`);
              return reject(err);
            }

            if (!readStream) {
              return reject(new Error(`Failed to open read stream for ${entry.fileName}`));
            }

            // Create write stream
            const writeStream = fs.createWriteStream(fullPath);
            
            readStream.pipe(writeStream);
            
            writeStream.on('finish', () => {
              // Continue reading next entries
              zipfile.readEntry();
            });

            writeStream.on('error', (err) => {
              this.logger.error(`Error writing file ${entry.fileName}: ${err}`);
              reject(err);
            });

            readStream.on('error', (err) => {
              this.logger.error(`Error reading entry ${entry.fileName}: ${err}`);
              reject(err);
            });
          });
        });

        zipfile.on('end', () => {
          // When all entries have been processed
          resolve();
        });

        zipfile.on('error', (err) => {
          this.logger.error(`Zip file error: ${err}`);
          reject(err);
        });
      });
    });
  }

  /**
   * Process images in markdown content and upload to S3
   */
  private async processAndUploadImages(
    content: string,
    itemId: string,
    baseDir: string,
  ): Promise<string> {
    try {
      // Simple regex to find image references in markdown
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let processedContent = content;
      const matches = [...content.matchAll(imageRegex)];

      this.logger.debug(
        `Found ${matches.length} images to process for item: ${itemId}`,
      );

      for (const match of matches) {
        const [fullMatch, altText, imagePath] = match;

        try {
          // Check if image is a local file
          if (!imagePath.startsWith('http')) {
            const fullImagePath = path.resolve(baseDir, imagePath);

            if (fs.existsSync(fullImagePath)) {
              // Read the image file
              const imageBuffer = fs.readFileSync(fullImagePath);
              const imageExtension = path.extname(imagePath);
              const imageFileName = `images/${itemId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}${imageExtension}`;

              // Upload to S3
              const s3Url = await uploadToS3(
                imageBuffer,
                imageFileName,
                this.getMimeType(imageExtension),
              );

              // Replace image reference in markdown
              processedContent = processedContent.replace(
                fullMatch,
                `![${altText}](${s3Url})`,
              );

              this.logger.debug(`Uploaded image to S3: ${s3Url}`);
            }
          }
        } catch (imageError) {
          this.logger.error(
            `Failed to process image ${imagePath}:`,
            imageError,
          );
          // Keep original image reference if upload fails
        }
      }

      return processedContent;
    } catch (error) {
      this.logger.error(`Failed to process images for item ${itemId}:`, error);
      return content; // Return original content if image processing fails
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Update bibliography service with markdown content
   */
  private async updateBibliographyService(
    itemId: string,
    markdownContent: string,
  ): Promise<void> {
    try {
      const bibliographyEndpoint = process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'];
      if (!bibliographyEndpoint) {
        throw new Error(
          'BIBLIOGRAPHY_SERVICE_ENDPOINT environment variable is not set',
        );
      }

      this.logger.info(`Updating markdown content for item: ${itemId}`);

      const updateDto: UpdateMarkdownDto = {
        id: itemId,
        markdownContent,
      };

      const response = await put(
        `${bibliographyEndpoint}/library-items/${itemId}/markdown`,
        updateDto,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      this.logger.info(
        `Successfully updated bibliography service for item: ${itemId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update bibliography service for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }
}
