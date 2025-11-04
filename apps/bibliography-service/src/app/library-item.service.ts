import { Inject, Injectable } from '@nestjs/common';
import { S3MongoLibraryStorage, LibraryItem, Library } from '@aikb/bibliography';
import {
  CreateLibraryItemDto,
  UpdateMetadataDto,
  UpdateProcessingStatusDto,
  PdfDownloadUrlDto
} from 'library-shared';
import { ClientProxy } from '@nestjs/microservices';
import { Pdf2MArkdownDto } from './pdf_process.dto';

@Injectable()
export class LibraryItemService {
  private library: Library;

  constructor(
    @Inject("PDF_2_MARKDOWN_SERVICE") private rabbitClient: ClientProxy
  ) {
    // Initialize the storage and library
    const storage = new S3MongoLibraryStorage();
    this.library = new Library(storage);
  }

  /**
   * Create a new library item
   * @param createLibraryItemDto The data to create the library item
   * @returns The created library item
   */
  async createLibraryItem(createLibraryItemDto: CreateLibraryItemDto): Promise<LibraryItem> {
    // For now, we'll create a library item without PDF
    // In a full implementation, you might handle PDF upload separately
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
      fileType: createLibraryItemDto.fileType,
      language: createLibraryItemDto.language,
    };

    // Create a placeholder PDF buffer for now
    // In a real implementation, you would upload the PDF file first
    const pdfBuffer = Buffer.from('placeholder');
    const fileName = `${createLibraryItemDto.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    return await this.library.storePdf(pdfBuffer, fileName, metadata);
  }

  /**
   * Get a library item by ID
   * @param id The ID of the library item
   * @returns The library item or null if not found
   */
  async getLibraryItem(id: string): Promise<LibraryItem | null> {
    return await this.library.getItem(id);
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
    collections?: string[]
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

    return await this.library.searchItems(filter);
  }

  /**
   * Delete a library item by ID
   * @param id The ID of the library item to delete
   * @returns True if the item was deleted, false if not found
   */
  async deleteLibraryItem(id: string): Promise<boolean> {
    return await this.library.deleteItem(id);
  }

  /**
   * Update library item metadata
   * @param id The ID of the library item
   * @param updateMetadataDto The metadata to update
   * @returns The updated library item
   */
  async updateLibraryItemMetadata(id: string, updateMetadataDto: UpdateMetadataDto): Promise<LibraryItem> {
    const item = await this.library.getItem(id);
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
    await this.library['storage'].updateMetadata(updatedMetadata);
    
    // Return the updated item
    const updatedItem = await this.library.getItem(id);
    if (!updatedItem) {
      throw new Error(`Failed to retrieve updated library item ${id}`);
    }
    return updatedItem;
  }

  /**
   * Update PDF processing status
   * @param id The ID of the library item
   * @param updateProcessingStatusDto The processing status update
   * @returns The updated library item
   */
  async updatePdfProcessingStatus(id: string, updateProcessingStatusDto: UpdateProcessingStatusDto): Promise<LibraryItem> {
    const item = await this.library.getItem(id);
    if (!item) {
      throw new Error(`Library item with ID ${id} not found`);
    }

    // Prepare the updates
    const updates: any = {
      pdfProcessingStatus: updateProcessingStatusDto.status,
      pdfProcessingMessage: updateProcessingStatusDto.message,
      pdfProcessingProgress: updateProcessingStatusDto.progress,
      pdfProcessingError: updateProcessingStatusDto.error,
      dateModified: new Date(),
    };

    // Add timestamps based on status
    if (updateProcessingStatusDto.status === 'analyzing' && !item.metadata.pdfProcessingStartedAt) {
      updates.pdfProcessingStartedAt = new Date();
    } else if (updateProcessingStatusDto.status === 'completed') {
      updates.pdfProcessingCompletedAt = new Date();
    } else if (updateProcessingStatusDto.status === 'failed') {
      updates.pdfProcessingRetryCount = (item.metadata.pdfProcessingRetryCount || 0) + 1;
    }

    // Update the metadata
    const updatedMetadata = {
      ...item.metadata,
      ...updates,
    };

    await this.library['storage'].updateMetadata(updatedMetadata);
    
    // Return the updated item
    const updatedItem = await this.library.getItem(id);
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
    const item = await this.library.getItem(id);
    if (!item) {
      throw new Error(`Library item with ID ${id} not found`);
    }

    if (!item.metadata.s3Key) {
      throw new Error(`No PDF file associated with library item ${id}`);
    }

    // Get the download URL from storage
    const downloadUrl = await this.library['storage'].getPdfDownloadUrl(item.metadata.s3Key);
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      downloadUrl,
      expiresAt,
    };
  }

  async producePdf2MarkdownRequest(req: Pdf2MArkdownDto) {
    console.log('producePdf2MarkdownRequest called with:', req);
    try {
      // Send message to the configured queue
      // The pattern name should match to routing key expected by consumers
      console.log('Emitting message to RabbitMQ...');
      this.rabbitClient.emit("request-pdf-2-markdown-conversion", req);
      console.log('Message emitted successfully');
    } catch (error) {
      console.error('Error sending message to RabbitMQ:', error);
      throw error;
    }

    return {
        message: "pdf2md request published"
    }
  }
}