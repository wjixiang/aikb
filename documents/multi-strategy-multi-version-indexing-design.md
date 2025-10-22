# Multi-Strategy Multi-Version Indexing Architecture Design

## Executive Summary

This document outlines the architecture design for supporting multiple chunking strategies and embedding models with versioning capabilities. The design enables semantic search across different indexing approaches while maintaining backward compatibility and allowing incremental updates without requiring complete reindexing.

## Current Architecture Analysis

### Existing Components

1. **Chunking System**
   - Strategy pattern with `ChunkingManager` managing multiple strategies
   - Current strategies: `H1ChunkingStrategy`, `ParagraphChunkingStrategy`
   - Unified interface through `ChunkingStrategy` base class

2. **Embedding System**
   - Provider pattern with `EmbeddingManager` managing multiple providers
   - Current providers: `OpenAI`, `Alibaba`, `ONNX`
   - Singleton instance for centralized management

3. **Storage System**
   - Elasticsearch-based vector storage for entities and knowledge
   - Separate indices: `entity_vectors`, `knowledge_vectors`
   - Current `ItemChunk` interface with single embedding field

4. **Processing Pipeline**
   - RabbitMQ-based async processing
   - Worker pattern for chunking and embedding operations
   - Status tracking with retry mechanisms

### Current Limitations

1. **Single Version Support**: Each item has only one set of chunks and embeddings
2. **Strategy Coupling**: Chunking strategy and embedding model are tightly coupled
3. **No Versioning**: Cannot maintain multiple versions of the same content with different processing approaches
4. **Limited Search Flexibility**: Cannot search across different strategy combinations

## New Architecture Design

### 1. Data Structure Design

#### Enhanced ItemChunk Interface

```typescript
export interface ItemChunk {
  id: string;
  itemId: string; // Reference to the parent book item
  
  // Multi-version support
  denseVectorIndexGroupId: string; // Group identifier for this chunking/embedding combination
  version: string; // Version identifier for this specific combination
  
  // Content and metadata
  title: string;
  content: string;
  index: number; // Position in the document
  
  // Multi-embedding support
  embeddings: {
    [provider: string]: number[]; // Provider name -> embedding vector
  };
  
  // Strategy and configuration metadata
  strategyMetadata: {
    chunkingStrategy: string; // e.g., 'h1', 'paragraph', 'semantic'
    chunkingConfig: ChunkingConfig; // Original chunking configuration
    embeddingProvider: EmbeddingProvider; // Uses EmbeddingProvider enum: OPENAI, ALIBABA, ONNX
    embeddingConfig: EmbeddingConfig; // Original embedding configuration
    processingTimestamp: Date;
    processingDuration: number;
  };
  
  // Additional metadata
  metadata?: {
    chunkType?: string;
    startPosition?: number;
    endPosition?: number;
    wordCount?: number;
    // Additional strategy-specific metadata
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### ChunkingEmbeddingGroup Configuration

```typescript
export interface ChunkingEmbeddingGroup {
  id: string; // Unique identifier for this group
  name: string; // Human-readable name
  description?: string;
  
  // Strategy and model configuration
  chunkingStrategy: string;
  chunkingConfig: ChunkingConfig;
  embeddingProvider: EmbeddingProvider; // Uses EmbeddingProvider enum: OPENAI, ALIBABA, ONNX
  embeddingConfig: EmbeddingConfig;
  
  // Versioning
  version: string;
  isDefault: boolean; // Whether this is the default group for new items
  isActive: boolean; // Whether this group is currently active
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // User or system that created this group
  tags?: string[]; // For categorization and filtering
}
```

#### Enhanced Search Filter

```typescript
export interface ChunkSearchFilter {
  query?: string;
  itemId?: string;
  itemIds?: string[];
  
  // Multi-version filtering
  denseVectorIndexGroupId?: string; // Specific group to search in
  groups?: string[]; // Multiple groups to search across
  version?: string; // Specific version to search
  versions?: string[]; // Multiple versions to search across
  
  // Strategy filtering
  chunkingStrategies?: string[]; // Filter by chunking strategies
  embeddingProviders?: string[]; // Filter by embedding providers
  
  // Similarity search
  similarityThreshold?: number;
  limit?: number;
  
  // Additional filters
  metadataFilters?: Record<string, any>; // Generic metadata filtering
  dateRange?: {
    start: Date;
    end: Date;
  };
}
```

### 2. Interface Design

#### MultiVersionChunkingManager

```typescript
export class MultiVersionChunkingManager {
  private groups: Map<string, ChunkingEmbeddingGroup> = new Map();
  private activeGroups: Map<string, ChunkingEmbeddingGroup> = new Map();
  private defaultGroupId: string | null = null;
  
  /**
   * Create a new chunking/embedding group
   */
  createGroup(group: Omit<ChunkingEmbeddingGroup, 'id' | 'createdAt' | 'updatedAt'>): ChunkingEmbeddingGroup;
  
  /**
   * Update an existing group
   */
  updateGroup(groupId: string, updates: Partial<ChunkingEmbeddingGroup>): ChunkingEmbeddingGroup;
  
  /**
   * Delete a group (soft delete by marking as inactive)
   */
  deleteGroup(groupId: string): boolean;
  
  /**
   * Set a group as default
   */
  setDefaultGroup(groupId: string): void;
  
  /**
   * Get all active groups
   */
  getActiveGroups(): ChunkingEmbeddingGroup[];
  
  /**
   * Get a specific group
   */
  getGroup(groupId: string): ChunkingEmbeddingGroup | null;
  
  /**
   * Process item chunks with a specific group
   */
  processItemWithGroup(itemId: string, groupId: string): Promise<ItemChunk[]>;
  
  /**
   * Process item chunks with custom configuration
   */
  processItemWithConfig(
    itemId: string,
    chunkingStrategy: string,
    chunkingConfig: ChunkingConfig,
    embeddingProvider: EmbeddingProvider, // Uses EmbeddingProvider enum: OPENAI, ALIBABA, ONNX
    embeddingConfig: EmbeddingConfig
  ): Promise<ItemChunk[]>;
  
  /**
   * Get available strategies for a group
   */
  getAvailableStrategies(groupId: string): string[];
  
  /**
   * Get available providers for a group
   */
  getAvailableProviders(groupId: string): string[];
}
```

#### MultiVersionVectorStorage

```typescript
export class MultiVersionVectorStorage {
  private client: Client;
  private readonly indexName = 'multi_version_chunks';
  
  /**
   * Store chunks with versioning information
   */
  async storeChunks(chunks: ItemChunk[]): Promise<void>;
  
  /**
   * Get chunks for a specific item and group
   */
  async getChunksByItemAndGroup(itemId: string, groupId: string): Promise<ItemChunk[]>;
  
  /**
   * Get chunks for a specific item across all groups
   */
  async getChunksByItem(itemId: string): Promise<ItemChunk[]>;
  
  /**
   * Search chunks with multi-version support
   */
  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]>;
  
  /**
   * Find similar chunks across multiple groups
   */
  async findSimilarChunks(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: EmbeddingProvider // Uses EmbeddingProvider enum: OPENAI, ALIBABA, ONNX
  ): Promise<Array<ItemChunk & { similarity: number }>>;
  
  /**
   * Get available groups for an item
   */
  async getAvailableGroups(itemId: string): Promise<string[]>;
  
  /**
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<{
    chunkCount: number;
    averageChunkSize: number;
    processingTime: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  
  /**
   * Delete chunks for a specific group (soft delete)
   */
  async deleteChunksByGroup(groupId: string): Promise<number>;
}
```

#### Enhanced RabbitMQ Messages

```typescript
export interface MultiVersionChunkingEmbeddingRequestMessage extends BaseRabbitMQMessage {
  eventType: 'MULTI_VERSION_CHUNKING_EMBEDDING_REQUEST';
  itemId: string;
  markdownContent?: string;
  
  // Multi-version support
  groupId?: string; // Use existing group
  groupConfig?: ChunkingEmbeddingGroup; // Create new group with this config
  
  // Processing options
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;
  
  // Version control
  forceReprocess?: boolean; // Force reprocessing even if chunks exist
  preserveExisting?: boolean; // Keep existing chunks from other groups
}

export interface MultiVersionChunkingEmbeddingProgressMessage extends BaseRabbitMQMessage {
  eventType: 'MULTI_VERSION_CHUNKING_EMBEDDING_PROGRESS';
  itemId: string;
  groupId?: string;
  status: PdfProcessingStatus;
  progress: number;
  message?: string;
  chunksProcessed?: number;
  totalChunks?: number;
  currentGroup?: string;
  totalGroups?: number;
}

export interface MultiVersionChunkingEmbeddingCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'MULTI_VERSION_CHUNKING_EMBEDDING_COMPLETED';
  itemId: string;
  groupId: string;
  status: PdfProcessingStatus.COMPLETED;
  chunksCount: number;
  processingTime: number;
  strategy: string;
  provider: string;
  version: string;
}
```

### 3. Implementation Strategy

#### Phase 1: Core Infrastructure

1. **Enhanced Data Models**
   - Update `ItemChunk` interface with multi-version fields
   - Create `ChunkingEmbeddingGroup` interface
   - Update search filters to support multi-version queries

2. **Storage Layer Updates**
   - Modify Elasticsearch mappings to support versioning
   - Implement `MultiVersionVectorStorage` class
   - Add migration scripts for existing data

3. **Manager Layer**
   - Create `MultiVersionChunkingManager` class
   - Enhance `EmbeddingManager` to support version-specific configurations
   - Update `ChunkingManager` to work with versioned groups

#### Phase 2: Processing Pipeline

1. **RabbitMQ Message Updates**
   - Add multi-version message types
   - Update `ChunkingEmbeddingWorker` to handle multi-version requests
   - Implement group-based processing logic

2. **Worker Enhancements**
   - Support multiple groups per item
   - Implement selective reprocessing
   - Add progress tracking for multi-group operations

3. **Status Tracking**
   - Enhance status tracking to support group-level status
   - Implement group-specific completion tracking
   - Add rollback mechanisms for failed groups

#### Phase 3: Search and Retrieval

1. **Search Interface**
   - Implement multi-version search methods
   - Add cross-group similarity search
   - Support filtering by strategy and provider combinations

2. **Performance Optimization**
   - Implement caching for frequently accessed groups
   - Add indexing strategies for multi-version queries
   - Optimize vector search across multiple groups

3. **Analytics and Monitoring**
   - Add group usage statistics
   - Implement performance monitoring per group
   - Add cost tracking per embedding provider

### 4. Backward Compatibility Considerations

#### Data Migration Strategy

1. **Legacy Data Handling**
   - Create a default group for existing items
   - Migrate existing chunks to the new format
   - Maintain backward compatibility in search interfaces

2. **API Compatibility**
   - Keep existing API endpoints functional
   - Add new endpoints for multi-version features
   - Implement feature flags for gradual rollout

3. **Search Compatibility**
   - Ensure existing search queries continue to work
   - Add new search capabilities without breaking changes
   - Implement fallback mechanisms for legacy data

#### Migration Process

1. **Preparation Phase**
   - Backup existing data
   - Create migration scripts
   - Test migration in staging environment

2. **Execution Phase**
   - Run migration scripts to update data structure
   - Update application code to support new features
   - Monitor migration progress and resolve issues

3. **Validation Phase**
   - Verify data integrity after migration
   - Test all search and processing functionality
   - Monitor performance and adjust as needed

### 5. Search and Retrieval Mechanisms

#### Multi-Version Search Strategies

1. **Single Group Search**
   - Search within a specific chunking/embedding group
   - Use existing vector search optimizations
   - Support strategy-specific filtering

2. **Cross-Group Search**
   - Search across multiple groups with different strategies
   - Implement rank fusion for results from different groups
   - Support weighted combination of results

3. **Hybrid Search**
   - Combine keyword search with vector search across groups
   - Implement relevance scoring across different strategies
   - Support result diversification strategies

#### Similarity Search Implementation

```typescript
export class MultiVersionSimilaritySearch {
  /**
   * Find similar chunks across multiple groups
   */
  async findSimilarAcrossGroups(
    queryVector: number[],
    options: {
      groups?: string[];
      providers?: string[];
      strategies?: string[];
      similarityThreshold?: number;
      limit?: number;
      rankFusion?: boolean;
      weights?: Record<string, number>; // Group-specific weights
    }
  ): Promise<Array<{
    chunk: ItemChunk;
    similarity: number;
    group: string;
    rank: number;
  }>>;
  
  /**
   * Rank fusion for results from multiple groups
   */
  private async rankFusion(
    results: Array<{
      chunk: ItemChunk;
      similarity: number;
      group: string;
    }>,
    weights?: Record<string, number>
  ): Promise<Array<{
    chunk: ItemChunk;
    similarity: number;
    group: string;
    rank: number;
  }>>;
  
  /**
   * Normalize similarity scores across different providers
   */
  private normalizeSimilarity(
    results: Array<{
      chunk: ItemChunk;
      similarity: number;
      group: string;
    }>
  ): Array<{
    chunk: ItemChunk;
    similarity: number;
    group: string;
  }>;
}
```

### 6. Performance and Scalability Considerations

#### Indexing Strategy

1. **Elasticsearch Index Design**
   - Use composite indices for efficient multi-version queries
   - Implement proper mapping for version and group fields
   - Add aggregations for group statistics

2. **Vector Search Optimization**
   - Implement HNSW indexing for efficient similarity search
   - Use quantization techniques for memory efficiency
   - Implement sharding strategies for large datasets

3. **Caching Strategy**
   - Implement Redis caching for frequently accessed groups
   - Add query result caching for common search patterns
   - Implement pre-computed aggregations for statistics

#### Processing Optimization

1. **Batch Processing**
   - Implement batch processing for multiple items
   - Use parallel processing for different groups
   - Implement priority queues for urgent requests

2. **Resource Management**
   - Implement concurrency limits per embedding provider
   - Add rate limiting for API calls
   - Implement memory management for large processing jobs

3. **Monitoring and Alerting**
   - Add performance metrics for each group
   - Implement cost tracking for embedding providers
   - Add alerts for processing failures or performance degradation

### 7. Security and Access Control

#### Access Control

1. **Group-Level Permissions**
   - Implement role-based access control for groups
   - Support user-specific group visibility
   - Add group ownership and sharing capabilities

2. **Data Protection**
   - Implement encryption for sensitive embeddings
   - Add access logging for all operations
   - Implement data retention policies

#### Audit and Compliance

1. **Operation Logging**
   - Log all group creation and modification operations
   - Track access patterns and usage statistics
   - Implement audit trails for compliance

2. **Data Governance**
   - Implement data lineage tracking for groups
   - Add data quality checks for embeddings
   - Support data export and backup capabilities

### 8. Testing Strategy

#### Unit Testing

1. **Core Functionality**
   - Test group creation and management
   - Test chunking with different strategies
   - Test embedding generation with different providers

2. **Search Functionality**
   - Test single group search
   - Test cross-group search
   - Test rank fusion algorithms

#### Integration Testing

1. **End-to-End Testing**
   - Test complete processing pipeline
   - Test search functionality with real data
   - Test migration and backward compatibility

2. **Performance Testing**
   - Test with large datasets
   - Test concurrent processing
   - Test search performance under load

#### User Acceptance Testing

1. **Feature Validation**
   - Validate multi-version search capabilities
   - Test user interface for group management
   - Test integration with existing workflows

### 9. Deployment and Operations

#### Deployment Strategy

1. **Rollout Plan**
   - Deploy infrastructure components first
   - Deploy data migration scripts
   - Gradually roll out new features

2. **Monitoring and Maintenance**
   - Implement comprehensive monitoring
   - Add automated scaling capabilities
   - Implement backup and disaster recovery

#### Documentation and Training

1. **Technical Documentation**
   - Create API documentation for new interfaces
   - Document migration procedures
   - Provide troubleshooting guides

2. **User Documentation**
   - Create user guides for multi-version features
   - Provide best practices for group management
   - Add examples and use cases

## Conclusion

This architecture design provides a comprehensive solution for supporting multiple chunking strategies and embedding models with versioning capabilities. The design maintains backward compatibility while enabling advanced search capabilities across different processing approaches. The implementation is phased to ensure smooth migration and minimal disruption to existing functionality.

The key benefits of this architecture include:

1. **Flexibility**: Support for multiple chunking and embedding strategies
2. **Version Control**: Ability to maintain multiple versions of the same content
3. **Search Enhancement**: Advanced search capabilities across different strategies
4. **Backward Compatibility**: Seamless integration with existing systems
5. **Scalability**: Optimized for performance and resource efficiency
6. **Extensibility**: Easy to add new strategies and providers in the future

This design provides a solid foundation for implementing a sophisticated multi-strategy, multi-version indexing system that can evolve with changing requirements and technologies.