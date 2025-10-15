import { BookChunk, ChunkSearchFilter, ChunkingEmbeddingGroup } from '../knowledgeImport/library';
import { Client } from '@elastic/elasticsearch';

/**
 * Multi-Version Vector Storage Interface
 * 
 * This interface defines the contract for storing and retrieving vector embeddings
 * with support for multiple versions and strategies. It enables semantic search
 * across different chunking and embedding approaches while maintaining backward
 * compatibility with existing data structures.
 */
export interface IMultiVersionVectorStorage {
  /**
   * Store chunks with versioning information
   * @param chunks Array of chunks to store
   */
  storeChunks(chunks: BookChunk[]): Promise<void>;

  /**
   * Get chunks for a specific item and group
   * @param itemId The ID of the item
   * @param groupId The ID of the group
   * @returns Array of chunks
   */
  getChunksByItemAndGroup(itemId: string, groupId: string): Promise<BookChunk[]>;

  /**
   * Get chunks for a specific item across all groups
   * @param itemId The ID of the item
   * @returns Array of chunks
   */
  getChunksByItem(itemId: string): Promise<BookChunk[]>;

  /**
   * Search chunks with multi-version support
   * @param filter Search filters
   * @returns Array of matching chunks
   */
  searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]>;

  /**
   * Find similar chunks across multiple groups
   * @param queryVector The query vector
   * @param filter Search filters
   * @param provider Optional embedding provider to use
   * @returns Array of chunks with similarity scores
   */
  findSimilarChunks(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: string
  ): Promise<Array<BookChunk & { similarity: number }>>;

  /**
   * Get available groups for an item
   * @param itemId The ID of the item
   * @returns Array of group IDs
   */
  getAvailableGroups(itemId: string): Promise<string[]>;

  /**
   * Get group statistics
   * @param groupId The ID of the group
   * @returns Group statistics
   */
  getGroupStats(groupId: string): Promise<{
    chunkCount: number;
    averageChunkSize: number;
    processingTime: number;
    createdAt: Date;
    updatedAt: Date;
  }>;

  /**
   * Delete chunks for a specific group (soft delete)
   * @param groupId The ID of the group
   * @returns Number of deleted chunks
   */
  deleteChunksByGroup(groupId: string): Promise<number>;

  /**
   * Get chunks by multiple groups
   * @param groupIds Array of group IDs
   * @returns Array of chunks
   */
  getChunksByGroups(groupIds: string[]): Promise<BookChunk[]>;

  /**
   * Get chunks by version
   * @param version The version identifier
   * @returns Array of chunks
   */
  getChunksByVersion(version: string): Promise<BookChunk[]>;

  /**
   * Get chunks by chunking strategy
   * @param strategy The chunking strategy
   * @returns Array of chunks
   */
  getChunksByStrategy(strategy: string): Promise<BookChunk[]>;

  /**
   * Get chunks by embedding provider
   * @param provider The embedding provider
   * @returns Array of chunks
   */
  getChunksByProvider(provider: string): Promise<BookChunk[]>;

  /**
   * Update chunks for a specific group
   * @param groupId The ID of the group
   * @param updates The updates to apply
   * @returns Number of updated chunks
   */
  updateChunksByGroup(groupId: string, updates: Partial<BookChunk>): Promise<number>;

  /**
   * Migrate legacy chunks to the new multi-version format
   * @param itemId Optional item ID to migrate (migrates all if not provided)
   * @returns Number of migrated chunks
   */
  migrateLegacyChunks(itemId?: string): Promise<number>;

  /**
   * Validate chunk embeddings for consistency
   * @param groupId Optional group ID to validate (validates all if not provided)
   * @returns Validation result
   */
  validateChunkEmbeddings(groupId?: string): Promise<{
    totalChunks: number;
    validChunks: number;
    invalidChunks: number;
    errors: string[];
  }>;
}

/**
 * Default implementation of MultiVersionVectorStorage
 */
export class MultiVersionVectorStorage implements IMultiVersionVectorStorage {
  private client: Client;
  private readonly indexName = 'multi_version_chunks';
  
  // Caching for frequently accessed data
  private groupCache: Map<string, string[]> = new Map();
  private groupStatsCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return !expiry || Date.now() > expiry;
  }

  /**
   * Set cache entry with expiry
   */
  private setCacheWithExpiry<T>(cache: Map<string, T>, key: string, value: T): void {
    cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.cacheTtlMs);
  }

  /**
   * Get cache entry if not expired
   */
  private getCacheEntry<T>(cache: Map<string, T>, key: string): T | null {
    if (this.isCacheExpired(key)) {
      cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return cache.get(key) || null;
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.groupCache.delete(key);
        this.groupStatsCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Store chunks with versioning information
   */
  async storeChunks(chunks: BookChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    // Ensure index exists
    await this.ensureIndex();

    // Prepare bulk operation
    const body = chunks.flatMap((chunk) => [
      { index: { _index: this.indexName, _id: chunk.id } },
      chunk,
    ]);

    // Execute bulk operation
    await this.client.bulk({
      body,
      refresh: true,
    });

    // Invalidate cache for affected items and groups
    const affectedItems = new Set(chunks.map(chunk => chunk.itemId));
    const affectedGroups = new Set(chunks.map(chunk => chunk.denseVectorIndexGroup));
    
    for (const itemId of affectedItems) {
      this.groupCache.delete(`groups:${itemId}`);
      this.cacheExpiry.delete(`groups:${itemId}`);
    }
    
    for (const groupId of affectedGroups) {
      this.groupStatsCache.delete(`stats:${groupId}`);
      this.cacheExpiry.delete(`stats:${groupId}`);
    }
  }

  /**
   * Get chunks for a specific item and group
   */
  async getChunksByItemAndGroup(itemId: string, groupId: string): Promise<BookChunk[]> {
    const response = await this.client.search({
      index: this.indexName,
      query: {
        bool: {
          must: [
            { term: { itemId } },
            { term: { denseVectorIndexGroup: groupId } },
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
  async getChunksByItem(itemId: string): Promise<BookChunk[]> {
    const response = await this.client.search({
      index: this.indexName,
      query: {
        term: { itemId },
      },
      sort: [
        { denseVectorIndexGroup: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Search chunks with multi-version support
   */
  async searchChunks(filter: ChunkSearchFilter): Promise<BookChunk[]> {
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
    if (filter.denseVectorIndexGroup) {
      must.push({ term: { denseVectorIndexGroup: filter.denseVectorIndexGroup } });
    }

    if (filter.groups && filter.groups.length > 0) {
      must.push({ terms: { denseVectorIndexGroup: filter.groups } });
    }

    // Version filtering
    if (filter.version) {
      must.push({ term: { version: filter.version } });
    }

    if (filter.versions && filter.versions.length > 0) {
      must.push({ terms: { version: filter.versions } });
    }

    // Strategy filtering
    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      must.push({
        terms: { 'strategyMetadata.chunkingStrategy': filter.chunkingStrategies },
      });
    }

    // Provider filtering
    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      must.push({
        terms: { 'strategyMetadata.embeddingProvider': filter.embeddingProviders },
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
    if (filter.dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: filter.dateRange.start.toISOString(),
            lte: filter.dateRange.end.toISOString(),
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
      index: this.indexName,
      query,
      size: filter.limit || 100,
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Find similar chunks across multiple groups
   */
  async findSimilarChunks(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: string
  ): Promise<Array<BookChunk & { similarity: number }>> {
    // Determine which embedding field to use
    const embeddingField = provider ? `embeddings.${provider}` : 'embedding';

    // Build query
    const must: any[] = [];
    const should: any[] = [];

    // Apply filters
    if (filter.itemId) {
      must.push({ term: { itemId: filter.itemId } });
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      must.push({ terms: { itemId: filter.itemIds } });
    }

    if (filter.denseVectorIndexGroup) {
      must.push({ term: { denseVectorIndexGroup: filter.denseVectorIndexGroup } });
    }

    if (filter.groups && filter.groups.length > 0) {
      must.push({ terms: { denseVectorIndexGroup: filter.groups } });
    }

    // Version filtering
    if (filter.version) {
      must.push({ term: { version: filter.version } });
    }

    if (filter.versions && filter.versions.length > 0) {
      must.push({ terms: { version: filter.versions } });
    }

    // Strategy filtering
    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      must.push({
        terms: { 'strategyMetadata.chunkingStrategy': filter.chunkingStrategies },
      });
    }

    // Provider filtering
    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      must.push({
        terms: { 'strategyMetadata.embeddingProvider': filter.embeddingProviders },
      });
    }

    // Date range filtering
    if (filter.dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: filter.dateRange.start.toISOString(),
            lte: filter.dateRange.end.toISOString(),
          },
        },
      });
    }

    // Build similarity search query
    const similarityQuery = {
      script_score: {
        query: { match_all: {} },
        script: {
          source: 'cosineSimilarity(params.query_vector, doc[params.embedding_field]) + 1.0',
          params: {
            query_vector: queryVector,
            embedding_field: embeddingField,
          },
        },
      },
    };

    // If we have multiple groups, we might want to rank results by group
    if (filter.groups && filter.groups.length > 1) {
      // Add group-based scoring to prefer certain groups
      for (const group of filter.groups) {
        should.push({
          script_score: {
            query: { term: { denseVectorIndexGroup: group } },
            script: {
              source: 'cosineSimilarity(params.query_vector, doc[params.embedding_field]) + 1.0',
              params: {
                query_vector: queryVector,
                embedding_field: embeddingField,
              },
            },
          },
        });
      }
    } else {
      should.push(similarityQuery);
    }

    // Execute similarity search
    const response = await this.client.search({
      index: this.indexName,
      query: {
        bool: {
          must: must.length > 0 ? must : [{ match_all: {} }],
          should: should,
          minimum_should_match: 1,
        },
      },
      min_score: filter.similarityThreshold ? filter.similarityThreshold + 1 : 0.5,
      size: filter.limit || 10,
      sort: [
        { _score: { order: 'desc' } },
        { denseVectorIndexGroup: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => ({
      ...hit._source,
      similarity: hit._score - 1, // Convert back from cosine similarity + 1
    }));
  }

  /**
   * Find similar chunks across multiple groups with rank fusion
   */
  async findSimilarChunksWithRankFusion(
    queryVector: number[],
    filter: ChunkSearchFilter,
    options?: {
      provider?: string;
      rankFusion?: boolean;
      weights?: Record<string, number>; // Group-specific weights
      maxResultsPerGroup?: number;
    }
  ): Promise<Array<BookChunk & { similarity: number; rank: number; group: string }>> {
    if (!options?.rankFusion || !filter.groups || filter.groups.length <= 1) {
      // Use regular similarity search if rank fusion is not requested
      const results = await this.findSimilarChunks(queryVector, filter, options?.provider);
      return results.map((chunk, index) => ({
        ...chunk,
        rank: index + 1,
        group: chunk.denseVectorIndexGroup,
      }));
    }

    const maxResultsPerGroup = options?.maxResultsPerGroup || Math.ceil((filter.limit || 10) / filter.groups!.length);
    const weights = options?.weights || {};
    
    // Get results from each group
    const groupResults: Array<{
      group: string;
      chunks: Array<BookChunk & { similarity: number }>;
    }> = [];

    for (const group of filter.groups!) {
      const groupFilter = { ...filter, groups: [group], limit: maxResultsPerGroup };
      const chunks = await this.findSimilarChunks(queryVector, groupFilter, options?.provider);
      
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
      chunks: Array<BookChunk & { similarity: number }>;
    }>,
    weights: Record<string, number>
  ): Array<BookChunk & { similarity: number; rank: number; group: string }> {
    const allResults: Array<{
      chunk: BookChunk & { similarity: number };
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
        const weightedScore = (chunk.similarity * groupWeight) / (rank + 60); // k=60 for RRF
        
        allResults.push({
          chunk,
          group,
          rank,
          weightedScore,
        });
      }
    }

    // Sort by weighted score (descending)
    allResults.sort((a, b) => b.weightedScore - a.weightedScore);

    // Remove duplicates (keep the highest scoring version)
    const seenChunks = new Set<string>();
    const finalResults: Array<BookChunk & { similarity: number; rank: number; group: string }> = [];
    
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

  /**
   * Get available groups for an item
   */
  async getAvailableGroups(itemId: string): Promise<string[]> {
    // Check cache first
    const cacheKey = `groups:${itemId}`;
    const cachedGroups = this.getCacheEntry(this.groupCache, cacheKey);
    
    if (cachedGroups) {
      return cachedGroups;
    }

    const response = await this.client.search({
      index: this.indexName,
      query: {
        term: { itemId },
      },
      aggs: {
        groups: {
          terms: {
            field: 'denseVectorIndexGroup',
          },
        },
      },
      size: 0,
    });

    const groups = (response.aggregations?.groups as any)?.buckets?.map((bucket: any) => bucket.key) || [];
    
    // Cache the result
    this.setCacheWithExpiry(this.groupCache, cacheKey, groups);
    
    return groups;
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
    // Check cache first
    const cacheKey = `stats:${groupId}`;
    const cachedStats = this.getCacheEntry(this.groupStatsCache, cacheKey);
    
    if (cachedStats) {
      return cachedStats;
    }

    const response = await this.client.search({
      index: this.indexName,
      query: {
        term: { denseVectorIndexGroup: groupId },
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
    const stats = {
      chunkCount: aggregations?.chunkCount?.value || 0,
      averageChunkSize: aggregations?.avgChunkSize?.value || 0,
      processingTime: aggregations?.avgProcessingTime?.value || 0,
      createdAt: new Date(aggregations?.oldestChunk?.value_as_string || Date.now()),
      updatedAt: new Date(aggregations?.newestChunk?.value_as_string || Date.now()),
    };
    
    // Cache the result
    this.setCacheWithExpiry(this.groupStatsCache, cacheKey, stats);
    
    return stats;
  }

  /**
   * Delete chunks for a specific group (soft delete)
   */
  async deleteChunksByGroup(groupId: string): Promise<number> {
    const response = await this.client.deleteByQuery({
      index: this.indexName,
      query: {
        term: { denseVectorIndexGroup: groupId },
      },
      refresh: true,
    });

    // Invalidate cache entries related to this group
    this.invalidateGroupCache(groupId);

    return response.deleted || 0;
  }

  /**
   * Invalidate cache entries for a specific group
   */
  private invalidateGroupCache(groupId: string): void {
    // Remove group stats cache
    this.groupStatsCache.delete(`stats:${groupId}`);
    this.cacheExpiry.delete(`stats:${groupId}`);
    
    // Remove group cache entries for all items
    for (const [key] of this.groupCache.entries()) {
      if (key.startsWith('groups:')) {
        this.groupCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Get chunks by multiple groups
   */
  async getChunksByGroups(groupIds: string[]): Promise<BookChunk[]> {
    const response = await this.client.search({
      index: this.indexName,
      query: {
        terms: { denseVectorIndexGroup: groupIds },
      },
      sort: [
        { denseVectorIndexGroup: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by version
   */
  async getChunksByVersion(version: string): Promise<BookChunk[]> {
    const response = await this.client.search({
      index: this.indexName,
      query: {
        term: { version },
      },
      sort: [
        { itemId: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by chunking strategy
   */
  async getChunksByStrategy(strategy: string): Promise<BookChunk[]> {
    const response = await this.client.search({
      index: this.indexName,
      query: {
        term: { 'strategyMetadata.chunkingStrategy': strategy },
      },
      sort: [
        { itemId: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by embedding provider
   */
  async getChunksByProvider(provider: string): Promise<BookChunk[]> {
    const response = await this.client.search({
      index: this.indexName,
      query: {
        term: { 'strategyMetadata.embeddingProvider': provider },
      },
      sort: [
        { itemId: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Update chunks for a specific group
   */
  async updateChunksByGroup(groupId: string, updates: Partial<BookChunk>): Promise<number> {
    const response = await this.client.updateByQuery({
      index: this.indexName,
      query: {
        term: { denseVectorIndexGroup: groupId },
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
   * Migrate legacy chunks to the new multi-version format
   */
  async migrateLegacyChunks(itemId?: string): Promise<number> {
    // This would be implemented based on the specific migration requirements
    // For now, return 0 as a placeholder
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
    const query = groupId
      ? { term: { denseVectorIndexGroup: groupId } }
      : { match_all: {} };

    const response = await this.client.search({
      index: this.indexName,
      query,
      size: 1000, // Limit for validation
    });

    const chunks = response.hits.hits.map((hit: any) => hit._source);
    const errors: string[] = [];
    let validChunks = 0;

    for (const chunk of chunks) {
      // Check if chunk has embeddings
      if (!chunk.embeddings || Object.keys(chunk.embeddings).length === 0) {
        if (!chunk.embedding) {
          errors.push(`Chunk ${chunk.id} has no embeddings`);
          continue;
        }
      }

      // Validate embedding dimensions
      for (const [provider, embedding] of Object.entries(chunk.embeddings)) {
        if (!Array.isArray(embedding) || embedding.length === 0) {
          errors.push(`Chunk ${chunk.id} has invalid embedding for provider ${provider}`);
          continue;
        }
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

  /**
   * Ensure the index exists with proper mapping
   */
  private async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({
      index: this.indexName,
    });

    if (!exists) {
      await this.client.indices.create({
        index: this.indexName,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            itemId: { type: 'keyword' },
            denseVectorIndexGroup: { type: 'keyword' },
            version: { type: 'keyword' },
            title: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            content: { type: 'text' },
            index: { type: 'integer' },
            embeddings: {
              type: 'object',
              dynamic: true,
              properties: {
                // Dynamic properties for different providers
                // Each provider will have its own dense_vector field
              },
            },
            embedding: { type: 'dense_vector', dims: 1024 }, // Legacy field
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
      });
    }
  }
}