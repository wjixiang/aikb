import { Injectable } from '@nestjs/common';
import {
  Pdf2MArkdownDto,
  UpdateMarkdownDto,
  CreateGroupAndChunkEmbedDto,
} from 'llm-shared/';
import { get, post, put } from 'axios';
import { PDFDocument } from 'pdf-lib';
import { uploadFile, type S3ServiceConfig } from '@aikb/s3-service';
import { MinerUClient, MinerUDefaultConfig } from 'mineru-client';
import * as fs from 'fs';
import { createLoggerWithPrefix } from 'log-management';
import * as path from 'path';
import { getPdfDownloadUrl, createS3Service } from '@aikb/s3-service';
import { bibliographyProto, BibliographyGrpcClient } from 'proto-ts';
import { firstValueFrom } from 'rxjs';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { defaultChunkingConfig } from 'chunking';
import { defaultEmbeddingConfig } from 'embedding';
import { ZipProcessor } from 'mineru-client';

// Internal S3 configuration for this project
const pdf2mdS3Config: S3ServiceConfig = {
  accessKeyId: process.env['OSS_ACCESS_KEY_ID']!,
  secretAccessKey: process.env['OSS_SECRET_ACCESS_KEY']!,
  region: process.env['OSS_REGION']!,
  bucketName: process.env['PDF_OSS_BUCKET_NAME']!,
  endpoint: process.env['S3_ENDPOINT']!,
};

interface PdfChunk {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  s3Key: string;
  fileName: string;
  s3Url?: string;
}

/**
 * Internal wrapper function for uploading files to S3
 * Uses new uploadFile function with project-specific configuration
 */
async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  acl: string = 'private',
): Promise<string> {
  // Lazy import s3-service to avoid eager initialization
  const s3ServiceModule = await import('@aikb/s3-service');
  const { uploadFile } = s3ServiceModule;

  const result = await uploadFile(
    pdf2mdS3Config,
    fileName,
    buffer,
    contentType,
    acl as any,
  );
  return result.url;
}

@Injectable()
export class AppService {
  private minerUClient: MinerUClient;
  private logger = createLoggerWithPrefix('pdf2md-service-AppService');
  private partPdfs3Service = createS3Service(pdf2mdS3Config);
  private pdfS3Service = createS3Service(pdf2mdS3Config);
  public zipProcessor = new ZipProcessor();

  constructor(
    private bibliographyGrpcClient: BibliographyGrpcClient,
    private amqpConnection: AmqpConnection,
  ) {
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
          // Use dynamic import to ensure uploadFile is available

          const uploadResult = await this.partPdfs3Service.uploadToS3(
            chunkBuffer,
            chunkFileName,
            {
              contentType: 'application/pdf',
            },
          );
          this.logger.debug(
            `Uploaded chunk ${index + 1}/${pdfChunks.length} to S3: ${uploadResult}`,
          );
          return {
            chunkIndex: index,
            startPage: index * chunkSize + 1,
            endPage: Math.min((index + 1) * chunkSize, pdfInfo.pageCount!),
            s3Key: uploadResult.key,
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
      await this.updateItemMarkdown(pdfInfo.itemId, mergedMarkdown);

      // Publish message to create chunk embed group and process chunk embedding
      await this.publishCreateGroupAndChunkEmbed(pdfInfo.itemId);

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
          s3Key: chunk.s3Key,
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
      await this.updateItemMarkdown(pdfInfo.itemId, markdownContent);

      // Publish message to create chunk embed group and process chunk embedding
      await this.publishCreateGroupAndChunkEmbed(pdfInfo.itemId);

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

      // Extract markdown and images using ZipProcessor
      let markdownContent: string;

      if (result.full_zip_url) {
        // Download zip file as buffer
        const zipResponse = await get(result.full_zip_url, {
          responseType: 'arraybuffer',
        });
        const zipBuffer = Buffer.from(zipResponse.data);

        this.logger.debug(
          `Downloaded zip file, size: ${zipBuffer.length} bytes for item: ${itemId}`,
        );

        // Process zip buffer to extract markdown and images
        const processResult = await this.zipProcessor.processZipBuffer(
          zipBuffer,
          {
            extractMarkdown: true,
            extractAllFiles: true,
            extractImages: true,
            itemId,
          },
        );

        if (processResult.markdownContent) {
          markdownContent = processResult.markdownContent;

          // Upload extracted images to S3 if any
          if (processResult.images && processResult.images.length > 0) {
            await this.uploadExtractedImages(processResult.images, itemId);
          }
        } else {
          throw new Error('Failed to extract markdown content from zip file');
        }
      } else if (downloadedFiles && downloadedFiles.length > 0) {
        // Fallback to existing method for downloaded files
        markdownContent = await this.extractMarkdownContent(
          downloadedFiles,
          null,
          itemId,
        );
      } else {
        throw new Error(
          'No zip URL or downloaded files available for extraction',
        );
      }

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
    chunks: PdfChunk[],
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
          await this.partPdfs3Service.getSignedDownloadUrl(chunk.s3Key),
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
      // First try to extract from downloaded files
      if (downloadedFiles && downloadedFiles.length > 0) {
        this.logger.debug(
          `Extracting markdown from downloaded files for item: ${itemId}`,
        );

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

        this.logger.warn(
          `No markdown file found in downloaded files for item: ${itemId}`,
        );
      }

      // If no markdown found in downloaded files, try zip URL
      if (zipUrl) {
        this.logger.debug(
          `Downloading and extracting from zip: ${zipUrl} for item: ${itemId}`,
        );

        // Download the zip file
        const response = await get(zipUrl, { responseType: 'arraybuffer' });
        const zipBuffer = Buffer.from(response.data);

        this.logger.debug(
          `Downloaded zip file, size: ${zipBuffer.length} bytes for item: ${itemId}`,
        );

        // Extract markdown content using the unified method
        const result =
          await this.zipProcessor.extractAllFilesAndMarkdownFromZip(
            zipBuffer,
            itemId,
            this.processAndUploadImages.bind(this),
          );

        if (result.markdownContent) {
          return result.markdownContent;
        } else {
          this.logger.warn(
            `Failed to extract full.md from zip file for item: ${itemId}`,
          );
        }
      }

      throw new Error(
        'No markdown content available from downloaded files or zip URL',
      );
    } catch (error) {
      this.logger.error(
        `Failed to extract markdown content for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Extract all files from zip buffer to a directory
   */
  private async extractAllFilesFromZip(
    zipBuffer: Buffer,
    targetDir: string,
  ): Promise<void> {
    await this.zipProcessor.extractAllFilesFromZip(zipBuffer, targetDir);
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
   * Upload extracted image buffers to S3
   */
  private async uploadExtractedImages(
    images: { fileName: string; buffer: Buffer }[],
    itemId: string,
  ): Promise<string[]> {
    const uploadedUrls: string[] = [];

    this.logger.debug(
      `Uploading ${images.length} extracted images for item: ${itemId}`,
    );

    for (let i = 0; i < images.length; i++) {
      try {
        const imageData = images[i];
        const imageBuffer = imageData.buffer;
        const originalFileName = imageData.fileName;

        // Try to detect image type from buffer as fallback
        const mimeType = this.detectImageMimeType(imageBuffer);
        const finalFileName = `images/${originalFileName}`;

        const s3Url = await this.pdfS3Service.uploadToS3(
          imageBuffer,
          finalFileName,
          {
            contentType: mimeType,
          },
        );

        uploadedUrls.push(s3Url.url);
        this.logger.debug(
          `Uploaded extracted image ${i + 1}/${images.length} (${originalFileName}) to S3: ${s3Url}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to upload extracted image ${i + 1} for item ${itemId}: ${JSON.stringify(error)}`,
          error,
        );
        // Continue with other images even if one fails
      }
    }

    this.logger.info(
      `Successfully uploaded ${uploadedUrls.length}/${images.length} images for item: ${itemId}`,
    );
    return uploadedUrls;
  }

  /**
   * Detect image MIME type from buffer
   */
  private detectImageMimeType(buffer: Buffer): string {
    // Check file signature to determine image type
    if (buffer.length < 4) return 'application/octet-stream';

    const signature = buffer.subarray(0, 4).toString('hex');

    // PNG signature: 89 50 4E 47
    if (signature.startsWith('89504e47')) return 'image/png';

    // JPEG signature: FF D8 FF
    if (signature.startsWith('ffd8ff')) return 'image/jpeg';

    // GIF signature: 47 49 46 38
    if (signature.startsWith('47494638')) return 'image/gif';

    // BMP signature: 42 4D
    if (signature.startsWith('424d')) return 'image/bmp';

    // WebP signature: 52 49 46 46
    if (signature.startsWith('52494646')) return 'image/webp';

    // Default to PNG if we can't detect
    return 'image/png';
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };

    return extensions[mimeType] || '.png';
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
   * Update bibliography service with markdown content using gRPC
   */
  private async updateItemMarkdown(
    itemId: string,
    markdownContent: string,
  ): Promise<void> {
    try {
      this.logger.info(
        `Updating markdown content for item: ${itemId} using gRPC`,
      );

      const updateRequest: bibliographyProto.UpdateLibraryItemMarkdownRequest =
        {
          id: itemId,
          markdownContent,
        };

      this.logger.debug(
        `[DEBUG] Sending gRPC request: ${JSON.stringify(updateRequest)}`,
      );

      const response = await firstValueFrom(
        this.bibliographyGrpcClient.updateLibraryItemMarkdown(updateRequest),
      );

      this.logger.debug(
        `[DEBUG] Received gRPC response: ${JSON.stringify(response)}`,
      );

      if (!response) {
        throw new Error(`gRPC request failed, response is null or undefined`);
      }

      if (!response.item) {
        throw new Error(
          `gRPC request failed, response.item is null or undefined`,
        );
      }

      this.logger.info(
        `Successfully updated markdown for item: ${itemId} via gRPC. Response item ID: ${response.item.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update bibliography service for item ${itemId} via gRPC:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish a message to create a chunk embed group and process chunk embedding
   */
  private async publishCreateGroupAndChunkEmbed(itemId: string): Promise<void> {
    try {
      this.logger.info(
        `Publishing createGroupAndChunkEmbed message for item: ${itemId}`,
      );

      // Create the message payload with default configuration
      const message: CreateGroupAndChunkEmbedDto = {
        itemId,
        groupName: `Default chunk group for ${itemId}`,
        groupDescription: `Automatically created chunk embed group for item ${itemId}`,
        chunkingConfig: defaultChunkingConfig,
        embeddingConfig: defaultEmbeddingConfig,
      };

      // Publish the message to RabbitMQ
      await this.amqpConnection.publish(
        'library',
        'item.vector.createGroupAndChunkEmbed',
        message,
      );

      this.logger.info(
        `Successfully published createGroupAndChunkEmbed message for item: ${itemId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish createGroupAndChunkEmbed message for item ${itemId}:`,
        error,
      );
      // Don't throw the error to avoid interrupting the main flow
      // The chunk embedding can be triggered manually later if needed
    }
  }
}
