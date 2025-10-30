import { Injectable } from '@nestjs/common';
import { S3MongoLibraryStorage, LibraryItem, Library } from '@aikb/bibliography';
import { CreateLibraryItemDto } from '@aikb/library-shared';

@Injectable()
export class LibraryItemService {
  private library: Library;

  constructor() {
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
}