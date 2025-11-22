import { createLoggerWithPrefix } from 'log-management';
import {
  AbstractPdf,
  ItemMetadata,
  ILibraryStorage,
  SearchFilter,
  Collection,
  Citation,
  ItemArchive,
} from '../index.js';
import { connectToDatabase } from './mongodb.js';
// Don't import s3-service at module level to avoid eager initialization
// import {
//   uploadToS3,
//   uploadPdfFromPath,
//   getSignedUrlForDownload,
// } from '@aikb/s3-service';
import { IdUtils, S3Utils } from 'utils';
import path from 'path';
import fs from 'fs';

export class S3MongoLibraryStorage implements ILibraryStorage {
  private pdfCollection = 'library_pdfs';
  private metadataCollection = 'library_metadata';
  private collectionsCollection = 'library_collections';
  private citationsCollection = 'library_citations';
  private chunksCollection = 'library_chunks';
  private logger = createLoggerWithPrefix('S3MongoLibraryStorage');
  constructor() {
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

      this.logger.info('Library storage indexes created successfully');
    } catch (error) {
      this.logger.warn('Failed to create library storage indexes:', error);
    }
  }

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = S3Utils.generatePdfS3Key(fileName);

    // Lazy import s3-service to avoid eager initialization
    const s3ServiceModule = await import('@aikb/s3-service');
    const { uploadFile } = s3ServiceModule;

    // Create S3 config from environment variables
    const s3Config = {
      accessKeyId: process.env['OSS_ACCESS_KEY_ID']!,
      secretAccessKey: process.env['OSS_SECRET_ACCESS_KEY']!,
      region: process.env['OSS_REGION']!,
      bucketName: process.env['PDF_OSS_BUCKET_NAME']!,
      endpoint: process.env['S3_ENDPOINT']!,
    };

    const result = await uploadFile(
      s3Config,
      s3Key,
      pdfData,
      'application/pdf',
      'private',
    );

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url: result.url,
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
    const s3Key = S3Utils.generatePdfS3Key(fileName);

    // Lazy import s3-service to avoid eager initialization
    const s3ServiceModule = await import('@aikb/s3-service');
    const { uploadPdfFromPath } = s3ServiceModule;
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

    // Lazy import s3-service to avoid eager initialization
    const s3ServiceModule = await import('@aikb/s3-service');
    const { getSignedUrlForDownload } = s3ServiceModule;
    const url = await getSignedUrlForDownload(
      process.env['PDF_OSS_BUCKET_NAME'] as string,
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
    metadata: ItemMetadata,
  ): Promise<ItemMetadata & { id: string }> {
    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: metadata.id }, { $set: metadata }, { upsert: true });

    return metadata as ItemMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<ItemMetadata | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection<ItemMetadata>(this.metadataCollection)
      .findOne({ id });
    return (metadata as ItemMetadata) || null;
  }

  async getMetadataByHash(contentHash: string): Promise<ItemMetadata | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection<ItemMetadata>(this.metadataCollection)
      .findOne({ 'archives.fileHash': contentHash });
    return (metadata as ItemMetadata) || null;
  }

  async updateMetadata(metadata: ItemMetadata): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: metadata.id }, { $set: metadata });
  }

  async addArchiveToMetadata(id: string, archive: ItemArchive): Promise<void> {
    const { db } = await connectToDatabase();

    // Check if item exists
    const item = await this.getMetadata(id);
    if (!item) {
      throw new Error(`Item with ID ${id} not found`);
    }

    // Check if archive with same hash already exists
    const existingArchive = item.archives.find(
      (a) => a.fileHash === archive.fileHash,
    );
    if (existingArchive) {
      throw new Error(
        `Archive with file hash ${archive.fileHash} already exists for item ${id}`,
      );
    }

    // Add the new archive to the archives array
    await db.collection(this.metadataCollection).updateOne(
      { id },
      {
        $push: { archives: archive as any },
        $set: { dateModified: new Date() },
      },
    );
  }

  async searchMetadata(filter: SearchFilter): Promise<ItemMetadata[]> {
    const query: any = {};

    if (filter.query) {
      query.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { abstract: { $regex: filter.query, $options: 'i' } },
        { notes: { $regex: filter.query, $options: 'i' } },
        { 'archives.fileHash': { $regex: filter.query, $options: 'i' } },
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
      query['archives.fileType'] = { $in: filter.fileType };
    }
    const { db } = await connectToDatabase();
    const results = await db
      .collection<ItemMetadata>(this.metadataCollection)
      .find(query)
      .toArray();
    return results as ItemMetadata[];
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
    return metadata?.['markdownContent'] || null;
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db.collection(this.metadataCollection).updateOne(
      { id: itemId },
      {
        $unset: { markdownContent: 1, markdownUpdatedDate: 1 },
        $set: { dateModified: new Date() },
      },
    );

    return result.modifiedCount > 0;
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
}
