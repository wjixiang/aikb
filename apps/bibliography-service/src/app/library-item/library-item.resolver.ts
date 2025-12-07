import { Resolver, Query, Mutation, Args, ResolveField } from '@nestjs/graphql';
import { LibraryItemService } from './library-item.service';
import { VectorService } from 'bibliography-lib';
import { libraryItemVectorProto } from 'proto-ts';
import * as graphql from '../../graphql';
import { CreateLibraryItemDto } from 'library-shared';
import { LibraryItem } from '@/libs/bibliography/src';

@Resolver()
export class LibraryItemResolver {
  constructor(
    private readonly libraryItemService: LibraryItemService,
    private readonly vectorService: VectorService
  ) {}

  private transformLibraryItemToMetadata(item: LibraryItem): graphql.LibraryItemMetadata {
    return {
      id: item.getItemId(),
      title: item.metadata.title,
      authors: item.metadata.authors.map((author: any) => ({
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName || null
      })),
      abstract: item.metadata.abstract || null,
      publicationYear: item.metadata.publicationYear || null,
      publisher: item.metadata.publisher || null,
      isbn: item.metadata.isbn || null,
      doi: item.metadata.doi || null,
      url: item.metadata.url || null,
      tags: item.metadata.tags,
      notes: item.metadata.notes || null,
      collections: item.metadata.collections,
      dateAdded: item.metadata.dateAdded.toISOString(),
      dateModified: item.metadata.dateModified.toISOString(),
      language: item.metadata.language || null,
      markdownContent: item.metadata.markdownContent || null,
      markdownUpdatedDate: item.metadata.markdownUpdatedDate?.toISOString() || null,
      archives: item.metadata.archives.map(e => ({
        fileType: e.fileType,
        fileSize: e.fileSize,
        fileHash: e.fileHash,
        addDate: e.addDate.toISOString(),
        s3Key: e.s3Key,
        pageCount: e.pageCount,
        wordCount: e.wordCount || null
      }))
    };
  }

  private transformChunkEmbedGroup(group: any): graphql.ChunkEmbedGroup {
    // Handle both Date objects and timestamp numbers
    const createdAt = group.createdAt instanceof Date
      ? group.createdAt.toISOString()
      : (typeof group.createdAt === 'number'
        ? new Date(group.createdAt).toISOString()
        : new Date().toISOString());
    
    const updatedAt = group.updatedAt instanceof Date
      ? group.updatedAt.toISOString()
      : (typeof group.updatedAt === 'number'
        ? new Date(group.updatedAt).toISOString()
        : new Date().toISOString());

    return {
      id: group.id,
      itemId: group.itemId,
      name: group.name,
      description: group.description,
      chunkEmbedConfig: {
        chunkingConfig: {
          strategy: group.chunkingConfig?.strategy || 'paragraph'
        },
        embeddingConfig: {
          model: group.embeddingConfig?.model || '',
          dimension: group.embeddingConfig?.dimension || 0,
          batchSize: group.embeddingConfig?.batchSize || 20,
          maxRetries: group.embeddingConfig?.maxRetries || 3,
          timeout: group.embeddingConfig?.timeout || 20000,
          provider: group.embeddingConfig?.provider || ''
        }
      },
      isDefault: group.isDefault,
      isActive: group.isActive,
      createdAt,
      updatedAt,
      createdBy: group.createdBy
    };
  }

  private transformSemanticSearchResultChunk(result: any): graphql.SemanticSearchResultChunk {
    return {
      chunkId: result.chunkId,
      itemId: result.itemId,
      title: result.title,
      content: result.content,
      score: result.score,
      metadata: {
        startPosition: result.metadata?.startPosition,
        endPosition: result.metadata?.endPosition,
        wordCount: result.metadata?.wordCount,
        chunkType: result.metadata?.chunkType
      },
      libraryItem: null, // Will be resolved separately
      chunkEmbedGroup: null // Will be resolved separately
    };
  }

  @Query('libraryItems')
  async getLibraryItems(): Promise<graphql.LibraryItemMetadata[]> {
    try {
      const items = await this.libraryItemService.searchLibraryItems();
      
      // Transform LibraryItem objects to match GraphQL schema
      return items.map(item => this.transformLibraryItemToMetadata(item));
    } catch (error) {
      console.error('Error fetching library items:', error);
      return [];
    }
  }

  @Query('libraryItem')
  async getLibraryItemsById(@Args('id') id: string): Promise<graphql.LibraryItemMetadata> {
    try {
      const item = await this.libraryItemService.getLibraryItem(id)
      if(!item) throw new Error(`LibraryItem unfounded ${id}`)
      // Transform LibraryItem objects to match GraphQL schema
      return this.transformLibraryItemToMetadata(item)
    } catch (error) {
      console.error('Error fetching library items:', error);
      throw error
    }
  }

  @Query('chunkEmbedGroups')
  async getChunkEmbedGroups(@Args('itemId') itemId: string): Promise<graphql.ChunkEmbedGroups[]> {
    try {
      const result = await this.vectorService.listChunkEmbedGroupMetadata({
        itemId,
        pageSize: 100,
        pageToken: '',
        filter: '',
        orderBy: ''
      });
      
      return [{
        groups: result.groups.map(group => this.transformChunkEmbedGroup(group)),
        total: result.totalSize
      }];
    } catch (error) {
      console.error(`Error fetching chunk embed groups for item ${itemId}:`, error);
      throw new Error(`Failed to fetch chunk embed groups: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @Query('semanticSearch')
  async semanticSearch(
    @Args('query') query: string,
    @Args('chunkEmbedGroupId') chunkEmbedGroupId: string,
    @Args('topK') topK?: number,
    @Args('scoreThreshold') scoreThreshold?: number,
    @Args('filters') filters?: graphql.SemanticSearchFilters
  ): Promise<graphql.SemanticSearchResult> {
    try {
      // If chunkEmbedGroupId is specified, search in that specific group
      if (chunkEmbedGroupId) {
        return await this.searchInSpecificGroup(chunkEmbedGroupId, query, topK, scoreThreshold);
      }
      
      // Global search across all items and groups
      return await this.globalSemanticSearch(query, topK, scoreThreshold, filters);
    } catch (error) {
      console.error('Error performing semantic search:', error);
      throw new Error(`Failed to perform semantic search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async searchInSpecificGroup(
    chunkEmbedGroupId: string,
    query: string,
    topK?: number,
    scoreThreshold?: number
  ): Promise<graphql.SemanticSearchResult> {
    // No need to get itemId since it's now optional in the service
    const result = await this.vectorService.semanticSearchByItemidAndGroupid({
      chunkEmbedGroupId,
      query,
      topK: topK || 10,
      scoreThreshold: scoreThreshold || 0.0,
      filter: {}
    });

    return {
      query,
      totalResults: result.results.length,
      results: result.results.map(r => this.transformSemanticSearchResultChunk(r))
    };
  }

  private async searchInItemGroups(
    itemId: string,
    query: string,
    topK?: number,
    scoreThreshold?: number,
    filters?: graphql.SemanticSearchFilters
  ): Promise<graphql.SemanticSearchResult> {
    // Get all active groups for this item
    const groupsResult = await this.vectorService.listChunkEmbedGroupMetadata({
      itemId,
      pageSize: 100,
      pageToken: '',
      filter: '',
      orderBy: ''
    });
    
    const activeGroups = groupsResult.groups.filter(g => g.isActive);
    const allResults: any[] = [];

    // Search in each active group
    for (const group of activeGroups) {
      const result = await this.vectorService.semanticSearchByItemidAndGroupid({
        itemId, // Still pass itemId when searching within specific item groups
        chunkEmbedGroupId: group.id,
        query,
        topK: topK || 10,
        scoreThreshold: scoreThreshold || 0.0,
        filter: {}
      });
      
      allResults.push(...result.results);
    }

    // Sort by score and take topK results
    allResults.sort((a, b) => b.score - a.score);
    const finalResults = allResults.slice(0, topK || 10);

    return {
      query,
      totalResults: finalResults.length,
      results: finalResults.map(r => this.transformSemanticSearchResultChunk(r))
    };
  }

  private async globalSemanticSearch(
    query: string,
    topK?: number,
    scoreThreshold?: number,
    filters?: graphql.SemanticSearchFilters
  ): Promise<graphql.SemanticSearchResult> {
    // For global search, we would need to implement a cross-item search
    // For now, we'll search across all library items and their active groups
    const items = await this.libraryItemService.searchLibraryItems();
    const allResults: any[] = [];

    for (const item of items) {
      try {
        const itemResult = await this.searchInItemGroups(
          item.getItemId(),
          query,
          topK,
          scoreThreshold,
          filters
        );
        allResults.push(...itemResult.results);
      } catch (error) {
        console.error(`Error searching in item ${item.getItemId()}:`, error);
        // Continue with other items
      }
    }

    // Sort by score and take topK results
    allResults.sort((a, b) => b.score - a.score);
    const finalResults = allResults.slice(0, topK || 10);

    return {
      query,
      totalResults: finalResults.length,
      results: finalResults.map(r => this.transformSemanticSearchResultChunk(r))
    };
  }

  @ResolveField('chunkEmbedGroups', () => [graphql.ChunkEmbedGroup], { nullable: true })
  async getChunkEmbedGroupsForLibraryItem(parent: graphql.LibraryItemMetadata): Promise<graphql.ChunkEmbedGroup[]> {
    try {
      const result = await this.vectorService.listChunkEmbedGroupMetadata({
        itemId: parent.id,
        pageSize: 100,
        pageToken: '',
        filter: '',
        orderBy: ''
      });
      
      return result.groups.map(group => this.transformChunkEmbedGroup(group));
    } catch (error) {
      console.error(`Error fetching chunk embed groups for item ${parent.id}:`, error);
      return [];
    }
  }

  @ResolveField('libraryItem', () => graphql.LibraryItemMetadata, { nullable: true })
  async getLibraryItemForChunk(parent: graphql.SemanticSearchResultChunk): Promise<graphql.LibraryItemMetadata | null> {
    try {
      const item = await this.libraryItemService.getLibraryItem(parent.itemId);
      if (!item) return null;
      
      return this.transformLibraryItemToMetadata(item);
    } catch (error) {
      console.error(`Error fetching library item for chunk ${parent.chunkId}:`, error);
      return null;
    }
  }

  @ResolveField('chunkEmbedGroup', () => graphql.ChunkEmbedGroup, { nullable: true })
  async getChunkEmbedGroupForChunk(parent: graphql.SemanticSearchResultChunk): Promise<graphql.ChunkEmbedGroup | null> {
    try {
      this.vectorService.listChunkEmbedGroupMetadata({
        itemId: '',
        pageSize: 0,
        pageToken: '',
        filter: '',
        orderBy: ''
      })
      // We need to find which group this chunk belongs to
      // This would require additional implementation to track chunk-to-group mapping
      // For now, we'll return null
      return null;
    } catch (error) {
      console.error(`Error fetching chunk embed group for chunk ${parent.chunkId}:`, error);
      return null;
    }
  }

  @Query('itemArchives')
  async getItemArchives(@Args('itemId') itemId: string): Promise<graphql.ItemArchive[]> {
    try {
      const item = await this.libraryItemService.getLibraryItem(itemId);
      if (!item) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }
      
      return item.metadata.archives.map((archive: any): graphql.ItemArchive => ({
        fileType: archive.fileType,
        fileSize: archive.fileSize,
        fileHash: archive.fileHash,
        addDate: archive.addDate.toISOString(),
        s3Key: archive.s3Key,
        pageCount: archive.pageCount,
        wordCount: archive.wordCount || null
      }));
    } catch (error) {
      console.error(`Error fetching archives for item ${itemId}:`, error);
      throw new Error(`Failed to fetch archives: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @Query('signedUploadUrl')
  async getSignedUploadUrl(
    @Args('request') request: graphql.RegisterPdfUploadUrlRequest
  ): Promise<graphql.SignedS3UploadResult> {
    try {
      const result = await this.libraryItemService.getPdfUploadUrl({
        fileName: request.fileName
      });

      return {
        uploadUrl: result.uploadUrl,
        s3Key: result.s3Key,
        expiresAt: result.expiresAt
      };

    } catch (error) {
      throw error;
    }
  }

  @Mutation('createLibraryItem')
  async createLibraryItem(@Args('title') title: string): Promise<graphql.LibraryItemMetadata> {
    try {
      const createLibraryItemDto: CreateLibraryItemDto = {
        title,
        authors: [],
        tags: [],
        collections: []
      };
      
      const newItem = await this.libraryItemService.createLibraryItem(createLibraryItemDto);
      
      // Return the item in the format expected by the GraphQL schema
      return this.transformLibraryItemToMetadata(newItem);
    } catch (error) {
      console.error('Error creating library item:', error);
      throw new Error(`Failed to create library item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @Mutation('createChunkEmbedGroup')
  async createChunkEmbedGroup(@Args('input') input: graphql.CreateChunkEmbedGroupInput): Promise<graphql.ChunkEmbedGroup> {
    try {
      const newGroup = await this.libraryItemService.createChunkEmbedGroup(input);
      
      // Return the group in the format expected by the GraphQL schema
      return this.transformChunkEmbedGroup(newGroup);
    } catch (error) {
      console.error('Error creating chunk embed group:', error);
      throw new Error(`Failed to create chunk embed group: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}