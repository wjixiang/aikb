import { createLoggerWithPrefix } from '@aikb/log-management';
import { ItemChunk, ChunkSearchFilter } from '../item/types.js';
import {
  AbstractPdf,
  BookMetadata,
  IdUtils,
  ILibraryStorage,
  SearchFilter,
  Collection,
  Citation,
} from '../library/index.js';
import { connectToDatabase } from './mongodb.js';
import {
  uploadToS3,
  uploadPdfFromPath,
  getSignedUrlForDownload,
} from '@aikb/s3-service';
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

  // Chunk-related methods implementation (MongoDB version)
  async saveChunk(chunk: ItemChunk): Promise<ItemChunk> {
    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    const { db } = await connectToDatabase();
    await db
      .collection(this.chunksCollection)
      .updateOne({ id: chunk.id }, { $set: chunk }, { upsert: true });

    return chunk;
  }

  async getChunk(chunkId: string): Promise<ItemChunk | null> {
    const { db } = await connectToDatabase();
    const chunk = await db
      .collection<ItemChunk>(this.chunksCollection)
      .findOne({ id: chunkId });
    return chunk || null;
  }

  async getChunksByItemId(itemId: string): Promise<ItemChunk[]> {
    const { db } = await connectToDatabase();
    const chunks = await db
      .collection<ItemChunk>(this.chunksCollection)
      .find({ itemId })
      .sort({ index: 1 })
      .toArray();
    return chunks;
  }

  async updateChunk(chunk: ItemChunk): Promise<void> {
    const { db } = await connectToDatabase();
    await db.collection(this.chunksCollection).updateOne(
      { id: chunk.id },
      {
        $set: {
          ...chunk,
          updatedAt: new Date(),
        },
      },
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

  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]> {
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
      .collection<ItemChunk>(this.chunksCollection)
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
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    // MongoDB doesn't have native vector similarity search like Elasticsearch
    // This is a simplified implementation that would need to be enhanced
    // with a proper vector search solution (e.g., MongoDB Atlas Vector Search)

    const query: any = {};
    if (itemIds && itemIds.length > 0) {
      query.itemId = { $in: itemIds };
    }

    const { db } = await connectToDatabase();
    const chunks = await db
      .collection<ItemChunk>(this.chunksCollection)
      .find(query)
      .limit(limit)
      .toArray();

    // Calculate cosine similarity manually (this is inefficient and should be replaced with proper vector search)
    const similarChunks: Array<ItemChunk & { similarity: number }> = [];

    for (const chunk of chunks) {
      // Check for simplified embedding structure
      if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
        continue;
      }

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

  async batchSaveChunks(chunks: ItemChunk[]): Promise<void> {
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
