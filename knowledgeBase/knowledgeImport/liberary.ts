
import { uploadToS3, uploadPdfFromPath, getSignedUploadUrl, getSignedUrlForDownload } from '../lib/s3Service/S3Service';
import { connectToDatabase } from '../lib/mongodb';
import { ObjectId } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from '../lib/logger';

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
      authors: metadata.authors?.map(author =>
        `${author.lastName},${author.firstName}${author.middleName ? ',' + author.middleName : ''}`
      ).sort().join('|') || '',
      abstract: metadata.abstract || '',
      publicationYear: metadata.publicationYear || 0,
      publisher: metadata.publisher || '',
      doi: metadata.doi || '',
      isbn: metadata.isbn || ''
    };
    
    const hashString = JSON.stringify(hashInput);
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }
}

/**
 * Manage overall storage & retrieve of books/literatures/articles
 */
export default class Library {
  constructor(private storage: AbstractLibraryStorage) {}

  /**
   * Store a PDF file from local path
   */
  async storePdf(pdfPath: string, metadata: Partial<BookMetadata>): Promise<LibraryItem> {
    // Generate hash from file content
    const contentHash = await HashUtils.generateHashFromPath(pdfPath);
    
    // Check if item with same hash already exists
    const existingItem = await this.storage.getMetadataByHash(contentHash);
    if (existingItem) {
      console.log(`Item with same content already exists (ID: ${existingItem.id}), returning existing item`);
      return new LibraryItem(existingItem, this.storage);
    }
    
    const pdfInfo = await this.storage.uploadPdfFromPath(pdfPath);
    const fullMetadata: BookMetadata = {
      ...metadata,
      title: metadata.title || path.basename(pdfPath, '.pdf'),
      s3Key: pdfInfo.s3Key,
      s3Url: pdfInfo.url,
      fileSize: pdfInfo.fileSize,
      contentHash,
      dateAdded: new Date(),
      dateModified: new Date(),
      tags: metadata.tags || [],
      collections: metadata.collections || [],
      authors: metadata.authors || [],
      fileType: 'pdf'
    };
    
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    return new LibraryItem(savedMetadata, this.storage);
  }

  /**
   * Store a PDF from buffer
   */
  async storePdfFromBuffer(pdfBuffer: Buffer, fileName: string, metadata: Partial<BookMetadata>): Promise<LibraryItem> {
    // Generate hash from file content
    const contentHash = HashUtils.generateHashFromBuffer(pdfBuffer);
    
    // Check if item with same hash already exists
    const existingItem = await this.storage.getMetadataByHash(contentHash);
    if (existingItem) {
      console.log(`Item with same content already exists (ID: ${existingItem.id}), returning existing item`);
      return new LibraryItem(existingItem, this.storage);
    }
    
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
      fileType: 'pdf'
    };
    
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    return new LibraryItem(savedMetadata, this.storage);
  }

  /**
   * Store an article with metadata
   */
  async storeArticle(metadata: Partial<BookMetadata>): Promise<LibraryItem> {
    // Generate hash from metadata fields
    const contentHash = HashUtils.generateHashFromMetadata(metadata);
    
    // Check if item with same hash already exists
    const existingItem = await this.storage.getMetadataByHash(contentHash);
    if (existingItem) {
      console.log(`Article with same content already exists (ID: ${existingItem.id}), returning existing item`);
      return new LibraryItem(existingItem, this.storage);
    }
    
    const fullMetadata: BookMetadata = {
      ...metadata,
      title: metadata.title || 'Untitled Article',
      contentHash,
      dateAdded: new Date(),
      dateModified: new Date(),
      tags: metadata.tags || [],
      collections: metadata.collections || [],
      authors: metadata.authors || [],
      fileType: 'article'
    };
    
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    return new LibraryItem(savedMetadata, this.storage);
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
    return metadataList.map(metadata => new LibraryItem(metadata, this.storage));
  }

  /**
   * Create a new collection
   */
  async createCollection(name: string, description?: string, parentCollectionId?: string): Promise<Collection> {
    const collection: Collection = {
      name,
      description,
      parentCollectionId,
      dateAdded: new Date(),
      dateModified: new Date()
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
  async addItemToCollection(itemId: string, collectionId: string): Promise<void> {
    await this.storage.addItemToCollection(itemId, collectionId);
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(itemId: string, collectionId: string): Promise<void> {
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
      id: new ObjectId().toString(),
      itemId,
      citationStyle: style,
      citationText,
      dateGenerated: new Date()
    };
    
    await this.storage.saveCitation(citation);
    return citation;
  }

  private formatCitation(metadata: BookMetadata, style: string): string {
    const authors = metadata.authors.map(author =>
      `${author.lastName}, ${author.firstName}${author.middleName ? ' ' + author.middleName[0] + '.' : ''}`
    ).join(', ');
    
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

export class LibraryItem {
  constructor(public metadata: BookMetadata, private storage: AbstractLibraryStorage) {}

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
    // This would integrate with a PDF to markdown converter if PDF is available
    // For now, return a placeholder
    return `# ${this.metadata.title}\n\n${this.metadata.abstract || ''}`;
  }

  /**
   * Get JSON representation of the item
   */
  async getJSON(): Promise<BookMetadata> {
    return this.metadata;
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
  abstract uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf>
  abstract uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf>
  abstract getPdfDownloadUrl(s3Key: string): Promise<string>
  abstract getPdf(s3Key: string): Promise<Buffer>
  abstract saveMetadata(metadata: BookMetadata): Promise<BookMetadata>
  abstract getMetadata(id: string): Promise<BookMetadata | null>
  abstract getMetadataByHash(contentHash: string): Promise<BookMetadata | null>
  abstract updateMetadata(metadata: BookMetadata): Promise<void>
  abstract searchMetadata(filter: SearchFilter): Promise<BookMetadata[]>
  abstract saveCollection(collection: Collection): Promise<Collection>
  abstract getCollections(): Promise<Collection[]>
  abstract addItemToCollection(itemId: string, collectionId: string): Promise<void>
  abstract removeItemFromCollection(itemId: string, collectionId: string): Promise<void>
  abstract saveCitation(citation: Citation): Promise<Citation>
  abstract getCitations(itemId: string): Promise<Citation[]>
}

export class S3MongoLibraryStorage extends AbstractLibraryStorage {
  private pdfCollection = 'library_pdfs';
  private metadataCollection = 'library_metadata';
  private collectionsCollection = 'library_collections';
  private citationsCollection = 'library_citations';

  constructor() {
    super();
    this.ensureIndexes();
  }

  /**
   * Ensure database indexes for better performance
   */
  private async ensureIndexes(): Promise<void> {
    try {
      const {db} = await connectToDatabase();
      const collection = db.collection(this.metadataCollection);
      
      // Create index on contentHash for fast duplicate detection
      await collection.createIndex({ contentHash: 1 }, { unique: false, sparse: true });
      
      // Create text index on title for text search
      await collection.createIndex({ title: 'text' });
      
      // Create index on authors.lastName for author-based searches (using wildcard for array)
      await collection.createIndex({ 'authors.lastName': 1 });
      
      // Create compound index on title and publicationYear for common searches
      await collection.createIndex({ title: 1, publicationYear: -1 });
      
      console.log('Library storage indexes created successfully');
    } catch (error) {
      console.warn('Failed to create library storage indexes:', error);
    }
  }


  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadToS3(pdfData, s3Key, 'application/pdf');
    
    const pdfInfo: AbstractPdf = {
      id: new ObjectId().toString(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date()
    };
    const {db} = await connectToDatabase()
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
      id: new ObjectId().toString(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date()
    };
    
    // Save to database
    const {db} = await connectToDatabase()
    await db.collection(this.pdfCollection).insertOne(pdfInfo);
    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    // In a real implementation, you would generate a presigned URL
    // For now, return the stored URL
    const {db} = await connectToDatabase()
    const pdfInfo = await db.collection(this.pdfCollection).findOne({ s3Key });
    if (!pdfInfo) {
      throw new Error(`PDF with S3 key ${s3Key} not found`);
    }

    const url = await getSignedUrlForDownload(process.env.PDF_OSS_BUCKET_NAME as string, s3Key)
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(metadata: BookMetadata): Promise<BookMetadata> {
    if (!metadata.id) {
      metadata.id = new ObjectId().toString();
    }
    const {db} = await connectToDatabase()
    await db.collection(this.metadataCollection).updateOne(
      { id: metadata.id },
      { $set: metadata },
      { upsert: true }
    );
    
    return metadata;
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    const {db} = await connectToDatabase()
    const metadata = await db.collection<BookMetadata>(this.metadataCollection).findOne({ id });
    return metadata as BookMetadata || null;
  }

  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> {
    const {db} = await connectToDatabase()
    const metadata = await db.collection<BookMetadata>(this.metadataCollection).findOne({ contentHash });
    return metadata as BookMetadata || null;
  }

  async updateMetadata(metadata: BookMetadata): Promise<void> {
    const {db} = await connectToDatabase()
    await db.collection(this.metadataCollection).updateOne(
      { id: metadata.id },
      { $set: metadata }
    );
  }

  async searchMetadata(filter: SearchFilter): Promise<BookMetadata[]> {
    const query: any = {};
    
    if (filter.query) {
      query.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { abstract: { $regex: filter.query, $options: 'i' } },
        { notes: { $regex: filter.query, $options: 'i' } },
        { contentHash: { $regex: filter.query, $options: 'i' } }
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
        $lte: filter.dateRange.end.getFullYear()
      };
    }
    
    if (filter.fileType && filter.fileType.length > 0) {
      query.fileType = { $in: filter.fileType };
    }
    const {db} = await connectToDatabase()
    const results = await db.collection<BookMetadata>(this.metadataCollection).find(query).toArray();
    return results as BookMetadata[];
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    if (!collection.id) {
      collection.id = new ObjectId().toString();
    }
    const {db} = await connectToDatabase()
    await db.collection(this.collectionsCollection).updateOne(
      { id: collection.id },
      { $set: collection },
      { upsert: true }
    );
    
    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    const {db} = await connectToDatabase()
    const results = await db.collection<Collection>(this.collectionsCollection).find({}).toArray();
    return results as Collection[];
  }

  async addItemToCollection(itemId: string, collectionId: string): Promise<void> {
    const {db} = await connectToDatabase()
    await db.collection(this.metadataCollection).updateOne(
      { id: itemId },
      { $addToSet: { collections: collectionId } }
    );
  }

  async removeItemFromCollection(itemId: string, collectionId: string): Promise<void> {
    const {db} = await connectToDatabase()
    await db.collection(this.metadataCollection).updateOne(
      { id: itemId },
      { $pull: { collections: collectionId } } as any
    );
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    const {db} = await connectToDatabase()
    await db.collection(this.citationsCollection).updateOne(
      { id: citation.id },
      { $set: citation },
      { upsert: true }
    );
    
    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    const {db} = await connectToDatabase()
    const results = await db.collection<Citation>(this.citationsCollection).find({ itemId }).toArray();
    return results as Citation[];
  }
}

export class S3ElasticSearchLibraryStorage extends AbstractLibraryStorage {
  private readonly metadataIndexName = 'library_metadata';
  private readonly collectionsIndexName = 'library_collections';
  private readonly citationsIndexName = 'library_citations';
  private client: Client;
  private isInitialized = false;

  logger = createLoggerWithPrefix('S3ElasticSearchLibraryStorage');

  constructor(elasticsearchUrl: string = 'http://localhost:9200') {
    super();
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
                  keyword: { type: 'keyword' }
                }
              },
              authors: {
                type: 'nested',
                properties: {
                  firstName: { type: 'text' },
                  lastName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                  middleName: { type: 'text' }
                }
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
              contentHash: { type: 'keyword' }
            }
          }
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
                  keyword: { type: 'keyword' }
                }
              },
              description: { type: 'text' },
              parentCollectionId: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' }
            }
          }
        } as any);
        this.logger.info(`Created collections index: ${this.collectionsIndexName}`);
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
              dateGenerated: { type: 'date' }
            }
          }
        } as any);
        this.logger.info(`Created citations index: ${this.citationsIndexName}`);
      }
    } catch (error: any) {
      if (error?.meta?.body?.error?.type === 'resource_already_exists_exception') {
        this.logger.info('Indexes already exist, continuing');
        this.isInitialized = true;
        return;
      }
      if (error.meta?.statusCode === 0 || error.code === 'ECONNREFUSED') {
        this.logger.error('Elasticsearch is not available. Please ensure Elasticsearch is running.');
        throw new Error('Elasticsearch is not available. Please check your configuration and ensure Elasticsearch is running.');
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
      id: new ObjectId().toString(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date()
    };
    
    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fileName = path.basename(pdfPath);
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadPdfFromPath(pdfPath, s3Key);
    
    const stats = fs.statSync(pdfPath);
    
    const pdfInfo: AbstractPdf = {
      id: new ObjectId().toString(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date()
    };
    
    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    const url = await getSignedUrlForDownload(process.env.PDF_OSS_BUCKET_NAME as string, s3Key);
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(metadata: BookMetadata): Promise<BookMetadata> {
    await this.checkInitialized();
    
    if (!metadata.id) {
      metadata.id = new ObjectId().toString();
    }
    
    await this.client.index({
      index: this.metadataIndexName,
      id: metadata.id,
      body: metadata,
      refresh: true, // Refresh index to make document immediately available
    } as any);
    
    return metadata;
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
              contentHash: contentHash
            }
          }
        }
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
        doc: metadata
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
          fuzziness: 'AUTO'
        }
      });
    }
    
    if (filter.tags && filter.tags.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          tags: filter.tags
        }
      });
    }
    
    if (filter.collections && filter.collections.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          collections: filter.collections
        }
      });
    }
    
    if (filter.authors && filter.authors.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        nested: {
          path: 'authors',
          query: {
            terms: {
              'authors.lastName': filter.authors
            }
          }
        }
      });
    }
    
    if (filter.dateRange) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        range: {
          publicationYear: {
            gte: filter.dateRange.start.getFullYear(),
            lte: filter.dateRange.end.getFullYear()
          }
        }
      });
    }
    
    if (filter.fileType && filter.fileType.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          fileType: filter.fileType
        }
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
          size: 10000 // Adjust based on expected results
        }
      } as any);

      const hits = result.hits.hits;
      return hits.map(hit => hit._source as BookMetadata);
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
      collection.id = new ObjectId().toString();
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
            match_all: {}
          },
          size: 10000
        }
      } as any);

      const hits = result.hits.hits;
      return hits.map(hit => hit._source as Collection);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async addItemToCollection(itemId: string, collectionId: string): Promise<void> {
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

  async removeItemFromCollection(itemId: string, collectionId: string): Promise<void> {
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
              itemId: itemId
            }
          }
        }
      } as any);

      const hits = result.hits.hits;
      return hits.map(hit => hit._source as Citation);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }
}

export interface BookChunk {}

export abstract class AbstractTextSplitter {

}