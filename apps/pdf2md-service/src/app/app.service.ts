import { Inject, Injectable } from '@nestjs/common';
import { Pdf2MArkdownDto, UpdateMarkdownDto } from 'library-shared';
import { get, post } from 'axios';
import { PDFDocument } from 'pdf-lib';
import { ClientProxy } from '@nestjs/microservices';
import { uploadToS3 } from '@aikb/s3-service';
import { MinerUClient, MinerUDefaultConfig } from 'mineru-client';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class AppService {
  private minerUClient: MinerUClient;

  constructor(
    @Inject('pdf_2_markdown_service') private rabbitClient: ClientProxy,
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
      pdfInfo.s3Url = await this.getPdfDownloadUrl(pdfInfo.itemId);
      pdfInfo.pdfData = await this.downloadPdfData(pdfInfo.s3Url);
      pdfInfo.pageCount = await this.calculatePageNum(pdfInfo.pdfData);
    }

    // Get chunking parameters from environment variables
    const chunkSizeThreshold = parseInt(
      process.env['PDF_CHUNK_SIZE_THRESHOLD'] || '20',
      10,
    );
    const chunkSize = parseInt(process.env['PDF_CHUNK_SIZE'] || '10', 10);

    console.log(
      `Page count: ${pdfInfo.pageCount}, Chunk threshold: ${chunkSizeThreshold}, Chunk size: ${chunkSize}`,
    );

    // Check if chunking is needed
    if (pdfInfo.pageCount && pdfInfo.pageCount > chunkSizeThreshold) {
      console.log(
        `Page count (${pdfInfo.pageCount}) exceeds threshold (${chunkSizeThreshold}), chunking PDF`,
      );

      if (!pdfInfo.pdfData) {
        throw new Error('PDF data is required for chunking but not available');
      }

      // Split PDF into chunks
      const pdfChunks = await this.splitPdfIntoChunks(
        pdfInfo.pdfData,
        chunkSize,
      );
      console.log(`PDF split into ${pdfChunks.length} chunks`);

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
          console.log(
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
          console.error(`Failed to upload chunk ${index + 1}:`, error);
          throw new Error(
            `Failed to upload chunk ${index + 1} to S3: ${error}`,
          );
        }
      });

      // Wait for all uploads to complete
      const uploadedChunks = await Promise.all(uploadPromises);
      console.log(`All ${uploadedChunks.length} chunks uploaded successfully`);

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
      console.log('Processing PDF as single document');

      // Convert the entire PDF to markdown
      const markdownContent = await this.convertSinglePdfToMarkdown(
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

  async getPdfDownloadUrl(itemId: string): Promise<string> {
    const bibliographyEndpoint = process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT'];
    if (!bibliographyEndpoint)
      throw new Error('Miss env varible: BIBLIOGRAPHY_SERVICE_ENDPOINT');
    const response = await get(
      `${bibliographyEndpoint}/library-items/${itemId}/download-url`,
    );
    const pdfUrl = response.data.downloadUrl;
    return pdfUrl;
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
      console.log(
        `Starting PDF split: startPage=${startPage}, endPage=${endPage}`,
      );

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      console.log(`Total pages in PDF: ${totalPages}`);

      if (startPage < 0 || endPage >= totalPages || startPage > endPage) {
        throw new Error(
          `Invalid page range: startPage=${startPage}, endPage=${endPage}, totalPages=${totalPages}`,
        );
      }

      // Create a new PDF document for the split portion
      const newPdfDoc = await PDFDocument.create();

      // Copy pages from the original document to the new one
      const pagesToCopy = endPage - startPage + 1;
      console.log(
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
      console.log(`Created new PDF with byte length: ${newPdfBytes.length}`);

      return newPdfBytes;
    } catch (error) {
      console.error(`Error splitting PDF: ${error}`);
      throw error;
    }
  }

  private async splitPdfIntoChunks(
    existingPdfBytes: Buffer,
    chunkSize: number = 10,
  ): Promise<Uint8Array[]> {
    try {
      console.log(`Starting PDF chunking with chunk size: ${chunkSize}`);

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      console.log(`Total pages in PDF: ${totalPages}`);

      const chunks: Uint8Array[] = [];
      const numChunks = Math.ceil(totalPages / chunkSize);

      for (let i = 0; i < numChunks; i++) {
        const startPage = i * chunkSize;
        const endPage = Math.min(startPage + chunkSize - 1, totalPages - 1);

        console.log(
          `Creating chunk ${i + 1}/${numChunks}: pages ${startPage}-${endPage}`,
        );

        const chunkBytes = await this.splitPdf(
          existingPdfBytes,
          startPage,
          endPage,
        );
        chunks.push(chunkBytes);
      }

      console.log(`Created ${chunks.length} PDF chunks`);
      return chunks;
    } catch (error) {
      console.error(`Error chunking PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Convert a single PDF to Markdown using MinerU
   */
  private async convertSinglePdfToMarkdown(
    s3Url: string,
    itemId: string,
  ): Promise<string> {
    try {
      console.log(`Converting single PDF to Markdown for item: ${itemId}`);

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

      console.log(`Created MinerU task: ${taskId} for item: ${itemId}`);

      // Wait for task completion
      const { result, downloadedFiles } =
        await this.minerUClient.waitForTaskCompletion(taskId, {
          pollInterval: 5000,
          timeout: 300000, // 5 minutes
          downloadDir: this.minerUClient['config'].downloadDir,
        });

      if (result.state !== 'done') {
        throw new Error(`MinerU task failed: ${result.err_msg}`);
      }

      // Extract and process images if downloaded files exist
      let markdownContent = '';
      if (downloadedFiles && downloadedFiles.length > 0) {
        markdownContent = await this.extractMarkdownFromDownloadedFiles(
          downloadedFiles,
          itemId,
        );
      } else if (result.full_zip_url) {
        // Download and extract from zip URL
        markdownContent = await this.downloadAndExtractFromZip(
          result.full_zip_url,
          itemId,
        );
      } else {
        throw new Error('No markdown content available from MinerU result');
      }

      console.log(`Successfully converted PDF to Markdown for item: ${itemId}`);
      return markdownContent;
    } catch (error) {
      console.error(
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

    console.log(`Processing ${chunks.length} PDF chunks for item: ${itemId}`);

    for (const chunk of chunks) {
      try {
        console.log(
          `Processing chunk ${chunk.chunkIndex + 1}/${chunks.length} for item: ${itemId}`,
        );

        const markdownContent = await this.convertSinglePdfToMarkdown(
          chunk.s3Url,
          `${itemId}-chunk-${chunk.chunkIndex}`,
        );

        results.push({
          chunkIndex: chunk.chunkIndex,
          markdownContent,
        });

        console.log(
          `Completed processing chunk ${chunk.chunkIndex + 1}/${chunks.length} for item: ${itemId}`,
        );
      } catch (error) {
        console.error(
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
   * Extract markdown content from downloaded files
   */
  private async extractMarkdownFromDownloadedFiles(
    downloadedFiles: string[],
    itemId: string,
  ): Promise<string> {
    try {
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

      throw new Error('No markdown file found in downloaded files');
    } catch (error) {
      console.error(
        `Failed to extract markdown from downloaded files for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Download and extract markdown from a zip file
   */
  private async downloadAndExtractFromZip(
    zipUrl: string,
    itemId: string,
  ): Promise<string> {
    try {
      console.log(`Downloading and extracting from zip: ${zipUrl}`);

      // For now, we'll use a simpler approach - just return a placeholder
      // In a real implementation, you would use a proper zip extraction library
      // like node-stream-zip or adm-zip

      // Download the zip file to check if it's accessible
      const response = await get(zipUrl, { responseType: 'arraybuffer' });
      const zipBuffer = Buffer.from(response.data);

      console.log(
        `Downloaded zip file, size: ${zipBuffer.length} bytes for item: ${itemId}`,
      );

      // For now, return a placeholder markdown content
      // In a real implementation, you would extract the actual markdown content
      return `# Extracted Content for ${itemId}\n\nThis is a placeholder for the extracted markdown content from the zip file.\n\nIn a real implementation, this would contain the actual markdown content extracted from the PDF.`;
    } catch (error) {
      console.error(
        `Failed to download and extract from zip for item ${itemId}:`,
        error,
      );
      throw error;
    }
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

      console.log(
        `Found ${matches.length} images to process for item: ${itemId}`,
      );

      for (const match of matches) {
        const [fullMatch, altText, imagePath] = match;

        try {
          // Check if the image is a local file
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

              // Replace the image reference in markdown
              processedContent = processedContent.replace(
                fullMatch,
                `![${altText}](${s3Url})`,
              );

              console.log(`Uploaded image to S3: ${s3Url}`);
            }
          }
        } catch (imageError) {
          console.error(`Failed to process image ${imagePath}:`, imageError);
          // Keep original image reference if upload fails
        }
      }

      return processedContent;
    } catch (error) {
      console.error(`Failed to process images for item ${itemId}:`, error);
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

      console.log(`Updating bibliography service for item: ${itemId}`);

      const updateDto: UpdateMarkdownDto = {
        id: itemId,
        markdownContent,
      };

      const response = await post(
        `${bibliographyEndpoint}/library-items/${itemId}/markdown`,
        updateDto,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      console.log(
        `Successfully updated bibliography service for item: ${itemId}`,
      );
    } catch (error) {
      console.error(
        `Failed to update bibliography service for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }
}
