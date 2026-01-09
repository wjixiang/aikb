import { Inject, Injectable } from '@nestjs/common';
import {
  LibraryItem,
  ItemArchive,
} from 'bibliography';
import {
  CreateLibraryItemDto,
  CreateLibraryItemWithPdfDto,
  UpdateMetadataDto,
  PdfDownloadUrlDto,
  PdfUploadUrlDto,
  PdfUploadUrlResponseDto,
  AddItemArchiveDto,
  CreateChunkEmbedGroupDto,
} from 'library-shared';
import { Pdf2MArkdownDto } from 'library-shared';
import { createLoggerWithPrefix } from 'log-management';
import { S3Service } from '@aikb/s3-service';
import { S3Utils } from 'utils';
import { HashUtils } from 'bibliography';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { BibliographyDBPrismaService } from 'bibliography-db';
import { VectorService } from 'bibliography-lib';
import { LibraryService } from 'bibliography';
import { ChunkEmbedGroupMetadata } from '@/libs/item-vector-storage/src';
import { defaultChunkingConfig } from 'chunking';
import { defaultEmbeddingConfig } from 'embedding';

@Injectable()
export class LibraryItemService {
  private logger = createLoggerWithPrefix('bibliography-service');

  constructor(
    private amqpConnection: AmqpConnection,
    @Inject('S3_SERVICE') private s3Service: S3Service,
    private bibliographyDBPrismaService: BibliographyDBPrismaService,
    private vectorService: VectorService,
    private libraryService: LibraryService,
  ) { }

  /**
   * Create a new library item
   * @param createLibraryItemDto The data to create the library item
   * @returns The created library item
   */
  async createLibraryItem(
    createLibraryItemDto: CreateLibraryItemDto,
  ): Promise<LibraryItem> {
    // Create a library item without any archives using the new separated approach
    const metadata = {
      title: createLibraryItemDto.title,
      authors: createLibraryItemDto.authors,
      abstract: createLibraryItemDto.abstract,
      publicationYear: createLibraryItemDto.publicationYear,
      publisher: createLibraryItemDto.publisher,
      isbn: createLibraryItemDto.isbn,
      doi: createLibraryItemDto.doi,
      url: createLibraryItemDto.url,
      tags: createLibraryItemDto.tags,
      notes: createLibraryItemDto.notes,
      collections: createLibraryItemDto.collections,
      language: createLibraryItemDto.language,
    };

    return await this.libraryService.createItem(metadata);
  }

  /**
   * Create a new library item with PDF buffer
   * @param createLibraryItemWithPdfDto The data to create the library item with PDF buffer
   * @returns The created library item
   */
  async createLibraryItemWithPdfBuffer(
    createLibraryItemWithPdfDto: CreateLibraryItemWithPdfDto,
  ): Promise<LibraryItem> {
    // First create the item without archives
    const metadata = {
      title: createLibraryItemWithPdfDto.title,
      authors: createLibraryItemWithPdfDto.authors,
      abstract: createLibraryItemWithPdfDto.abstract,
      publicationYear: createLibraryItemWithPdfDto.publicationYear,
      publisher: createLibraryItemWithPdfDto.publisher,
      isbn: createLibraryItemWithPdfDto.isbn,
      doi: createLibraryItemWithPdfDto.doi,
      url: createLibraryItemWithPdfDto.url,
      tags: createLibraryItemWithPdfDto.tags,
      notes: createLibraryItemWithPdfDto.notes,
      collections: createLibraryItemWithPdfDto.collections,
      language: createLibraryItemWithPdfDto.language,
    };

    const item = await this.libraryService.createItem(metadata);

    // Then add the PDF archive to the created item
    const pdfBuffer = createLibraryItemWithPdfDto.pdfBuffer;
    const fileName =
      createLibraryItemWithPdfDto.fileName ||
      `${createLibraryItemWithPdfDto.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    // Generate S3 key for the PDF file
    const s3Key = S3Utils.generatePdfS3Key(fileName);

    // Generate hash for the PDF buffer
    const fileHash = HashUtils.generateHashFromBuffer(pdfBuffer);

    // Upload the PDF to S3
    await this.s3Service.uploadToS3(pdfBuffer, s3Key, {
      contentType: 'application/pdf',
    });

    // Create an ItemArchive object with the PDF information
    const newArchive: ItemArchive = {
      fileType: 'pdf',
      fileSize: pdfBuffer.length,
      fileHash,
      addDate: new Date(),
      s3Key,
      pageCount: createLibraryItemWithPdfDto.pageCount,
    };

    // Add the archive to the item
    await item.addArchiveToMetadata(newArchive);

    // Return the updated item
    const updatedItem = await this.libraryService.getItem(item.getItemId());
    if (!updatedItem) {
      throw new Error(
        `Failed to retrieve updated library item ${item.getItemId()}`,
      );
    }
    return updatedItem;
  }

  /**
   * Get a library item by ID
   * @param id The ID of the library item
   * @returns The library item or null if not found
   */
  async getLibraryItem(id: string): Promise<LibraryItem | null> {
    return await this.libraryService.getItem(id);
  }

  /**
   * Search for library items
   * @param query The search query
   * @param tags Optional tags to filter by
   * @param collections Optional collections to filter by
   * @returns Array of matching library items
   */
  async searchLibraryItems(
    query?: string,
    tags?: string[],
    collections?: string[],
  ): Promise<LibraryItem[]> {
    const filter: any = {};

    if (query) {
      filter.query = query;
    }

    if (tags && tags.length > 0) {
      filter.tags = tags;
    }

    if (collections && collections.length > 0) {
      filter.collections = collections;
    }

    return await this.libraryService.searchItems(filter);
  }

  /**
   * Delete a library item by ID
   * @param id The ID of the library item to delete
   * @returns True if the item was deleted, false if not found
   */
  async deleteLibraryItem(id: string): Promise<boolean> {
    return await this.libraryService.deleteItem(id);
  }

  /**
   * Update library item metadata
   * @param id The ID of the library item
   * @param updateMetadataDto The metadata to update
   * @returns The updated library item
   */
  async updateLibraryItemMetadata(
    id: string,
    updateMetadataDto: UpdateMetadataDto,
  ): Promise<LibraryItem> {
    const item = await this.libraryService.getItem(id);
    if (!item) {
      throw new Error(`Library item with ID ${id} not found`);
    }

    // Update the metadata with the provided values
    const updatedMetadata = {
      ...item.metadata,
      ...updateMetadataDto,
      dateModified: new Date(),
    };

    // Update the metadata through the storage
    await this.libraryService.storage.updateMetadata(updatedMetadata);

    // Return the updated item
    const updatedItem = await this.libraryService.getItem(id);
    if (!updatedItem) {
      throw new Error(`Failed to retrieve updated library item ${id}`);
    }
    return updatedItem;
  }

  /**
   * Get PDF download URL
   * @param id The ID of the library item
   * @returns The download URL and expiration time
   */
  async getPdfDownloadUrl(id: string): Promise<PdfDownloadUrlDto> {
    const item = await this.libraryService.getItem(id);
    if (!item) {
      throw new Error(`Library item with ID ${id} not found`);
    }

    if (!item.metadata.archives || item.metadata.archives.length === 0) {
      throw new Error(`No PDF file associated with library item ${id}`);
    }

    // Get the download URL from storage (use the first archive)
    const downloadUrl = await this.libraryService.storage.getPdfDownloadUrl(
      item.metadata.archives[0].s3Key,
    );

    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      downloadUrl,
      expiresAt,
    };
  }

  /**
   * Get PDF upload URL
   * @param pdfUploadUrlDto The request data for generating upload URL
   * @returns The upload URL, S3 key, and expiration time
   */
  async getPdfUploadUrl(
    pdfUploadUrlDto: PdfUploadUrlDto,
  ): Promise<PdfUploadUrlResponseDto> {
    try {
      // Generate S3 key for the PDF file using unified utility
      const s3Key = S3Utils.generatePdfS3Key(pdfUploadUrlDto.fileName);

      // Generate presigned URL for upload using injected S3 service
      const uploadUrl = await this.s3Service.getSignedUploadUrl(s3Key, {
        contentType: 'application/pdf',
        expiresIn: pdfUploadUrlDto.expiresIn || 3600, // Default to 1 hour
      });

      // Set expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(
        expiresAt.getSeconds() + (pdfUploadUrlDto.expiresIn || 3600),
      );

      return {
        uploadUrl,
        s3Key,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to generate PDF upload URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async producePdf2MarkdownRequest(req: Pdf2MArkdownDto) {
    this.logger.debug('producePdf2MarkdownRequest called with:', req);
    try {
      // Use @golevelup/nestjs-rabbitmq
      this.amqpConnection.publish('library', 'item.pdf2md', req);
    } catch (error) {
      this.logger.error('Error sending message to RabbitMQ:', error);
      throw error;
    }

    return {
      message: 'pdf2md request published',
    };
  }

  /**
   * Update library item markdown content
   * @param id The ID of the library item
   * @param markdownContent The markdown content to update
   * @returns The updated library item
   */
  async updateLibraryItemMarkdown(
    id: string,
    markdownContent: string,
  ): Promise<LibraryItem> {
    console.debug(
      `[DEBUG] updateLibraryItemMarkdown called with id: ${id}, markdownContent length: ${markdownContent.length}`,
    );
    const item = await this.libraryService.getItem(id);
    if (!item) {
      throw new Error(`Library item with ID ${id} not found`);
    }
    console.debug(`[DEBUG] Found item: ${JSON.stringify(item.metadata)}`);

    // Update the markdown content
    const updatedMetadata = {
      ...item.metadata,
      markdownContent,
      markdownUpdatedDate: new Date(),
      dateModified: new Date(),
    };

    // Update the metadata through the storage
    await this.libraryService.storage.updateMetadata(updatedMetadata);

    // Return the updated item
    const updatedItem = await this.libraryService.getItem(id);
    if (!updatedItem) {
      throw new Error(`Failed to retrieve updated library item ${id}`);
    }

    return updatedItem;
  }

  /**
   * Add an archive to a library item
   * @param id The ID of the library item
   * @param addItemArchiveDto The archive data to add
   * @returns The updated library item
   */
  async addArchiveToItem(
    id: string,
    addItemArchiveDto: AddItemArchiveDto,
  ): Promise<LibraryItem> {
    this.logger.debug('addArchiveToItem called with id:', id);
    this.logger.debug('libraryService object:', this.libraryService);
    this.logger.debug('libraryService.storage:', this.libraryService.storage);

    const item = await this.libraryService.getItem(id);
    if (!item) {
      throw new Error(`Library item with ID ${id} not found`);
    }

    // Create the new archive object with the current date
    // Ensure pageCount is provided for PDF files
    if (addItemArchiveDto.fileType === 'pdf' && !addItemArchiveDto.pageCount) {
      throw new Error('pageCount is required for PDF files');
    }

    const newArchive: ItemArchive = {
      fileType: addItemArchiveDto.fileType,
      fileSize: addItemArchiveDto.fileSize,
      fileHash: addItemArchiveDto.fileHash,
      addDate: new Date(),
      s3Key: addItemArchiveDto.s3Key,
      pageCount: addItemArchiveDto.pageCount!,
      wordCount: addItemArchiveDto.wordCount,
    };

    await item.addArchiveToMetadata(newArchive);

    // Return the updated item
    const updatedItem = await this.libraryService.getItem(id);
    if (!updatedItem) {
      throw new Error(`Failed to retrieve updated library item ${id}`);
    }

    if (!(await updatedItem.getMarkdown())) {
      // Triger markdown extraction
      switch (newArchive.fileType) {
        case 'pdf':
          await this.producePdf2MarkdownRequest({
            itemId: updatedItem.getItemId(),
            fileType: 'pdf',
            fileSize: newArchive.fileSize,
            fileHash: newArchive.fileHash,
            addDate: newArchive.addDate,
            s3Key: newArchive.s3Key,
            pageCount: newArchive.pageCount,
          });
          break;
        default:
          this.logger.error(
            `none support file type for markdown extraction`,
            newArchive,
          );
      }
    }

    return updatedItem;
  }

  /**
   * Create a new chunk embed group for a library item
   * @param input The input data for creating the chunk embed group
   * @returns The created chunk embed group
   */
  async createChunkEmbedGroup(
    input: CreateChunkEmbedGroupDto,
  ): Promise<ChunkEmbedGroupMetadata> {
    try {
      // Convert the GraphQL input to the format expected by the vector service
      const request = {
        itemId: input.itemId,
        name: input.name || '',
        description: input.description || '',
        chunkingConfig: input.chunkingConfig
          ? {
            strategy: input.chunkingConfig.strategy,
            parameters: {},
          }
          : defaultChunkingConfig,
        embeddingConfig: input.embeddingConfig
          ? {
            provider: input.embeddingConfig.provider,
            model: input.embeddingConfig.model,
            dimension: input.embeddingConfig.dimension,
            batchSize: input.embeddingConfig.batchSize || 20,
            maxRetries: input.embeddingConfig.maxRetries || 3,
            timeout: input.embeddingConfig.timeout || 20000,
            parameters: {},
          }
          : defaultEmbeddingConfig,
        isDefault: input.isDefault || false,
        isActive: input.isActive !== undefined ? input.isActive : true,
        createdBy: input.createdBy || '',
        tags: [],
      };

      // Create the chunk embed group using the vector service
      const createdGroup =
        await this.vectorService.createChunkEmbedGroup(request);

      return createdGroup;
    } catch (error) {
      this.logger.error('Error creating chunk embed group:', error);
      throw new Error(
        `Failed to create chunk embed group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
