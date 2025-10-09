import {
  uploadToS3,
  uploadPdfFromPath,
  getSignedUploadUrl,
  getSignedUrlForDownload,
} from '../lib/s3Service/S3Service';
import { connectToDatabase } from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from '../lib/logger';
import { MinerUPdfConvertor, createMinerUConvertorFromEnv } from './PdfConvertor';
// 导入新的统一chunking接口
import { chunkTextAdvanced, getAvailableStrategies } from '../lib/chunking/chunkingToolV2';
import { h1Chunking, paragraphChunking, chunkText, ChunkResult } from '../lib/chunking/chunkingTool';
import { embeddingService } from '../lib/embedding/embedding';

// Enhanced metadata interfaces for Zotero-like functionality
export interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
}

export interface BookMetadata {
  id?: string;
  title: string;
  authors: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[]; // Collection IDs this item belongs to
  dateAdded: Date;
  dateModified: Date;
  fileType: 'pdf' | 'article' | 'book' | 'other';
  s3Key?: string;
  s3Url?: string;
  fileSize?: number;
  pageCount?: number;
  language?: string;
  contentHash?: string; // Hash of the content for deduplication
  markdownContent?: string; // Converted markdown content from PDF
  markdownUpdatedDate?: Date; // When the markdown was last updated
}

export interface Collection {
  id?: string;
  name: string;
  description?: string;
  parentCollectionId?: string; // For nested collections
  dateAdded: Date;
  dateModified: Date;
}

export interface Citation {
  id: string;
  itemId: string;
  citationStyle: string; // APA, MLA, Chicago, etc.
  citationText: string;
  dateGenerated: Date;
}

export interface SearchFilter {
  query?: string;
  tags?: string[];
  collections?: string[];
  authors?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  fileType?: string[];
}

/**
 * Utility functions for generating content hashes
 */
export class HashUtils {
  /**
   * Generate SHA-256 hash from file buffer
   */
  static generateHashFromBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate SHA-256 hash from file path
   */
  static async generateHashFromPath(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    return this.generateHashFromBuffer(fileBuffer);
  }

  /**
   * Generate hash from metadata fields (for articles without files)
   */
  static generateHashFromMetadata(metadata: Partial<BookMetadata>): string {
    const hashInput = {
      title: metadata.title || '',
      authors:
        metadata.authors
          ?.map(
            (author) =>
              `${author.lastName},${author.firstName}${author.middleName ? ',' + author.middleName : ''}`,
          )
          .sort()
          .join('|') || '',
      abstract: metadata.abstract || '',
      publicationYear: metadata.publicationYear || 0,
      publisher: metadata.publisher || '',
      doi: metadata.doi || '',
      isbn: metadata.isbn || '',
    };

    const hashString = JSON.stringify(hashInput);
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }
}

/**
 * Utility functions for generating IDs without database dependency
 */
export class IdUtils {
  /**
   * Generate a unique ID using timestamp and random string
   */
  static generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${randomStr}`;
  }

  /**
   * Generate a UUID-like ID (without using crypto.randomUUID for compatibility)
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}

/**
 * Manage overall storage & retrieve of books/literatures/articles
 */
export abstract class AbstractLibrary {
  protected storage: AbstractLibraryStorage;
  protected pdfConvertor?: MinerUPdfConvertor;

  constructor(storage: AbstractLibraryStorage, pdfConvertor?: MinerUPdfConvertor) {
    this.storage = storage;
    this.pdfConvertor = pdfConvertor;
  }

  /**
   * Store a PDF file from a buffer
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param metadata PDF metadata
   */
  abstract storePdf(
    pdfBuffer: Buffer,
    fileName: string,
    metadata: Partial<BookMetadata>,
  ): Promise<LibraryItem>;

  /**
   * Re-extract markdown for a specific item or all items
   * @param itemId Optional ID of the item to re-extract markdown for
   */
  abstract reExtractMarkdown(itemId?: string): Promise<void>;

  /**
   * Get a book by ID
   */
  abstract getBook(id: string): Promise<LibraryItem | null>;

  /**
   * Search for items with filters
   */
  abstract searchItems(filter: SearchFilter): Promise<LibraryItem[]>;

  /**
   * Create a new collection
   */
  abstract createCollection(
    name: string,
    description?: string,
    parentCollectionId?: string,
  ): Promise<Collection>;

  /**
   * Get all collections
   */
  abstract getCollections(): Promise<Collection[]>;

  /**
   * Add item to collection
   */
  abstract addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void>;

  /**
   * Remove item from collection
   */
  abstract removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void>;

  /**
   * Generate citation for an item
   */
  abstract generateCitation(itemId: string, style: string): Promise<Citation>;

  /**
   * Delete a book by ID
   */
  abstract deleteBook(id: string): Promise<boolean>;

  /**
   * Delete a collection by ID
   */
  abstract deleteCollection(id: string): Promise<boolean>;

  /**
   * Delete all items in a collection
   */
  abstract deleteItemsInCollection(collectionId: string): Promise<number>;

  // Chunk-related abstract methods
  /**
   * Process markdown content into chunks and generate embeddings
   * @param itemId The ID of the item to process
   * @param chunkingStrategy The chunking strategy to use ('h1' or 'paragraph')
   */
  abstract processItemChunks(itemId: string, chunkingStrategy?: 'h1' | 'paragraph'): Promise<void>;

  /**
   * Get chunks for a specific item
   * @param itemId The ID of the item
   */
  abstract getItemChunks(itemId: string): Promise<BookChunk[]>;

  /**
   * Search chunks with filters
   * @param filter Search filters
   */
  abstract searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]>;

  /**
   * Find similar chunks based on a query vector
   * @param queryVector The query vector
   * @param limit Maximum number of results
   * @param threshold Similarity threshold
   * @param itemIds Optional list of item IDs to search within
   */
  abstract findSimilarChunks(
    queryVector: number[],
    limit?: number,
    threshold?: number,
    itemIds?: string[],
  ): Promise<Array<BookChunk & { similarity: number }>>;

  /**
   * Find similar chunks within a specific LibraryItem
   * @param itemId The LibraryItem ID to search within
   * @param queryVector The query vector
   * @param limit Maximum number of results
   * @param threshold Similarity threshold
   */
  abstract findSimilarChunksInItem(
    itemId: string,
    queryVector: number[],
    limit?: number,
    threshold?: number,
  ): Promise<Array<BookChunk & { similarity: number }>>;

  /**
   * Search chunks within a specific LibraryItem
   * @param itemId The LibraryItem ID to search within
   * @param query The search query
   * @param limit Maximum number of results
   */
  abstract searchChunksInItem(
    itemId: string,
    query: string,
    limit?: number,
  ): Promise<BookChunk[]>;

  /**
   * Re-process chunks for a specific item or all items
   * @param itemId Optional ID of the item to re-process
   * @param chunkingStrategy The chunking strategy to use
   */
  abstract reProcessChunks(itemId?: string, chunkingStrategy?: 'h1' | 'paragraph'): Promise<void>;

  /**
   * Helper method to format citation
   */
  protected formatCitation(metadata: BookMetadata, style: string): string {
    const authors = metadata.authors
      .map(
        (author) =>
          `${author.lastName}, ${author.firstName}${author.middleName ? ' ' + author.middleName[0] + '.' : ''}`,
      )
      .join(', ');

    switch (style.toLowerCase()) {
      case 'apa':
        return `${authors} (${metadata.publicationYear}). ${metadata.title}. ${metadata.publisher || ''}.`;
      case 'mla':
        return `${authors}. "${metadata.title}." ${metadata.publisher || ''}, ${metadata.publicationYear}.`;
      case 'chicago':
        return `${authors}. ${metadata.title}. ${metadata.publisher || ''}, ${metadata.publicationYear}.`;
      default:
        return `${authors}. ${metadata.title}. ${metadata.publicationYear}.`;
    }
  }
}

/**
 * Default implementation of Library
 */
export default class Library extends AbstractLibrary {
  constructor(
    storage: AbstractLibraryStorage,
    pdfConvertor?: MinerUPdfConvertor,
  ) {
    super(storage, pdfConvertor);
  }

  /**
   * Store a PDF file from a buffer
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param metadata PDF metadata
   */
  async storePdf(
    pdfBuffer: Buffer,
    fileName: string,
    metadata: Partial<BookMetadata>,
  ): Promise<LibraryItem> {
    // Validate inputs
    if (!fileName) {
      throw new Error('File name is required when providing a buffer');
    }

    // Generate hash from file content
    const contentHash = HashUtils.generateHashFromBuffer(pdfBuffer);

    // Check if item with same hash already exists
    const existingItem = await this.storage.getMetadataByHash(contentHash);
    if (existingItem) {
      console.log(
        `Item with same content already exists (ID: ${existingItem.id}), returning existing item`,
      );
      return new LibraryItem(existingItem, this.storage);
    }

    // Upload to S3
    const pdfInfo = await this.storage.uploadPdf(pdfBuffer, fileName);

    const fullMetadata: BookMetadata = {
      ...metadata,
      title: metadata.title || path.basename(fileName, '.pdf'),
      s3Key: pdfInfo.s3Key,
      s3Url: pdfInfo.url,
      fileSize: pdfBuffer.length,
      contentHash,
      dateAdded: new Date(),
      dateModified: new Date(),
      tags: metadata.tags || [],
      collections: metadata.collections || [],
      authors: metadata.authors || [],
      fileType: 'pdf',
    };

    // Save metadata first to get the ID
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    const libraryItem = new LibraryItem(savedMetadata, this.storage);

    // Convert to Markdown if MinerUPdfConvertor is available
    if (this.pdfConvertor) {
      try {
        // Create a temporary file for conversion
        const tempDir = require('os').tmpdir();
        const conversionPath = path.join(tempDir, `temp-pdf-${Date.now()}.pdf`);
        fs.writeFileSync(conversionPath, pdfBuffer);

        console.log(`Converting PDF to Markdown: ${conversionPath}`);
        const conversionResult =
          await this.pdfConvertor.convertPdfToMarkdown(conversionPath);

        // Clean up temporary file
        try {
          fs.unlinkSync(conversionPath);
        } catch (error) {
          console.warn(
            `Failed to clean up temporary file: ${conversionPath}`,
            error,
          );
        }

        if (conversionResult.success && conversionResult.data) {
          // Extract markdown content from the conversion result
          // Note: The actual extraction logic depends on the structure of conversionResult.data
          // For now, we'll assume it contains a markdown string or can be converted to one
          let markdownContent = '';

          if (typeof conversionResult.data === 'string') {
            markdownContent = conversionResult.data;
          } else if (conversionResult.data.markdown) {
            markdownContent = conversionResult.data.markdown;
          } else if (conversionResult.data.content) {
            markdownContent = conversionResult.data.content;
          } else {
            // If it's a complex object, stringify it for now
            // In a real implementation, you would parse the structure properly
            markdownContent = JSON.stringify(conversionResult.data, null, 2);
          }

          // Save the converted Markdown content
          await this.storage.saveMarkdown(savedMetadata.id!, markdownContent);
          console.log(
            `Successfully saved Markdown content for item: ${savedMetadata.id}`,
          );

          // Update the library item's metadata to include the markdown content
          libraryItem.metadata.markdownContent = markdownContent;
          libraryItem.metadata.markdownUpdatedDate = new Date();
        } else {
          console.warn(
            `Failed to convert PDF to Markdown: ${conversionResult.error}`,
          );
        }
      } catch (error) {
        console.error(`Error converting PDF to Markdown:`, error);
        // Don't fail the entire operation if conversion fails
      }
    } else {
      console.log('No PDF converter provided, skipping Markdown conversion');
    }

    // Process chunks and embeddings after markdown conversion
    if (libraryItem.metadata.markdownContent) {
      try {
        console.log(`Processing chunks and embeddings for item: ${savedMetadata.id}`);
        await this.processItemChunks(savedMetadata.id!, 'h1'); // Default to H1 chunking
        console.log(`Successfully processed chunks and embeddings for item: ${savedMetadata.id}`);
      } catch (error) {
        console.error(`Error processing chunks for item ${savedMetadata.id}:`, error);
        // Don't fail the entire operation if chunking fails
      }
    }

    return libraryItem;
  }

  async reExtractMarkdown(itemId?: string): Promise<void> {
    try {
      if (itemId) {
        // Re-extract markdown for a specific item
        const item = await this.getBook(itemId);
        if (!item) {
          throw new Error(`Item with ID ${itemId} not found`);
        }
        
        console.log(`Re-extracting markdown for item: ${itemId}`);
        await item.extractMarkdown();
        console.log(`Successfully re-extracted markdown for item: ${itemId}`);
      } else {
        // Re-extract markdown for all items that have PDFs
        console.log('Re-extracting markdown for all items with PDFs...');
        
        // Get all items with PDF files
        const allItems = await this.searchItems({ fileType: ['pdf'] });
        
        for (const item of allItems) {
          if (item.hasPdf()) {
            try {
              console.log(`Re-extracting markdown for item: ${item.metadata.id}`);
              await item.extractMarkdown();
              console.log(`Successfully re-extracted markdown for item: ${item.metadata.id}`);
            } catch (error) {
              console.error(`Failed to re-extract markdown for item ${item.metadata.id}:`, error);
              // Continue with other items even if one fails
            }
          }
        }
        
        console.log('Completed re-extraction of markdown for all items');
      }
    } catch (error) {
      console.error('Error in reExtractMarkdown:', error);
      throw error;
    }
  }

  /**
   * Get a book by ID
   */
  async getBook(id: string): Promise<LibraryItem | null> {
    const metadata = await this.storage.getMetadata(id);
    if (!metadata) return null;
    return new LibraryItem(metadata, this.storage);
  }

  /**
   * Search for items with filters
   */
  async searchItems(filter: SearchFilter): Promise<LibraryItem[]> {
    const metadataList = await this.storage.searchMetadata(filter);
    return metadataList.map(
      (metadata) => new LibraryItem(metadata, this.storage),
    );
  }

  /**
   * Create a new collection
   */
  async createCollection(
    name: string,
    description?: string,
    parentCollectionId?: string,
  ): Promise<Collection> {
    const collection: Collection = {
      name,
      description,
      parentCollectionId,
      dateAdded: new Date(),
      dateModified: new Date(),
    };

    return await this.storage.saveCollection(collection);
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    return await this.storage.getCollections();
  }

  /**
   * Add item to collection
   */
  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.storage.addItemToCollection(itemId, collectionId);
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.storage.removeItemFromCollection(itemId, collectionId);
  }

  /**
   * Generate citation for an item
   */
  async generateCitation(itemId: string, style: string): Promise<Citation> {
    const metadata = await this.storage.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    // This is a simplified citation generator
    // In a real implementation, you would use a proper citation library
    const citationText = this.formatCitation(metadata, style);

    const citation: Citation = {
      id: IdUtils.generateId(),
      itemId,
      citationStyle: style,
      citationText,
      dateGenerated: new Date(),
    };

    await this.storage.saveCitation(citation);
    return citation;
  }

  /**
   * Delete a book by ID
   */
  async deleteBook(id: string): Promise<boolean> {
    const metadata = await this.storage.getMetadata(id);
    if (!metadata) {
      return false;
    }

    // Delete from storage
    return await this.storage.deleteMetadata(id);
  }

  /**
   * Delete a collection by ID
   */
  async deleteCollection(id: string): Promise<boolean> {
    return await this.storage.deleteCollection(id);
  }

  /**
   * Delete all items in a collection
   */
  async deleteItemsInCollection(collectionId: string): Promise<number> {
    const items = await this.searchItems({ collections: [collectionId] });
    let deletedCount = 0;

    for (const item of items) {
      const success = await this.deleteBook(item.metadata.id!);
      if (success) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // Chunk-related methods implementation
  async processItemChunks(itemId: string, chunkingStrategy: 'h1' | 'paragraph' = 'h1'): Promise<void> {
    try {
      // Get the item metadata
      const item = await this.getBook(itemId);
      if (!item) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      // Get the markdown content
      const markdownContent = await item.getMarkdown();
      if (!markdownContent) {
            console.warn(`No markdown content found for item: ${itemId}`);
            return;
          }
    
          console.log(`Chunking markdown content for item: ${itemId} using strategy: ${chunkingStrategy}`);
    
          // Delete existing chunks for this item
          await this.storage.deleteChunksByItemId(itemId);
    
          // Chunk the markdown content
          let chunkResults: ChunkResult[] | string[];
          if (chunkingStrategy === 'h1') {
            chunkResults = h1Chunking(markdownContent);
          } else {
            chunkResults = paragraphChunking(markdownContent);
          }
    
          if (chunkResults.length === 0) {
            console.warn(`No chunks generated for item: ${itemId}`);
            return;
          }
    
          console.log(`Generated ${chunkResults.length} chunks for item: ${itemId}`);
    
          // Prepare chunks for storage
          const chunks: BookChunk[] = [];
          const chunkTexts: string[] = [];
    
          for (let i = 0; i < chunkResults.length; i++) {
            const chunkResult = chunkResults[i];
            
            let title: string;
            let content: string;
            
            if (typeof chunkResult === 'string') {
              // Paragraph chunking
              title = `Paragraph ${i + 1}`;
              content = chunkResult;
            } else {
              // H1 chunking
              title = chunkResult.title;
              content = chunkResult.content;
            }
    
            const chunk: BookChunk = {
              id: IdUtils.generateId(),
              itemId,
              title,
              content,
              index: i,
              metadata: {
                chunkType: chunkingStrategy,
                wordCount: content.split(/\s+/).length,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            };
    
            chunks.push(chunk);
            chunkTexts.push(content);
          }
    
          // Generate embeddings for all chunks
          console.log(`Generating embeddings for ${chunkTexts.length} chunks`);
          const embeddings = await embeddingService.embedBatch(chunkTexts);
          
          // Assign embeddings to chunks
          for (let i = 0; i < chunks.length; i++) {
            if (embeddings[i]) {
              chunks[i].embedding = embeddings[i] || undefined;
            }
          }
    
          // Save chunks to storage
          await this.storage.batchSaveChunks(chunks);
          console.log(`Successfully saved ${chunks.length} chunks to storage for item: ${itemId}`);
    
        } catch (error) {
          console.error(`Error processing chunks for item ${itemId}:`, error);
          throw error;
        }
      }

      async getItemChunks(itemId: string): Promise<BookChunk[]> {
        return await this.storage.getChunksByItemId(itemId);
      }

      async searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]> {
        return await this.storage.searchChunks(filter);
      }

      async findSimilarChunks(
        queryVector: number[],
        limit: number = 10,
        threshold: number = 0.7,
        itemIds?: string[],
      ): Promise<Array<BookChunk & { similarity: number }>> {
        return await this.storage.findSimilarChunks(queryVector, limit, threshold, itemIds);
      }

      async findSimilarChunksInItem(
        itemId: string,
        queryVector: number[],
        limit: number = 10,
        threshold: number = 0.7,
      ): Promise<Array<BookChunk & { similarity: number }>> {
        return await this.findSimilarChunks(queryVector, limit, threshold, [itemId]);
      }

      async searchChunksInItem(
        itemId: string,
        query: string,
        limit: number = 10,
      ): Promise<BookChunk[]> {
        return await this.searchChunks({
          query,
          itemId,
          limit,
        });
      }

      async reProcessChunks(itemId?: string, chunkingStrategy: 'h1' | 'paragraph' = 'h1'): Promise<void> {
        try {
          if (itemId) {
            // Re-process chunks for a specific item
            console.log(`Re-processing chunks for item: ${itemId}`);
            await this.processItemChunks(itemId, chunkingStrategy);
            console.log(`Successfully re-processed chunks for item: ${itemId}`);
          } else {
            // Re-process chunks for all items that have markdown content
            console.log('Re-processing chunks for all items with markdown content...');
            
            // Get all items
            const allItems = await this.searchItems({});
            
            for (const item of allItems) {
              try {
                const markdownContent = await item.getMarkdown();
                if (markdownContent) {
                  console.log(`Re-processing chunks for item: ${item.metadata.id}`);
                  await this.processItemChunks(item.metadata.id!, chunkingStrategy);
                  console.log(`Successfully re-processed chunks for item: ${item.metadata.id}`);
                }
              } catch (error) {
                console.error(`Failed to re-process chunks for item ${item.metadata.id}:`, error);
                // Continue with other items even if one fails
              }
            }
            
            console.log('Completed re-processing of chunks for all items');
          }
        } catch (error) {
          console.error('Error in reProcessChunks:', error);
          throw error;
        }
      }
}

export class LibraryItem {
  constructor(
    public metadata: BookMetadata,
    private storage: AbstractLibraryStorage,
  ) {}

  /**
   * Check if this item has an associated PDF file
   */
  hasPdf(): boolean {
    return !!this.metadata.s3Key;
  }

  /**
   * Get the PDF file if available
   */
  async getPdf(): Promise<Buffer | null> {
    if (!this.metadata.s3Key) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdf(this.metadata.s3Key);
  }

  /**
   * Get the PDF download URL if available
   */
  async getPdfDownloadUrl(): Promise<string> {
    if (!this.metadata.s3Key) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdfDownloadUrl(this.metadata.s3Key);
  }

  /**
   * Get markdown representation of the item
   */
  async getMarkdown(): Promise<string> {
    // First try to get stored markdown content
    const storedMarkdown = await this.storage.getMarkdown(this.metadata.id!);
    if (storedMarkdown) {
      return storedMarkdown;
    }

    // If no stored markdown, return a placeholder
    return `# ${this.metadata.title}\n\n${this.metadata.abstract || ''}`;
  }

  /**
   * Update the metadata of this item
   */
  async updateMetadata(updates: Partial<BookMetadata>): Promise<void> {
    this.metadata = { ...this.metadata, ...updates, dateModified: new Date() };
    await this.storage.updateMetadata(this.metadata);
  }

  /**
   * Add a tag to this item
   */
  async addTag(tag: string): Promise<void> {
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
      await this.updateMetadata({ tags: this.metadata.tags });
    }
  }

  /**
   * Remove a tag from this item
   */
  async removeTag(tag: string): Promise<void> {
    const index = this.metadata.tags.indexOf(tag);
    if (index > -1) {
      this.metadata.tags.splice(index, 1);
      await this.updateMetadata({ tags: this.metadata.tags });
    }
  }

  /**
   * Add this item to a collection
   */
  async addToCollection(collectionId: string): Promise<void> {
    if (!this.metadata.collections.includes(collectionId)) {
      this.metadata.collections.push(collectionId);
      await this.updateMetadata({ collections: this.metadata.collections });
    }
  }

  /**
   * Remove this item from a collection
   */
  async removeFromCollection(collectionId: string): Promise<void> {
    const index = this.metadata.collections.indexOf(collectionId);
    if (index > -1) {
      this.metadata.collections.splice(index, 1);
      await this.updateMetadata({ collections: this.metadata.collections });
    }
  }

  async extractMarkdown(): Promise<void> {
    // Check if this item has an associated PDF file
    if (!this.hasPdf()) {
      throw new Error('No PDF file associated with this item');
    }

    try {
      // Get the PDF download URL
      const pdfUrl = await this.getPdfDownloadUrl();
      
      // Create a new MinerUPdfConvertor instance
      const pdfConvertor = createMinerUConvertorFromEnv();
      
      // Convert the PDF to markdown using the MinerUPdfConvertor
      const conversionResult = await pdfConvertor.convertPdfToMarkdown(pdfUrl);
      
      if (!conversionResult.success) {
        throw new Error(`Failed to convert PDF to markdown: ${conversionResult.error}`);
      }

      // Extract markdown content from the conversion result
      let markdownContent = '';
      
      if (typeof conversionResult.data === 'string') {
        markdownContent = conversionResult.data;
      } else if (conversionResult.data && conversionResult.data.markdown) {
        markdownContent = conversionResult.data.markdown;
      } else if (conversionResult.data && conversionResult.data.content) {
        markdownContent = conversionResult.data.content;
      } else {
        throw new Error('No markdown content found in conversion result');
      }

      // Save the markdown content to storage
      await this.storage.saveMarkdown(this.metadata.id!, markdownContent);
      
      // Update the metadata with the markdown content and timestamp
      await this.updateMetadata({
        markdownContent,
        markdownUpdatedDate: new Date()
      });

      console.log(`Successfully extracted and saved markdown for item: ${this.metadata.id}`);
    } catch (error) {
      console.error(`Error extracting markdown for item ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Process this item's markdown content into chunks and generate embeddings
   * @param chunkingStrategy The chunking strategy to use ('h1' or 'paragraph')
   * @param forceReprocess Whether to force re-processing even if chunks already exist
   */
  async chunkEmbed(
    chunkingStrategy: 'h1' | 'paragraph' = 'h1',
    forceReprocess: boolean = false
  ): Promise<BookChunk[]> {
    try {
      // Check if this item has markdown content
      const markdownContent = await this.getMarkdown();
      if (!markdownContent) {
        throw new Error('No markdown content found for this item. Please extract markdown first.');
      }

      console.log(`Chunking and embedding content for item: ${this.metadata.id} using strategy: ${chunkingStrategy}`);

      // Check if chunks already exist and forceReprocess is false
      if (!forceReprocess) {
        const existingChunks = await this.storage.getChunksByItemId(this.metadata.id!);
        if (existingChunks.length > 0) {
          console.log(`Item ${this.metadata.id} already has ${existingChunks.length} chunks. Use forceReprocess=true to override.`);
          return existingChunks;
        }
      }

      // Delete existing chunks for this item
      await this.storage.deleteChunksByItemId(this.metadata.id!);

      // Import chunking functions
      const { h1Chunking, paragraphChunking } = await import('../lib/chunking/chunkingTool.js');
      const { embeddingService } = await import('../lib/embedding/embedding.js');

      // Chunk the markdown content
      let chunkResults: any[];
      if (chunkingStrategy === 'h1') {
        chunkResults = h1Chunking(markdownContent);
      } else {
        chunkResults = paragraphChunking(markdownContent);
      }

      if (chunkResults.length === 0) {
        console.warn(`No chunks generated for item: ${this.metadata.id}`);
        return [];
      }

      console.log(`Generated ${chunkResults.length} chunks for item: ${this.metadata.id}`);

      // Prepare chunks for storage
      const chunks: BookChunk[] = [];
      const chunkTexts: string[] = [];

      for (let i = 0; i < chunkResults.length; i++) {
        const chunkResult = chunkResults[i];
        
        let title: string;
        let content: string;
        
        if (typeof chunkResult === 'string') {
          // Paragraph chunking
          title = `Paragraph ${i + 1}`;
          content = chunkResult;
        } else {
          // H1 chunking
          title = chunkResult.title;
          content = chunkResult.content;
        }

        const chunk: BookChunk = {
          id: IdUtils.generateId(),
          itemId: this.metadata.id!,
          title,
          content,
          index: i,
          metadata: {
            chunkType: chunkingStrategy,
            wordCount: content.split(/\s+/).length,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        chunks.push(chunk);
        chunkTexts.push(content);
      }

      // Generate embeddings for all chunks
      console.log(`Generating embeddings for ${chunkTexts.length} chunks`);
      const embeddings = await embeddingService.embedBatch(chunkTexts);
      
      // Assign embeddings to chunks
      for (let i = 0; i < chunks.length; i++) {
        if (embeddings[i]) {
          chunks[i].embedding = embeddings[i] || undefined;
        }
      }

      // Save chunks to storage
      await this.storage.batchSaveChunks(chunks);
      console.log(`Successfully saved ${chunks.length} chunks to storage for item: ${this.metadata.id}`);

      return chunks;
    } catch (error) {
      console.error(`Error processing chunks for item ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Get all chunks for this item
   */
  async getChunks(): Promise<BookChunk[]> {
    return await this.storage.getChunksByItemId(this.metadata.id!);
  }

  /**
   * Search within this item's chunks
   * @param query The search query
   * @param limit Maximum number of results
   */
  async searchInChunks(query: string, limit: number = 10): Promise<BookChunk[]> {
    return await this.storage.searchChunks({
      query,
      itemId: this.metadata.id!,
      limit,
    });
  }

  /**
   * Find similar chunks within this item
   * @param queryVector The query vector
   * @param limit Maximum number of results
   * @param threshold Similarity threshold
   */
  async findSimilarInChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<Array<BookChunk & { similarity: number }>> {
    return await this.storage.findSimilarChunks(queryVector, limit, threshold, [this.metadata.id!]);
  }

  /**
   * Delete all chunks for this item
   */
  async deleteChunks(): Promise<number> {
    return await this.storage.deleteChunksByItemId(this.metadata.id!);
  }

  /**
   * Get chunk statistics for this item
   */
  async getChunkStats(): Promise<{
    totalChunks: number;
    totalWords: number;
    averageWordsPerChunk: number;
    chunkType: string | null;
    lastUpdated: Date | null;
  }> {
    const chunks = await this.getChunks();
    
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalWords: 0,
        averageWordsPerChunk: 0,
        chunkType: null,
        lastUpdated: null,
      };
    }

    const totalWords = chunks.reduce((sum, chunk) =>
      sum + (chunk.metadata?.wordCount || chunk.content.split(/\s+/).length), 0
    );

    const chunkTypes = new Set(chunks.map(chunk => chunk.metadata?.chunkType).filter(Boolean));
    const lastUpdated = new Date(Math.max(...chunks.map(chunk => chunk.updatedAt.getTime())));

    return {
      totalChunks: chunks.length,
      totalWords,
      averageWordsPerChunk: Math.round(totalWords / chunks.length),
      chunkType: chunkTypes.size > 0 ? Array.from(chunkTypes).join(', ') : null,
      lastUpdated,
    };
  }

  /**
   * Advanced chunk embedding using the new unified chunking interface
   * @param chunkingStrategy The chunking strategy name
   * @param forceReprocess Whether to force reprocessing existing chunks
   * @param chunkingConfig Optional chunking configuration
   * @returns Array of created chunks
   */
  async chunkEmbedAdvanced(
    chunkingStrategy: string = 'h1',
    forceReprocess: boolean = false,
    chunkingConfig?: any,
  ): Promise<BookChunk[]> {
    try {
      // Check if markdown content exists
      if (!this.metadata.markdownContent) {
        throw new Error(`No markdown content available for item: ${this.metadata.id}. Please extract markdown first.`);
      }

      // Check if chunks already exist and forceReprocess is false
      if (!forceReprocess) {
        const existingChunks = await this.getChunks();
        if (existingChunks.length > 0) {
          console.log(`Chunks already exist for item: ${this.metadata.id}, returning existing chunks`);
          return existingChunks;
        }
      }

      // Delete existing chunks if force reprocessing
      if (forceReprocess) {
        await this.deleteChunks();
      }

      console.log(`Processing chunks for item: ${this.metadata.id} using strategy: ${chunkingStrategy}`);

      // Use the new unified chunking interface
      const chunkResults = chunkTextAdvanced(
        this.metadata.markdownContent,
        chunkingStrategy,
        chunkingConfig
      );

      if (!chunkResults || chunkResults.length === 0) {
        console.warn(`No chunks generated for item: ${this.metadata.id}`);
        return [];
      }

      console.log(`Generated ${chunkResults.length} chunks for item: ${this.metadata.id}`);

      // Prepare chunks for storage
      const chunks: BookChunk[] = [];
      const chunkTexts: string[] = [];

      for (let i = 0; i < chunkResults.length; i++) {
        const chunkResult = chunkResults[i];
        
        const title = chunkResult.title || `Chunk ${i + 1}`;
        const content = chunkResult.content;

        const chunk: BookChunk = {
          id: IdUtils.generateId(),
          itemId: this.metadata.id!,
          title,
          content,
          index: i,
          metadata: {
            chunkType: chunkingStrategy,
            wordCount: content.split(/\s+/).length,
            chunkingConfig: chunkingConfig ? JSON.stringify(chunkingConfig) : undefined,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        chunks.push(chunk);
        chunkTexts.push(content);
      }

      // Generate embeddings for all chunks
      console.log(`Generating embeddings for ${chunkTexts.length} chunks`);
      const embeddings = await embeddingService.embedBatch(chunkTexts);
      
      // Assign embeddings to chunks
      for (let i = 0; i < chunks.length; i++) {
        if (embeddings[i]) {
          chunks[i].embedding = embeddings[i] || undefined;
        }
      }

      // Save chunks to storage
      await this.storage.batchSaveChunks(chunks);
      console.log(`Successfully saved ${chunks.length} chunks to storage for item: ${this.metadata.id}`);

      return chunks;
    } catch (error) {
      console.error(`Error processing chunks for item ${this.metadata.id}:`, error);
      throw error;
    }
  }

  /**
   * Get available chunking strategies
   * @returns Array of available strategies
   */
  getAvailableChunkingStrategies(): Array<{
    name: string;
    description: string;
    version: string;
  }> {
    return getAvailableStrategies();
  }

  /**
   * Get the default configuration for a specific chunking strategy
   * @param strategyName The strategy name
   * @returns Default configuration
   */
  getChunkingStrategyDefaultConfig(strategyName: string): any {
    // Import dynamically to avoid circular dependencies
    const { getStrategyDefaultConfig } = require('../lib/chunking/chunkingToolV2');
    return getStrategyDefaultConfig(strategyName);
  }
}

interface AbstractPdf {
  id: string;
  name: string;
  s3Key: string;
  url: string;
  fileSize?: number;
  createDate: Date;
}

export abstract class AbstractLibraryStorage {
  abstract uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf>;
  abstract uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf>;
  abstract getPdfDownloadUrl(s3Key: string): Promise<string>;
  abstract getPdf(s3Key: string): Promise<Buffer>;
  abstract saveMetadata(
    metadata: BookMetadata,
  ): Promise<BookMetadata & { id: string }>;
  abstract getMetadata(id: string): Promise<BookMetadata | null>;
  abstract getMetadataByHash(contentHash: string): Promise<BookMetadata | null>;
  abstract updateMetadata(metadata: BookMetadata): Promise<void>;
  abstract searchMetadata(filter: SearchFilter): Promise<BookMetadata[]>;
  abstract saveCollection(collection: Collection): Promise<Collection>;
  abstract getCollections(): Promise<Collection[]>;
  abstract addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void>;
  abstract removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void>;
  abstract saveCitation(citation: Citation): Promise<Citation>;
  abstract getCitations(itemId: string): Promise<Citation[]>;
  abstract saveMarkdown(itemId: string, markdownContent: string): Promise<void>;
  abstract getMarkdown(itemId: string): Promise<string | null>;
  abstract deleteMetadata(id: string): Promise<boolean>;
  abstract deleteCollection(id: string): Promise<boolean>;
  abstract deleteCitations(itemId: string): Promise<boolean>;
  
  // Chunk-related methods
  abstract saveChunk(chunk: BookChunk): Promise<BookChunk>;
  abstract getChunk(chunkId: string): Promise<BookChunk | null>;
  abstract getChunksByItemId(itemId: string): Promise<BookChunk[]>;
  abstract updateChunk(chunk: BookChunk): Promise<void>;
  abstract deleteChunk(chunkId: string): Promise<boolean>;
  abstract deleteChunksByItemId(itemId: string): Promise<number>;
  abstract searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]>;
  abstract findSimilarChunks(
    queryVector: number[],
    limit?: number,
    threshold?: number,
    itemIds?: string[],
  ): Promise<Array<BookChunk & { similarity: number }>>;
  abstract batchSaveChunks(chunks: BookChunk[]): Promise<void>;
}

export class S3MongoLibraryStorage extends AbstractLibraryStorage {
  private pdfCollection = 'library_pdfs';
  private metadataCollection = 'library_metadata';
  private collectionsCollection = 'library_collections';
  private citationsCollection = 'library_citations';
  private chunksCollection = 'library_chunks';

  constructor() {
    super();
    this.ensureIndexes();
  }

  /**
   * Ensure database indexes for better performance
   */
  private async ensureIndexes(): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.metadataCollection);

      // Create index on contentHash for fast duplicate detection
      await collection.createIndex(
        { contentHash: 1 },
        { unique: false, sparse: true },
      );

      // Create text index on title for text search
      await collection.createIndex({ title: 'text' });

      // Create index on authors.lastName for author-based searches (using wildcard for array)
      await collection.createIndex({ 'authors.lastName': 1 });

      // Create compound index on title and publicationYear for common searches
      await collection.createIndex({ title: 1, publicationYear: -1 });

      // Create indexes for chunks collection
      const chunksCollection = db.collection(this.chunksCollection);
      await chunksCollection.createIndex({ itemId: 1 });
      await chunksCollection.createIndex({ 'metadata.chunkType': 1 });
      await chunksCollection.createIndex({ itemId: 1, index: 1 });
      await chunksCollection.createIndex({ content: 'text' });

      console.log('Library storage indexes created successfully');
    } catch (error) {
      console.warn('Failed to create library storage indexes:', error);
    }
  }

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadToS3(pdfData, s3Key, 'application/pdf');

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date(),
    };
    const { db } = await connectToDatabase();
    // Save to database
    await db.collection(this.pdfCollection).insertOne(pdfInfo);
    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fileName = path.basename(pdfPath);
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadPdfFromPath(pdfPath, s3Key);

    const stats = fs.statSync(pdfPath);

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date(),
    };

    // Save to database
    const { db } = await connectToDatabase();
    await db.collection(this.pdfCollection).insertOne(pdfInfo);
    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    // In a real implementation, you would generate a presigned URL
    // For now, return the stored URL
    const { db } = await connectToDatabase();
    const pdfInfo = await db.collection(this.pdfCollection).findOne({ s3Key });
    if (!pdfInfo) {
      throw new Error(`PDF with S3 key ${s3Key} not found`);
    }

    const url = await getSignedUrlForDownload(
      process.env.PDF_OSS_BUCKET_NAME as string,
      s3Key,
    );
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(
    metadata: BookMetadata,
  ): Promise<BookMetadata & { id: string }> {
    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: metadata.id }, { $set: metadata }, { upsert: true });

    return metadata as BookMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection<BookMetadata>(this.metadataCollection)
      .findOne({ id });
    return (metadata as BookMetadata) || null;
  }

  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection<BookMetadata>(this.metadataCollection)
      .findOne({ contentHash });
    return (metadata as BookMetadata) || null;
  }

  async updateMetadata(metadata: BookMetadata): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: metadata.id }, { $set: metadata });
  }

  async searchMetadata(filter: SearchFilter): Promise<BookMetadata[]> {
    const query: any = {};

    if (filter.query) {
      query.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { abstract: { $regex: filter.query, $options: 'i' } },
        { notes: { $regex: filter.query, $options: 'i' } },
        { contentHash: { $regex: filter.query, $options: 'i' } },
      ];
    }

    if (filter.tags && filter.tags.length > 0) {
      query.tags = { $in: filter.tags };
    }

    if (filter.collections && filter.collections.length > 0) {
      query.collections = { $in: filter.collections };
    }

    if (filter.authors && filter.authors.length > 0) {
      query['authors.lastName'] = { $in: filter.authors };
    }

    if (filter.dateRange) {
      query.publicationYear = {
        $gte: filter.dateRange.start.getFullYear(),
        $lte: filter.dateRange.end.getFullYear(),
      };
    }

    if (filter.fileType && filter.fileType.length > 0) {
      query.fileType = { $in: filter.fileType };
    }
    const { db } = await connectToDatabase();
    const results = await db
      .collection<BookMetadata>(this.metadataCollection)
      .find(query)
      .toArray();
    return results as BookMetadata[];
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    if (!collection.id) {
      collection.id = IdUtils.generateId();
    }
    const { db } = await connectToDatabase();
    await db
      .collection(this.collectionsCollection)
      .updateOne({ id: collection.id }, { $set: collection }, { upsert: true });

    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    const { db } = await connectToDatabase();
    const results = await db
      .collection<Collection>(this.collectionsCollection)
      .find({})
      .toArray();
    return results as Collection[];
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: itemId }, { $addToSet: { collections: collectionId } });
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    const { db } = await connectToDatabase();
    await db.collection(this.metadataCollection).updateOne({ id: itemId }, {
      $pull: { collections: collectionId },
    } as any);
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.citationsCollection)
      .updateOne({ id: citation.id }, { $set: citation }, { upsert: true });

    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    const { db } = await connectToDatabase();
    const results = await db
      .collection<Citation>(this.citationsCollection)
      .find({ itemId })
      .toArray();
    return results as Citation[];
  }

  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne(
        { id: itemId },
        { $set: { markdownContent, markdownUpdatedDate: new Date() } },
      );
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection(this.metadataCollection)
      .findOne({ id: itemId }, { projection: { markdownContent: 1 } });
    return metadata?.markdownContent || null;
  }

  async deleteMetadata(id: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.metadataCollection)
      .deleteOne({ id });

    // Also delete associated citations
    await this.deleteCitations(id);

    return result.deletedCount > 0;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const { db } = await connectToDatabase();

    // First, remove this collection from all items
    await db
      .collection(this.metadataCollection)
      .updateMany({ collections: id }, {
        $pull: { collections: { $in: [id] } },
      } as any);

    // Then delete the collection
    const result = await db
      .collection(this.collectionsCollection)
      .deleteOne({ id });

    return result.deletedCount > 0;
  }

  async deleteCitations(itemId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.citationsCollection)
      .deleteMany({ itemId });

    return result.deletedCount > 0;
  }

  // Chunk-related methods implementation (MongoDB version)
  async saveChunk(chunk: BookChunk): Promise<BookChunk> {
    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    const { db } = await connectToDatabase();
    await db
      .collection(this.chunksCollection)
      .updateOne({ id: chunk.id }, { $set: chunk }, { upsert: true });

    return chunk;
  }

  async getChunk(chunkId: string): Promise<BookChunk | null> {
    const { db } = await connectToDatabase();
    const chunk = await db
      .collection<BookChunk>(this.chunksCollection)
      .findOne({ id: chunkId });
    return chunk || null;
  }

  async getChunksByItemId(itemId: string): Promise<BookChunk[]> {
    const { db } = await connectToDatabase();
    const chunks = await db
      .collection<BookChunk>(this.chunksCollection)
      .find({ itemId })
      .sort({ index: 1 })
      .toArray();
    return chunks;
  }

  async updateChunk(chunk: BookChunk): Promise<void> {
    const { db } = await connectToDatabase();
    await db.collection(this.chunksCollection).updateOne(
      { id: chunk.id },
      {
        $set: {
          ...chunk,
          updatedAt: new Date()
        }
      }
    );
  }

  async deleteChunk(chunkId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.chunksCollection)
      .deleteOne({ id: chunkId });
    return result.deletedCount > 0;
  }

  async deleteChunksByItemId(itemId: string): Promise<number> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.chunksCollection)
      .deleteMany({ itemId });
    return result.deletedCount;
  }

  async searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]> {
    const { db } = await connectToDatabase();
    const query: any = {};

    if (filter.query) {
      query.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { content: { $regex: filter.query, $options: 'i' } },
      ];
    }

    if (filter.itemId) {
      query.itemId = filter.itemId;
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      query.itemId = { $in: filter.itemIds };
    }

    if (filter.chunkType) {
      query['metadata.chunkType'] = filter.chunkType;
    }

    const chunks = await db
      .collection<BookChunk>(this.chunksCollection)
      .find(query)
      .limit(filter.limit || 100)
      .toArray();
    return chunks;
  }

  async findSimilarChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    itemIds?: string[],
  ): Promise<Array<BookChunk & { similarity: number }>> {
    // MongoDB doesn't have native vector similarity search like Elasticsearch
    // This is a simplified implementation that would need to be enhanced
    // with a proper vector search solution (e.g., MongoDB Atlas Vector Search)
    
    const query: any = {};
    if (itemIds && itemIds.length > 0) {
      query.itemId = { $in: itemIds };
    }

    const { db } = await connectToDatabase();
    const chunks = await db
      .collection<BookChunk>(this.chunksCollection)
      .find(query)
      .limit(limit)
      .toArray();

    // Calculate cosine similarity manually (this is inefficient and should be replaced with proper vector search)
    const similarChunks: Array<BookChunk & { similarity: number }> = [];
    
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      
      // Simple cosine similarity calculation
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (let i = 0; i < queryVector.length; i++) {
        dotProduct += queryVector[i] * (chunk.embedding[i] || 0);
        normA += queryVector[i] * queryVector[i];
        normB += (chunk.embedding[i] || 0) * (chunk.embedding[i] || 0);
      }
      
      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      
      if (similarity >= threshold) {
        similarChunks.push({
          ...chunk,
          similarity,
        });
      }
    }

    // Sort by similarity and limit
    similarChunks.sort((a, b) => b.similarity - a.similarity);
    return similarChunks.slice(0, limit);
  }

  async batchSaveChunks(chunks: BookChunk[]): Promise<void> {
    const { db } = await connectToDatabase();
    
    // Ensure all chunks have IDs
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
    }

    const bulkOps = chunks.map((chunk) => ({
      updateOne: {
        filter: { id: chunk.id },
        update: { $set: chunk },
        upsert: true,
      },
    }));

    await db.collection(this.chunksCollection).bulkWrite(bulkOps);
  }
}

export class S3ElasticSearchLibraryStorage extends AbstractLibraryStorage {
  private readonly metadataIndexName = 'library_metadata';
  private readonly collectionsIndexName = 'library_collections';
  private readonly citationsIndexName = 'library_citations';
  private readonly chunksIndexName = 'library_chunks';
  private client: Client;
  private isInitialized = false;
  private vectorDimensions: number;

  logger = createLoggerWithPrefix('S3ElasticSearchLibraryStorage');

  constructor(
    elasticsearchUrl: string = 'http://elasticsearch:9200',
    vectorDimensions: number = 1536,
  ) {
    super();
    this.vectorDimensions = vectorDimensions;
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
    // Don't initialize indexes in constructor to avoid blocking
    // Initialize lazily when first operation is called
  }

  /**
   * Initialize the indexes with proper mappings
   */
  private async ensureIndexes(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if Elasticsearch is available
      await this.client.ping();
      this.logger.info('Connected to Elasticsearch');

      // Initialize metadata index
      const metadataExists = await this.client.indices.exists({
        index: this.metadataIndexName,
      });

      if (!metadataExists) {
        await this.client.indices.create({
          index: this.metadataIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              authors: {
                type: 'nested',
                properties: {
                  firstName: { type: 'text' },
                  lastName: {
                    type: 'text',
                    fields: { keyword: { type: 'keyword' } },
                  },
                  middleName: { type: 'text' },
                },
              },
              abstract: { type: 'text' },
              publicationYear: { type: 'integer' },
              publisher: { type: 'text' },
              isbn: { type: 'keyword' },
              doi: { type: 'keyword' },
              url: { type: 'keyword' },
              tags: { type: 'keyword' },
              notes: { type: 'text' },
              collections: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' },
              fileType: { type: 'keyword' },
              s3Key: { type: 'keyword' },
              s3Url: { type: 'keyword' },
              fileSize: { type: 'long' },
              pageCount: { type: 'integer' },
              language: { type: 'keyword' },
              contentHash: { type: 'keyword' },
            },
          },
        } as any);
        this.logger.info(`Created metadata index: ${this.metadataIndexName}`);
      }

      // Initialize collections index
      const collectionsExists = await this.client.indices.exists({
        index: this.collectionsIndexName,
      });

      if (!collectionsExists) {
        await this.client.indices.create({
          index: this.collectionsIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: { type: 'text' },
              parentCollectionId: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(
          `Created collections index: ${this.collectionsIndexName}`,
        );
      }

      // Initialize citations index
      const citationsExists = await this.client.indices.exists({
        index: this.citationsIndexName,
      });

      if (!citationsExists) {
        await this.client.indices.create({
          index: this.citationsIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              itemId: { type: 'keyword' },
              citationStyle: { type: 'keyword' },
              citationText: { type: 'text' },
              dateGenerated: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(`Created citations index: ${this.citationsIndexName}`);
      }

      // Initialize chunks index
      const chunksExists = await this.client.indices.exists({
        index: this.chunksIndexName,
      });

      if (!chunksExists) {
        await this.client.indices.create({
          index: this.chunksIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              itemId: { type: 'keyword' },
              title: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              content: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              index: { type: 'integer' },
              embedding: {
                type: 'dense_vector',
                dims: this.vectorDimensions,
              },
              metadata: {
                type: 'object',
                properties: {
                  chunkType: { type: 'keyword' },
                  startPosition: { type: 'integer' },
                  endPosition: { type: 'integer' },
                  wordCount: { type: 'integer' },
                },
              },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(`Created chunks index: ${this.chunksIndexName}`);
      }
    } catch (error: any) {
      if (
        error?.meta?.body?.error?.type === 'resource_already_exists_exception'
      ) {
        this.logger.info('Indexes already exist, continuing');
        this.isInitialized = true;
        return;
      }
      if (error.meta?.statusCode === 0 || error.code === 'ECONNREFUSED') {
        this.logger.error(
          'Elasticsearch is not available. Please ensure Elasticsearch is running.',
        );
        throw new Error(
          'Elasticsearch is not available. Please check your configuration and ensure Elasticsearch is running.',
        );
      }
      this.logger.error('Failed to initialize indexes:', error);
      throw error;
    }
  }

  /**
   * Ensure indexes are initialized before performing operations
   */
  private async checkInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.ensureIndexes();
      this.isInitialized = true;
    }
  }

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadToS3(pdfData, s3Key, 'application/pdf');

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date(),
    };

    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fileName = path.basename(pdfPath);
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadPdfFromPath(pdfPath, s3Key);

    const stats = fs.statSync(pdfPath);

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date(),
    };

    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    const url = await getSignedUrlForDownload(
      process.env.PDF_OSS_BUCKET_NAME as string,
      s3Key,
    );
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(
    metadata: BookMetadata,
  ): Promise<BookMetadata & { id: string }> {
    await this.checkInitialized();

    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.metadataIndexName,
      id: metadata.id,
      body: metadata,
      refresh: true, // Refresh index to make document immediately available
    } as any);

    return metadata as BookMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.metadataIndexName,
        id: id,
      });

      if (result.found) {
        return result._source as BookMetadata;
      }
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query: {
            term: {
              contentHash: contentHash,
            },
          },
        },
      } as any);

      const hits = result.hits.hits;
      if (hits.length > 0) {
        return hits[0]._source as BookMetadata;
      }
      return null;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return null;
      }
      throw error;
    }
  }

  async updateMetadata(metadata: BookMetadata): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.metadataIndexName,
      id: metadata.id!,
      body: {
        doc: metadata,
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async searchMetadata(filter: SearchFilter): Promise<BookMetadata[]> {
    await this.checkInitialized();

    const query: any = {};

    if (filter.query) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        multi_match: {
          query: filter.query,
          fields: ['title', 'abstract', 'notes'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (filter.tags && filter.tags.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          tags: filter.tags,
        },
      });
    }

    if (filter.collections && filter.collections.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          collections: filter.collections,
        },
      });
    }

    if (filter.authors && filter.authors.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        nested: {
          path: 'authors',
          query: {
            terms: {
              'authors.lastName': filter.authors,
            },
          },
        },
      });
    }

    if (filter.dateRange) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        range: {
          publicationYear: {
            gte: filter.dateRange.start.getFullYear(),
            lte: filter.dateRange.end.getFullYear(),
          },
        },
      });
    }

    if (filter.fileType && filter.fileType.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          fileType: filter.fileType,
        },
      });
    }

    // If no filters specified, match all
    if (!query.bool) {
      query.match_all = {};
    }

    try {
      const result = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query,
          size: 10000, // Adjust based on expected results
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as BookMetadata);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    await this.checkInitialized();

    if (!collection.id) {
      collection.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.collectionsIndexName,
      id: collection.id,
      body: collection,
      refresh: true, // Refresh index to make collection immediately available
    } as any);

    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.collectionsIndexName,
        body: {
          query: {
            match_all: {},
          },
          size: 10000,
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as Collection);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.checkInitialized();

    const metadata = await this.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    if (!metadata.collections.includes(collectionId)) {
      metadata.collections.push(collectionId);
      await this.updateMetadata(metadata);
    }
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.checkInitialized();

    const metadata = await this.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    const index = metadata.collections.indexOf(collectionId);
    if (index > -1) {
      metadata.collections.splice(index, 1);
      await this.updateMetadata(metadata);
    }
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    await this.checkInitialized();

    await this.client.index({
      index: this.citationsIndexName,
      id: citation.id,
      body: citation,
      refresh: true, // Refresh index to make citation immediately available
    } as any);

    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.citationsIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as Citation);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.metadataIndexName,
      id: itemId,
      body: {
        doc: {
          markdownContent,
          markdownUpdatedDate: new Date(),
        },
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.metadataIndexName,
        id: itemId,
        _source: ['markdownContent'],
      });

      if (result.found) {
        const source = result._source as any;
        return source?.markdownContent || null;
      }
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteMetadata(id: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      // Delete the metadata document
      const result = await this.client.delete({
        index: this.metadataIndexName,
        id: id,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      // Also delete associated citations
      await this.deleteCitations(id);

      return result.result === 'deleted';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Document not found
      }
      throw error;
    }
  }

  async deleteCollection(id: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      // First, remove this collection from all items
      const searchResult = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query: {
            term: {
              collections: id,
            },
          },
          size: 10000, // Adjust based on expected number of items
        },
      } as any);

      // Update each item to remove the collection
      for (const hit of searchResult.hits.hits) {
        const metadata = hit._source as BookMetadata;
        const index = metadata.collections.indexOf(id);
        if (index > -1) {
          metadata.collections.splice(index, 1);
          await this.updateMetadata(metadata);
        }
      }

      // Then delete the collection
      const result = await this.client.delete({
        index: this.collectionsIndexName,
        id: id,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return result.result === 'deleted';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Collection not found
      }
      throw error;
    }
  }

  async deleteCitations(itemId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.deleteByQuery({
        index: this.citationsIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return (result.deleted || 0) > 0;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return false; // Index not found
      }
      throw error;
    }
  }

  // Chunk-related methods implementation
  async saveChunk(chunk: BookChunk): Promise<BookChunk> {
    await this.checkInitialized();

    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.chunksIndexName,
      id: chunk.id,
      body: chunk,
      refresh: true, // Refresh index to make chunk immediately available
    } as any);

    return chunk;
  }

  async getChunk(chunkId: string): Promise<BookChunk | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.chunksIndexName,
        id: chunkId,
      });

      if (result.found) {
        return result._source as BookChunk;
      }
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getChunksByItemId(itemId: string): Promise<BookChunk[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.chunksIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
          sort: [
            { index: { order: 'asc' } },
          ],
          size: 10000, // Adjust based on expected number of chunks
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as BookChunk);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async updateChunk(chunk: BookChunk): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.chunksIndexName,
      id: chunk.id!,
      body: {
        doc: {
          ...chunk,
          updatedAt: new Date(),
        },
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async deleteChunk(chunkId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.delete({
        index: this.chunksIndexName,
        id: chunkId,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return result.result === 'deleted';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Chunk not found
      }
      throw error;
    }
  }

  async deleteChunksByItemId(itemId: string): Promise<number> {
    await this.checkInitialized();

    try {
      const result = await this.client.deleteByQuery({
        index: this.chunksIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return (result.deleted || 0);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return 0; // Index not found
      }
      throw error;
    }
  }

  async searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]> {
    await this.checkInitialized();

    const query: any = {};

    if (filter.query) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        multi_match: {
          query: filter.query,
          fields: ['title', 'content'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (filter.itemId) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        term: {
          itemId: filter.itemId,
        },
      });
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          itemId: filter.itemIds,
        },
      });
    }

    if (filter.chunkType) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        term: {
          'metadata.chunkType': filter.chunkType,
        },
      });
    }

    // If no filters specified, match all
    if (!query.bool) {
      query.match_all = {};
    }

    try {
      const result = await this.client.search({
        index: this.chunksIndexName,
        body: {
          query,
          size: filter.limit || 100, // Adjust based on expected results
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as BookChunk);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async findSimilarChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    itemIds?: string[],
  ): Promise<Array<BookChunk & { similarity: number }>> {
    await this.checkInitialized();

    // Validate vector dimensions
    if (queryVector.length !== this.vectorDimensions) {
      throw new Error(
        `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${queryVector.length}`,
      );
    }

    const query: any = {
      script_score: {
        query: {
          exists: {
            field: 'embedding',
          },
        },
        script: {
          source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
          params: {
            query_vector: queryVector,
          },
        },
      },
    };

    // Filter by items if specified
    if (itemIds && itemIds.length > 0) {
      query.script_score.query = {
        bool: {
          must: [
            {
              terms: {
                itemId: itemIds,
              },
            },
          ],
        },
      };
    }

    try {
      const result = await this.client.search({
        index: this.chunksIndexName,
        body: {
          query,
          size: limit,
          min_score: threshold,
        } as any,
      });

      const hits = result.hits.hits;
      return hits
        .map((hit) => {
          const { _source, _score } = hit;
          const chunk = _source as BookChunk;
          const similarity = _score || 0;

          return {
            ...chunk,
            similarity,
          };
        })
        .filter((chunk) => chunk.similarity >= threshold);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async batchSaveChunks(chunks: BookChunk[]): Promise<void> {
    await this.checkInitialized();

    // Ensure all chunks have IDs
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
    }

    // Validate all embeddings have correct dimensions
    for (const chunk of chunks) {
      if (chunk.embedding && chunk.embedding.length !== this.vectorDimensions) {
        throw new Error(
          `Vector dimensions mismatch for chunk ID ${chunk.id}. Expected: ${this.vectorDimensions}, Got: ${chunk.embedding.length}`,
        );
      }
    }

    const body = chunks.flatMap((chunk) => [
      { index: { _index: this.chunksIndexName, _id: chunk.id } },
      chunk,
    ]);

    await this.client.bulk({
      body,
      refresh: true, // Refresh index to make chunks immediately available
    });

    this.logger.info(`Batch saved ${chunks.length} chunks`);
  }
}

export interface BookChunk {
  id: string;
  itemId: string; // Reference to the parent book item
  title: string;
  content: string;
  index: number; // Position in the document
  embedding?: number[]; // Vector embedding of the content
  metadata?: {
    // Additional metadata about the chunk
    chunkType?: string; // Changed to string to support any chunking strategy
    startPosition?: number;
    endPosition?: number;
    wordCount?: number;
    chunkingConfig?: string; // JSON string of chunking configuration
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkSearchFilter {
  query?: string;
  itemId?: string;
  itemIds?: string[];
  chunkType?: string; // Changed to string to support any chunking strategy
  similarityThreshold?: number;
  limit?: number;
}

export abstract class AbstractTextSplitter {}
