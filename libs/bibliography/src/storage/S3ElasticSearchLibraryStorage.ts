import { Client } from '@elastic/elasticsearch';
import { ILibraryStorage, AbstractPdf } from '../library/storage.js';
import { createLoggerWithPrefix } from '@aikb/log-management';
import {
  BookMetadata,
  Collection,
  Citation,
  SearchFilter,
  ItemChunk,
  ChunkSearchFilter,
} from '../library/types.js';
import path from 'path';
import fs from 'fs';
import {
  uploadToS3,
  uploadPdfFromPath,
  getSignedUrlForDownload,
} from '@aikb/s3-service';
import { IdUtils } from '../library/utils.js';

export class S3ElasticSearchLibraryStorage implements ILibraryStorage {
  private readonly metadataIndexName = 'library_metadata';
  private readonly collectionsIndexName = 'library_collections';
  private readonly citationsIndexName = 'library_citations';
  private readonly chunksIndexName = 'library_chunks';
  private client: Client;
  private isInitialized = false;
  private vectorDimensions: number;

  logger: any = createLoggerWithPrefix('S3ElasticSearchLibraryStorage');

  // Performance optimization caches
  private searchCache: Map<string, { results: any; timestamp: number }> =
    new Map();
  private groupCache: Map<string, string[]> = new Map();
  private itemCache: Map<string, any> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 1000;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    elasticsearchUrl: string = 'http://elasticsearch:9200',
    vectorDimensions: number = 1536,
  ) {
    this.vectorDimensions = vectorDimensions;
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env['ELASTICSEARCH_URL_API_KEY'] || '',
      },
    });

    // Start periodic cache cleanup
    this.startCacheCleanup();

    // Don't initialize indexes in constructor to avoid blocking
    // Initialize lazily when first operation is called
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, this.cacheTtlMs);
  }

  /**
   * Stop periodic cache cleanup
   */
  private stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.cacheTtlMs;
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();

    // Clean search cache
    for (const [key, entry] of this.searchCache.entries()) {
      if (this.isCacheExpired(entry.timestamp)) {
        this.searchCache.delete(key);
      }
    }

    // Clean group cache
    for (const [key] of this.groupCache.entries()) {
      // Group cache entries don't have timestamps, use a simple size limit
      if (this.groupCache.size > this.maxCacheSize) {
        this.groupCache.delete(key);
      }
    }

    // Clean item cache
    for (const [key, entry] of this.itemCache.entries()) {
      if (this.isCacheExpired(entry.timestamp)) {
        this.itemCache.delete(key);
      }
    }
  }

  /**
   * Generate cache key for search requests - updated for simplified embedding structure
   */
  private generateSearchCacheKey(
    filter: ChunkSearchFilter,
    queryVector?: number[],
  ): string {
    const keyParts = [
      filter.query || '',
      filter.itemId || '',
      filter.denseVectorIndexGroupId || '',
      filter.limit?.toString() || '10',
      filter.similarityThreshold?.toString() || '0.7',
      (filter.groups || []).join(','),
      (filter.chunkingStrategies || []).join(','),
      (filter.embeddingProviders || []).join(','),
      'simplified-embed-v1', // Version identifier for simplified embedding structure
    ];

    if (queryVector) {
      // Use first few dimensions of vector for cache key (for privacy and performance)
      keyParts.push(queryVector.slice(0, 5).join(','));
    }

    return keyParts.join('|');
  }

  /**
   * Get cached search results - updated for simplified embedding structure
   */
  private getCachedSearchResults(cacheKey: string): any | null {
    const entry = this.searchCache.get(cacheKey);
    if (entry && !this.isCacheExpired(entry.timestamp)) {
      // Validate that cached results have simplified embedding structure
      if (Array.isArray(entry.results)) {
        const hasValidStructure = entry.results.every(
          (result: any) =>
            result && (!result.embedding || Array.isArray(result.embedding)),
        );

        if (hasValidStructure) {
          this.logger.debug(`Cache hit for search key: ${cacheKey}`);
          return entry.results;
        } else {
          // Invalid structure in cache, delete and return null
          this.logger.debug(
            `Cache hit but invalid structure for key: ${cacheKey}, invalidating`,
          );
          this.searchCache.delete(cacheKey);
        }
      }
    }

    if (entry) {
      this.searchCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache search results - updated for simplified embedding structure
   */
  private cacheSearchResults(cacheKey: string, results: any): void {
    // Validate results have simplified embedding structure before caching
    if (Array.isArray(results)) {
      const hasValidStructure = results.every(
        (result: any) =>
          result && (!result.embedding || Array.isArray(result.embedding)),
      );

      if (!hasValidStructure) {
        this.logger.debug(
          `Not caching results with invalid embedding structure for key: ${cacheKey}`,
        );
        return;
      }
    }

    // Clean cache if it's getting too large
    if (this.searchCache.size >= this.maxCacheSize) {
      this.cleanExpiredCache();

      // If still too large, remove oldest entries
      if (this.searchCache.size >= this.maxCacheSize) {
        const keysToDelete = Array.from(this.searchCache.keys()).slice(0, 100);
        for (const key of keysToDelete) {
          this.searchCache.delete(key);
        }
      }
    }

    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    this.logger.debug(`Cached search results for key: ${cacheKey}`);
  }

  /**
   * Get cached item metadata
   */
  private getCachedItem(itemId: string): any | null {
    const entry = this.itemCache.get(itemId);
    if (entry && !this.isCacheExpired(entry.timestamp)) {
      return entry.data;
    }

    if (entry) {
      this.itemCache.delete(itemId);
    }

    return null;
  }

  /**
   * Cache item metadata
   */
  private cacheItem(itemId: string, data: any): void {
    // Clean cache if it's getting too large
    if (this.itemCache.size >= this.maxCacheSize) {
      this.cleanExpiredCache();

      // If still too large, remove oldest entries
      if (this.itemCache.size >= this.maxCacheSize) {
        const keysToDelete = Array.from(this.itemCache.keys()).slice(0, 100);
        for (const key of keysToDelete) {
          this.itemCache.delete(key);
        }
      }
    }

    this.itemCache.set(itemId, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache for a specific item
   */
  private invalidateItemCache(itemId: string): void {
    this.itemCache.delete(itemId);

    // Also invalidate any search results that might include this item
    for (const [key, entry] of this.searchCache.entries()) {
      // Simple heuristic: if the cache key contains the item ID, invalidate it
      if (key.includes(itemId)) {
        this.searchCache.delete(key);
      }
    }

    // Invalidate group cache as it might be affected
    this.groupCache.clear();

    this.logger.debug(`Invalidated cache for item: ${itemId}`);
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
      // this.logger.info('Connected to Elasticsearch');

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

      let needsToCreateChunksIndex = !chunksExists;

      // If index exists, check if vector dimensions match
      if (chunksExists) {
        try {
          const indexMapping = await this.client.indices.getMapping({
            index: this.chunksIndexName,
          });

          const currentDims = (
            indexMapping[this.chunksIndexName]?.mappings?.properties?.[
              'embedding'
            ] as any
          )?.dims;

          if (currentDims && currentDims !== this.vectorDimensions) {
            this.logger.warn(
              `Existing chunks index has ${currentDims} dimensions, but ${this.vectorDimensions} are required. Recreating index...`,
            );

            // Delete the existing index
            await this.client.indices.delete({
              index: this.chunksIndexName,
            });

            needsToCreateChunksIndex = true;
          }
        } catch (error) {
          this.logger.error('Error checking chunks index mapping:', error);
          // If we can't check the mapping, try to recreate the index
          needsToCreateChunksIndex = true;
        }
      }

      if (needsToCreateChunksIndex) {
        await this.client.indices.create({
          index: this.chunksIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              itemId: { type: 'keyword' },

              // Dense vector index group for organization
              denseVectorIndexGroupId: { type: 'keyword' },

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

              // Single embedding field - simplified structure
              embedding: {
                type: 'dense_vector',
                dims: this.vectorDimensions,
                index: true,
                similarity: 'cosine',
              },

              // Strategy and configuration metadata
              strategyMetadata: {
                type: 'object',
                properties: {
                  chunkingStrategy: { type: 'keyword' },
                  chunkingConfig: { type: 'object' },
                  embeddingProvider: { type: 'keyword' },
                  embeddingConfig: { type: 'object' },
                  processingTimestamp: { type: 'date' },
                  processingDuration: { type: 'float' },
                },
              },

              // Legacy metadata for backward compatibility
              metadata: {
                type: 'object',
                properties: {
                  chunkType: { type: 'keyword' },
                  startPosition: { type: 'integer' },
                  endPosition: { type: 'integer' },
                  wordCount: { type: 'integer' },
                  chunkingConfig: { type: 'text' },
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
        (error as any)?.meta?.body?.error?.type ===
        'resource_already_exists_exception'
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
      if ((error as any)?.meta?.statusCode === 404) {
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

      const hits = result.hits?.hits || [];
      if (hits.length > 0 && hits[0]) {
        return hits[0]._source as BookMetadata;
      }
      return null;
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
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
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
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
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
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
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
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
      if ((error as any)?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.update({
        index: this.metadataIndexName,
        id: itemId,
        body: {
          script: {
            source: `
              ctx._source.remove('markdownContent');
              ctx._source.remove('markdownUpdatedDate');
              ctx._source.dateModified = params.dateModified;
            `,
            params: {
              dateModified: new Date().toISOString(),
            },
          },
        },
        refresh: true,
      } as any);

      return result.result === 'updated';
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return false; // Document not found
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
      if ((error as any)?.meta?.statusCode === 404) {
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
      if ((error as any)?.meta?.statusCode === 404) {
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
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return false; // Index not found
      }
      throw error;
    }
  }

  // Chunk-related methods implementation
  async saveChunk(chunk: ItemChunk): Promise<ItemChunk> {
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

  async getChunk(chunkId: string): Promise<ItemChunk | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.chunksIndexName,
        id: chunkId,
      });

      if (result.found) {
        return result._source as ItemChunk;
      }
      return null;
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getChunksByItemId(itemId: string): Promise<ItemChunk[]> {
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
          sort: [{ index: { order: 'asc' } }],
          size: 10000, // Adjust based on expected number of chunks
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as ItemChunk);
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw error;
    }
  }

  async updateChunk(chunk: ItemChunk): Promise<void> {
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
      if ((error as any)?.meta?.statusCode === 404) {
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

      return result.deleted || 0;
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return 0; // Index not found
      }
      throw error;
    }
  }

  // Implementation from ILibraryStorage
  async findSimilarChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    itemIds?: string[],
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    const filter: ChunkSearchFilter = {
      limit,
      similarityThreshold: threshold,
      itemIds: itemIds
        ? Array.isArray(itemIds)
          ? itemIds
          : [itemIds]
        : undefined,
    };

    return this.findSimilarChunksWithFilter(queryVector, filter);
  }

  // Enhanced findSimilarChunks implementation
  async findSimilarChunksWithFilter(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: string,
    options?: {
      rankFusion?: boolean;
      weights?: Record<string, number>; // Group-specific weights
      maxResultsPerGroup?: number;
    },
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    await this.checkInitialized();

    // Check cache first
    const cacheKey = this.generateSearchCacheKey(filter, queryVector);
    const cachedResults = this.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    // Validate vector dimensions
    if (queryVector.length !== this.vectorDimensions) {
      throw new Error(
        `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${queryVector.length}`,
      );
    }

    // If rank fusion is requested and we have multiple groups, use rank fusion
    if (options?.rankFusion && filter.groups && filter.groups.length > 1) {
      const rankFusionResults = await this.findSimilarChunksWithRankFusion(
        queryVector,
        filter,
        provider,
        options,
      );

      return rankFusionResults.map((result) => ({
        ...result,
        similarity: result.similarity,
      }));
    }

    // Use the simplified embedding field
    const embeddingField = 'embedding';

    const must: any[] = [];
    const should: any[] = [];

    // Apply filters
    if (filter.itemId) {
      must.push({ term: { itemId: filter.itemId } });
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      must.push({ terms: { itemId: filter.itemIds } });
    }

    if (filter.denseVectorIndexGroupId) {
      must.push({
        term: { denseVectorIndexGroupId: filter.denseVectorIndexGroupId },
      });
    }

    if (filter.groups && filter.groups.length > 0) {
      must.push({ terms: { denseVectorIndexGroupId: filter.groups } });
    }

    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.chunkingStrategy': filter.chunkingStrategies,
        },
      });
    }

    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.embeddingProvider': filter.embeddingProviders,
        },
      });
    }

    // Date range filtering
    if ((filter as any).dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: (filter as any).dateRange.start.toISOString(),
            lte: (filter as any).dateRange.end.toISOString(),
          },
        },
      });
    }

    // Build similarity search query using simplified embedding structure
    const similarityQuery = {
      script_score: {
        query: { match_all: {} },
        script: {
          source: `cosineSimilarity(params.query_vector, doc['${embeddingField}']) + 1.0`,
          params: {
            query_vector: queryVector,
          },
        },
      },
    };

    // If we have multiple groups, we might want to rank results by group
    if (filter.groups && filter.groups.length > 1) {
      // Add group-based scoring to prefer certain groups
      const weights = options?.weights || {};
      for (const group of filter.groups) {
        const groupWeight = weights[group] || 1.0;
        should.push({
          script_score: {
            query: { term: { denseVectorIndexGroupId: group } },
            script: {
              source: `(${groupWeight} * (cosineSimilarity(params.query_vector, doc['${embeddingField}']) + 1.0))`,
              params: {
                query_vector: queryVector,
              },
            },
          },
        });
      }
    } else {
      should.push(similarityQuery);
    }

    // Build query
    const query: any = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        should: should,
        minimum_should_match: 1,
      },
    };

    try {
      const result = await this.client.search({
        index: this.chunksIndexName,
        query,
        min_score: filter.similarityThreshold
          ? filter.similarityThreshold + 1
          : 0.5,
        size: filter.limit || 10,
        sort: [
          { _score: { order: 'desc' } },
          { denseVectorIndexGroupId: { order: 'asc' } },
          { index: { order: 'asc' } },
        ],
      });

      const hits = result.hits.hits;
      const results = hits
        .map((hit) => {
          const { _source, _score } = hit;
          const chunk = _source as ItemChunk;

          // Ensure the chunk has the simplified embedding structure
          if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
            this.logger.warn(
              `Chunk ${chunk.id} has invalid embedding structure`,
            );
            return null;
          }

          const similarity = (_score || 0) - 1; // Convert back from cosine similarity + 1

          return {
            ...chunk,
            similarity,
          };
        })
        .filter(
          (chunk) =>
            chunk !== null &&
            chunk.similarity >= (filter.similarityThreshold || 0),
        ) as Array<ItemChunk & { similarity: number }>;

      // Cache the results
      this.cacheSearchResults(cacheKey, results);

      return results;
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type === 'index_not_found_exception'
      ) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Find similar chunks across multiple groups with rank fusion
   */
  private async findSimilarChunksWithRankFusion(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: string,
    options?: {
      weights?: Record<string, number>; // Group-specific weights
      maxResultsPerGroup?: number;
    },
  ): Promise<
    Array<ItemChunk & { similarity: number; rank: number; group: string }>
  > {
    const maxResultsPerGroup =
      options?.maxResultsPerGroup ||
      Math.ceil((filter.limit || 10) / filter.groups!.length);
    const weights = options?.weights || {};

    // Get results from each group
    const groupResults: Array<{
      group: string;
      chunks: Array<ItemChunk & { similarity: number }>;
    }> = [];

    for (const group of filter.groups!) {
      const groupFilter = {
        ...filter,
        groups: [group],
        limit: maxResultsPerGroup,
      };
      const chunks = await this.findSimilarChunksWithFilter(
        queryVector,
        groupFilter,
        provider,
        { rankFusion: false },
      );

      groupResults.push({
        group,
        chunks,
      });
    }

    // Perform rank fusion
    return this.performRankFusion(groupResults, weights);
  }

  /**
   * Perform rank fusion on results from multiple groups
   */
  private performRankFusion(
    groupResults: Array<{
      group: string;
      chunks: Array<ItemChunk & { similarity: number }>;
    }>,
    weights: Record<string, number>,
  ): Array<ItemChunk & { similarity: number; rank: number; group: string }> {
    const allResults: Array<{
      chunk: ItemChunk & { similarity: number };
      group: string;
      rank: number;
      weightedScore: number;
    }> = [];

    // Collect all results with their ranks and weighted scores
    for (const { group, chunks } of groupResults) {
      const groupWeight = weights[group] || 1.0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const rank = i + 1;

        // Calculate weighted score using reciprocal rank fusion
        if (chunk && chunk.similarity !== undefined) {
          const weightedScore = (chunk.similarity * groupWeight) / (rank + 60); // k=60 for RRF

          allResults.push({
            chunk,
            group,
            rank,
            weightedScore,
          });
        }
      }
    }

    // Sort by weighted score (descending)
    allResults.sort((a, b) => b.weightedScore - a.weightedScore);

    // Remove duplicates (keep the highest scoring version)
    const seenChunks = new Set<string>();
    const finalResults: Array<
      ItemChunk & { similarity: number; rank: number; group: string }
    > = [];

    for (const { chunk, group, rank } of allResults) {
      const chunkKey = `${chunk.itemId}-${chunk.index}`;

      if (!seenChunks.has(chunkKey)) {
        seenChunks.add(chunkKey);
        finalResults.push({
          ...chunk,
          rank: finalResults.length + 1,
          group,
        });
      }
    }

    return finalResults;
  }

  async batchSaveChunks(chunks: ItemChunk[]): Promise<void> {
    const logger = createLoggerWithPrefix(
      'S3ElasticSearchLibraryStorage.batchSaveChunks',
    );
    await this.checkInitialized();

    logger.info(`Starting batch save for ${chunks.length} chunks`);

    // Ensure all chunks have IDs
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
    }

    // Validate all embeddings have correct dimensions and simplified structure
    let embeddingsValid = true;
    for (const chunk of chunks) {
      if (!chunk.embedding) {
        logger.error(`Chunk ID ${chunk.id} has no embedding`);
        embeddingsValid = false;
        continue;
      }

      if (!Array.isArray(chunk.embedding)) {
        logger.error(
          `Chunk ID ${chunk.id} has invalid embedding structure (not an array)`,
        );
        embeddingsValid = false;
        continue;
      }

      if (chunk.embedding.length !== this.vectorDimensions) {
        logger.error(
          `Vector dimensions mismatch for chunk ID ${chunk.id}. Expected: ${this.vectorDimensions}, Got: ${chunk.embedding.length}`,
        );
        embeddingsValid = false;
      }
    }

    if (!embeddingsValid) {
      throw new Error(
        `Vector validation failed. Expected: ${this.vectorDimensions} dimensions, simplified array structure`,
      );
    }

    // Log chunk details before saving
    chunks.forEach((chunk, index) => {
      logger.debug(
        `Chunk ${index}: id=${chunk.id}, itemId=${chunk.itemId}, hasEmbedding=${!!chunk.embedding}, embeddingLength=${chunk.embedding?.length || 0}`,
      );
    });

    const body = chunks.flatMap((chunk) => [
      { index: { _index: this.chunksIndexName, _id: chunk.id } },
      chunk,
    ]);

    logger.info(`Executing bulk operation on index: ${this.chunksIndexName}`);
    const bulkResponse = await this.client.bulk({
      body,
      refresh: true, // Refresh index to make chunks immediately available
    });

    // Check for errors in bulk response
    if ((bulkResponse as any).errors) {
      logger.error(
        'Bulk operation had errors:',
        (bulkResponse as any).items?.filter((item: any) => item.index?.error),
      );
    } else {
      logger.info(`Bulk operation completed successfully`);
    }

    logger.info(
      `Batch saved ${chunks.length} chunks to index: ${this.chunksIndexName}`,
    );
  }

  // Enhanced storage implementation methods

  /**
   * Store chunks
   */
  async storeChunks(chunks: ItemChunk[]): Promise<void> {
    return this.batchSaveChunks(chunks);
  }

  /**
   * Get chunks for a specific item and group
   */
  async getChunksByItemAndGroup(
    itemId: string,
    groupId: string,
  ): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        bool: {
          must: [
            { term: { itemId } },
            { term: { denseVectorIndexGroupId: groupId } },
          ],
        },
      },
      sort: [{ index: { order: 'asc' } }],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks for a specific item across all groups
   */
  async getChunksByItem(itemId: string): Promise<ItemChunk[]> {
    return this.getChunksByItemId(itemId);
  }

  /**
   * Search chunks with filtering support
   */
  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]> {
    await this.checkInitialized();

    // Check cache first
    const cacheKey = this.generateSearchCacheKey(filter);
    const cachedResults = this.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    const must: any[] = [];
    const should: any[] = [];

    // Basic text search
    if (filter.query) {
      must.push({
        multi_match: {
          query: filter.query,
          fields: ['title^2', 'content'],
          type: 'best_fields',
        },
      });
    }

    // Item filtering
    if (filter.itemId) {
      must.push({ term: { itemId: filter.itemId } });
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      must.push({ terms: { itemId: filter.itemIds } });
    }

    // Group filtering
    if (filter.denseVectorIndexGroupId) {
      must.push({
        term: { denseVectorIndexGroupId: filter.denseVectorIndexGroupId },
      });
    }

    if (filter.groups && filter.groups.length > 0) {
      must.push({ terms: { denseVectorIndexGroupId: filter.groups } });
    }

    // Strategy filtering
    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.chunkingStrategy': filter.chunkingStrategies,
        },
      });
    }

    // Provider filtering
    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.embeddingProvider': filter.embeddingProviders,
        },
      });
    }

    // Legacy chunk type filtering
    if (filter.chunkType) {
      should.push({
        term: { 'metadata.chunkType': filter.chunkType },
      });
      should.push({
        term: { 'strategyMetadata.chunkingStrategy': filter.chunkType },
      });
    }

    // Date range filtering
    if ((filter as any).dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: (filter as any).dateRange.start.toISOString(),
            lte: (filter as any).dateRange.end.toISOString(),
          },
        },
      });
    }

    // Build query
    const query: any = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
      },
    };

    if (should.length > 0) {
      query.bool.should = should;
      query.bool.minimum_should_match = 1;
    }

    // Execute search
    const response = await this.client.search({
      index: this.chunksIndexName,
      query,
      size: filter.limit || 100,
    });

    const results = response.hits.hits.map((hit: any) => hit._source);

    // Cache the results
    this.cacheSearchResults(cacheKey, results);

    return results;
  }

  /**
   * Get available groups for an item
   */
  async getAvailableGroups(itemId: string): Promise<string[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { itemId },
      },
      aggs: {
        groups: {
          terms: {
            field: 'denseVectorIndexGroupId',
          },
        },
      },
      size: 0,
    });

    return (
      (response.aggregations?.['groups'] as any)?.buckets?.map(
        (bucket: any) => bucket.key,
      ) || []
    );
  }

  /**
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<{
    chunkCount: number;
    averageChunkSize: number;
    processingTime: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { denseVectorIndexGroupId: groupId },
      },
      aggs: {
        chunkCount: {
          value_count: {
            field: '_id',
          },
        },
        avgChunkSize: {
          avg: {
            script: {
              source: "doc['content'].value.length()",
            },
          },
        },
        avgProcessingTime: {
          avg: {
            field: 'strategyMetadata.processingDuration',
          },
        },
        oldestChunk: {
          min: {
            field: 'createdAt',
          },
        },
        newestChunk: {
          max: {
            field: 'updatedAt',
          },
        },
      },
      size: 0,
    });

    const aggregations = response.aggregations as any;
    return {
      chunkCount: aggregations?.chunkCount?.value || 0,
      averageChunkSize: aggregations?.avgChunkSize?.value || 0,
      processingTime: aggregations?.avgProcessingTime?.value || 0,
      createdAt: new Date(
        aggregations?.oldestChunk?.value_as_string || Date.now(),
      ),
      updatedAt: new Date(
        aggregations?.newestChunk?.value_as_string || Date.now(),
      ),
    };
  }

  /**
   * Delete chunks for a specific group (soft delete)
   */
  async deleteChunksByGroup(groupId: string): Promise<number> {
    await this.checkInitialized();

    const response = await this.client.deleteByQuery({
      index: this.chunksIndexName,
      query: {
        term: { denseVectorIndexGroupId: groupId },
      },
      refresh: true,
    });

    return response.deleted || 0;
  }

  /**
   * Get chunks by multiple groups
   */
  async getChunksByGroups(groupIds: string[]): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        terms: { denseVectorIndexGroupId: groupIds },
      },
      sort: [
        { denseVectorIndexGroupId: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by chunking strategy
   */
  async getChunksByStrategy(strategy: string): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { 'strategyMetadata.chunkingStrategy': strategy },
      },
      sort: [{ itemId: { order: 'asc' } }, { index: { order: 'asc' } }],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by embedding provider
   */
  async getChunksByProvider(provider: string): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { 'strategyMetadata.embeddingProvider': provider },
      },
      sort: [{ itemId: { order: 'asc' } }, { index: { order: 'asc' } }],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Update chunks for a specific group
   */
  async updateChunksByGroup(
    groupId: string,
    updates: Partial<ItemChunk>,
  ): Promise<number> {
    await this.checkInitialized();

    const response = await this.client.updateByQuery({
      index: this.chunksIndexName,
      query: {
        term: { denseVectorIndexGroupId: groupId },
      },
      script: {
        source: Object.entries(updates)
          .map(([key, value]) => {
            if (typeof value === 'object') {
              return `ctx._source.${key} = params.${key}`;
            }
            return `ctx._source.${key} = '${value}'`;
          })
          .join('; '),
        params: updates,
      },
      refresh: true,
    });

    return response.updated || 0;
  }

  /**
   * Migrate legacy chunks to the new format
   */
  async migrateLegacyChunks(itemId?: string): Promise<number> {
    // Implementation would depend on specific migration requirements
    // For now, return 0 as a placeholder
    this.logger.info('Legacy chunk migration not yet implemented');
    return 0;
  }

  /**
   * Validate chunk embeddings for consistency
   */
  async validateChunkEmbeddings(groupId?: string): Promise<{
    totalChunks: number;
    validChunks: number;
    invalidChunks: number;
    errors: string[];
  }> {
    await this.checkInitialized();

    const query = groupId
      ? { term: { denseVectorIndexGroupId: groupId } }
      : { match_all: {} };

    const response = await this.client.search({
      index: this.chunksIndexName,
      query,
      size: 1000, // Limit for validation
    });

    const chunks = response.hits.hits.map((hit: any) => hit._source);
    const errors: string[] = [];
    let validChunks = 0;

    for (const chunk of chunks) {
      // Check if chunk has simplified embedding structure
      if (!chunk.embedding) {
        errors.push(`Chunk ${chunk.id} has no embedding`);
        continue;
      }

      if (!Array.isArray(chunk.embedding)) {
        errors.push(
          `Chunk ${chunk.id} has invalid embedding structure (expected array)`,
        );
        continue;
      }

      if (chunk.embedding.length === 0) {
        errors.push(`Chunk ${chunk.id} has empty embedding`);
        continue;
      }

      if (chunk.embedding.length !== this.vectorDimensions) {
        errors.push(
          `Chunk ${chunk.id} has incorrect embedding dimensions: ${chunk.embedding.length}, expected: ${this.vectorDimensions}`,
        );
        continue;
      }

      validChunks++;
    }

    return {
      totalChunks: chunks.length,
      validChunks,
      invalidChunks: chunks.length - validChunks,
      errors,
    };
  }
}
