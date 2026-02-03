import type {
    ReviewIndex,
    DatabaseIdentifier,
    DatabaseSource,
    ReviewType,
    PublicationStatus,
    EvidenceQuality,
    QualityRating,
    ReviewSearchFilters,
    ReviewSortOptions,
    ReviewSearchResult,
    PaginationOptions,
    SyncJob,
    SyncJobStatus,
    SyncConfig,
    DatabaseSyncConfig,
    ReviewIndexStats,
    ExportResult,
    ExportOptions,
} from './types.js';

/**
 * Storage configuration options
 */
export interface ReviewStorageConfig {
    /** Connection string or configuration for the storage backend */
    connectionString?: string;

    /** Maximum pool size for database connections */
    maxPoolSize?: number;

    /** Connection timeout in milliseconds */
    connectionTimeout?: number;

    /** Query timeout in milliseconds */
    queryTimeout?: number;

    /** Enable query logging */
    enableLogging?: boolean;

    /** Enable query performance monitoring */
    enableProfiling?: boolean;

    /** Custom initialization options for specific storage implementations */
    customOptions?: Record<string, unknown>;
}

/**
 * Result of a bulk operation
 */
export interface BulkOperationResult {
    /** Number of successful operations */
    successCount: number;

    /** Number of failed operations */
    failureCount: number;

    /** IDs of successfully processed items */
    successIds: string[];

    /** Errors from failed operations */
    errors: Array<{ id: string; error: string }>;
}

/**
 * Result of an upsert operation
 */
export interface UpsertResult {
    /** The review ID */
    id: string;

    /** Whether the review was created (true) or updated (false) */
    created: boolean;

    /** The review data */
    review: ReviewIndex;
}

/**
 * Duplicate detection result
 */
export interface DuplicateDetectionResult {
    /** Whether duplicates were found */
    hasDuplicates: boolean;

    /** List of potential duplicate reviews with similarity scores */
    potentialDuplicates: Array<{
        reviewId: string;
        title: string;
        similarity: number;
    }>;

    /** Confidence level of the detection (0-1) */
    confidence: number;
}

/**
 * Version history entry
 */
export interface ReviewVersion {
    /** Version identifier */
    version: string;

    /** The review data at this version */
    review: ReviewIndex;

    /** When this version was created */
    createdAt: Date;

    /** Reason for the version change */
    changeReason?: string;

    /** User or system that created this version */
    changedBy?: string;
}

/**
 * Storage interface for ReviewIndex operations
 * This interface provides CRUD operations and advanced queries for systematic reviews
 */
export interface IReviewStorage {
    // ============================================================================
    // CRUD Operations
    // ============================================================================

    /**
     * Create a new review in storage
     * @param review The review data to create (without id, as it will be generated)
     * @returns Promise resolving to the created review with generated ID
     */
    create(review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReviewIndex>;

    /**
     * Retrieve a review by ID
     * @param id The review ID
     * @returns Promise resolving to the review data or null if not found
     */
    findById(id: string): Promise<ReviewIndex | null>;

    /**
     * Retrieve multiple reviews by their IDs
     * @param ids Array of review IDs
     * @returns Promise resolving to array of reviews (null for not found reviews)
     */
    findByIds(ids: string[]): Promise<(ReviewIndex | null)[]>;

    // /**
    //  * Retrieve multiple review by semantic similarity
    //  * @param chunkEmbedToken Indentifier of chunking & embedding strategy
    //  * @param text Content to perfrom semantic search
    //  */
    // findBySemanticMatch(chunkEmbedToken: string, text: string): Promise<(ReviewIndex | null)[]>;

    /**
     * Update an existing review
     * @param id The review ID to update
     * @param updates Partial review data to update
     * @returns Promise resolving to the updated review or null if not found
     */
    update(id: string, updates: Partial<Omit<ReviewIndex, 'id' | 'createdAt'>>): Promise<ReviewIndex | null>;

    /**
     * Delete a review by ID
     * @param id The review ID to delete
     * @param options Optional delete options like soft delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    delete(
        id: string,
        options?: {
            /** Perform soft delete instead of hard delete */
            soft?: boolean;
        },
    ): Promise<boolean>;

    /**
     * Upsert a review (create if not exists, update if exists)
     * Uses database IDs to determine if review already exists
     * @param review The review data to upsert
     * @param options Options for upsert operation
     * @returns Promise resolving to upsert result with created flag
     */
    upsert(
        review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>,
        options?: {
            /** Match by database IDs instead of internal ID */
            matchByDatabaseIds?: boolean;
            /** Force update even if content hash matches */
            forceUpdate?: boolean;
        },
    ): Promise<UpsertResult>;

    /**
     * Bulk upsert multiple reviews
     * @param reviews Array of reviews to upsert
     * @param options Options for bulk upsert operation
     * @returns Promise resolving to bulk operation result
     */
    bulkUpsert(
        reviews: Array<Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>>,
        options?: {
            /** Continue on error instead of failing entire batch */
            continueOnError?: boolean;
            /** Batch size for processing */
            batchSize?: number;
        },
    ): Promise<BulkOperationResult>;

    // ============================================================================
    // Query Operations
    // ============================================================================

    /**
     * Search reviews with filters, sorting, and pagination
     * @param filters Search filters to apply
     * @param sort Sort options
     * @param pagination Pagination options
     * @returns Promise resolving to search result with reviews and metadata
     */
    search(
        filters: ReviewSearchFilters,
        sort?: ReviewSortOptions,
        pagination?: PaginationOptions,
    ): Promise<ReviewSearchResult>;

    /**
     * Full-text search across review titles, abstracts, and keywords
     * @param query The search query
     * @param options Optional search parameters
     * @returns Promise resolving to search result with reviews and metadata
     */
    fullTextSearch(
        query: string,
        options?: {
            filters?: ReviewSearchFilters;
            sort?: ReviewSortOptions;
            pagination?: PaginationOptions;
            /** Minimum relevance score threshold (0-1) */
            minScore?: number;
        },
    ): Promise<ReviewSearchResult>;

    /**
     * Find reviews by database identifier
     * @param databaseId The database identifier to search for
     * @returns Promise resolving to array of matching reviews
     */
    findByDatabaseId(databaseId: DatabaseIdentifier): Promise<ReviewIndex[]>;

    /**
     * Find reviews by DOI
     * @param doi The DOI to search for
     * @returns Promise resolving to array of matching reviews
     */
    findByDoi(doi: string): Promise<ReviewIndex[]>;

    /**
     * Find reviews by PMID
     * @param pmid The PMID to search for
     * @returns Promise resolving to array of matching reviews
     */
    findByPmid(pmid: string): Promise<ReviewIndex[]>;

    /**
     * Find reviews by Cochrane ID
     * @param cochraneId The Cochrane ID to search for
     * @returns Promise resolving to array of matching reviews
     */
    findByCochraneId(cochraneId: string): Promise<ReviewIndex[]>;

    /**
     * Find reviews by database source
     * @param source The database source
     * @returns Promise resolving to array of reviews from that database
     */
    findByDatabaseSource(source: DatabaseSource): Promise<ReviewIndex[]>;

    /**
     * Find reviews by type
     * @param type The review type
     * @returns Promise resolving to array of reviews of that type
     */
    findByReviewType(type: ReviewType): Promise<ReviewIndex[]>;

    /**
     * Find reviews by publication status
     * @param status The publication status
     * @returns Promise resolving to array of reviews with that status
     */
    findByPublicationStatus(status: PublicationStatus): Promise<ReviewIndex[]>;

    /**
     * Find reviews by evidence quality
     * @param quality The evidence quality
     * @returns Promise resolving to array of reviews with that quality
     */
    findByEvidenceQuality(quality: EvidenceQuality): Promise<ReviewIndex[]>;

    /**
     * Find reviews by quality rating
     * @param rating The quality rating
     * @returns Promise resolving to array of reviews with that rating
     */
    findByQualityRating(rating: QualityRating): Promise<ReviewIndex[]>;

    /**
     * Find reviews by MeSH term
     * @param meshTerm The MeSH term to search for
     * @returns Promise resolving to array of reviews with that MeSH term
     */
    findByMeshTerm(meshTerm: string): Promise<ReviewIndex[]>;

    /**
     * Find reviews by keyword
     * @param keyword The keyword to search for
     * @returns Promise resolving to array of reviews with that keyword
     */
    findByKeyword(keyword: string): Promise<ReviewIndex[]>;

    /**
     * Find reviews by author
     * @param authorName The author name to search for
     * @returns Promise resolving to array of reviews by that author
     */
    findByAuthor(authorName: string): Promise<ReviewIndex[]>;

    /**
     * Find reviews by journal
     * @param journalName The journal name to search for
     * @returns Promise resolving to array of reviews from that journal
     */
    findByJournal(journalName: string): Promise<ReviewIndex[]>;

    /**
     * Get all reviews with pagination
     * @param pagination Pagination options
     * @returns Promise resolving to paginated reviews and total count
     */
    findAll(pagination?: PaginationOptions): Promise<ReviewSearchResult>;

    /**
     * Count reviews matching filters
     * @param filters Optional filters to apply
     * @returns Promise resolving to count of matching reviews
     */
    count(filters?: ReviewSearchFilters): Promise<number>;

    /**
     * Check if a review exists
     * @param id The review ID
     * @returns Promise resolving to true if review exists
     */
    exists(id: string): Promise<boolean>;

    // ============================================================================
    // Duplicate Detection
    // ============================================================================

    /**
     * Detect potential duplicate reviews
     * @param review The review to check for duplicates
     * @param options Options for duplicate detection
     * @returns Promise resolving to duplicate detection result
     */
    detectDuplicates(
        review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>,
        options?: {
            /** Similarity threshold for considering reviews as duplicates (0-1) */
            threshold?: number;
            /** Maximum number of potential duplicates to return */
            maxResults?: number;
        },
    ): Promise<DuplicateDetectionResult>;

    /**
     * Find all potential duplicate pairs in the database
     * @param options Options for batch duplicate detection
     * @returns Promise resolving to array of duplicate pairs
     */
    findAllDuplicatePairs(options?: {
        /** Similarity threshold (0-1) */
        threshold?: number;
        /** Limit number of results */
        limit?: number;
    }): Promise<Array<{ review1: ReviewIndex; review2: ReviewIndex; similarity: number }>>;

    /**
     * Mark two reviews as duplicates of each other
     * @param reviewId1 First review ID
     * @param reviewId2 Second review ID
     * @returns Promise resolving to true if marked successfully
     */
    markAsDuplicates(reviewId1: string, reviewId2: string): Promise<boolean>;

    /**
     * Unmark two reviews as duplicates
     * @param reviewId1 First review ID
     * @param reviewId2 Second review ID
     * @returns Promise resolving to true if unmarked successfully
     */
    unmarkAsDuplicates(reviewId1: string, reviewId2: string): Promise<boolean>;

    // ============================================================================
    // Version History
    // ============================================================================

    /**
     * Get version history for a review
     * @param id The review ID
     * @param options Options for retrieving versions
     * @returns Promise resolving to array of version history entries
     */
    getVersionHistory(
        id: string,
        options?: {
            /** Maximum number of versions to return */
            limit?: number;
            /** Include full review data for each version */
            includeFullData?: boolean;
        },
    ): Promise<ReviewVersion[]>;

    /**
     * Get a specific version of a review
     * @param id The review ID
     * @param version The version identifier
     * @returns Promise resolving to the review at that version or null if not found
     */
    getVersion(id: string, version: string): Promise<ReviewIndex | null>;

    /**
     * Restore a review to a previous version
     * @param id The review ID
     * @param version The version to restore to
     * @param reason Reason for the restoration
     * @returns Promise resolving to the restored review or null if not found
     */
    restoreVersion(id: string, version: string, reason?: string): Promise<ReviewIndex | null>;

    /**
     * Delete old versions of a review
     * @param id The review ID
     * @param options Options for version cleanup
     * @returns Promise resolving to number of versions deleted
     */
    deleteOldVersions(
        id: string,
        options?: {
            /** Keep only the most recent N versions */
            keepCount?: number;
            /** Delete versions older than this date */
            olderThan?: Date;
        },
    ): Promise<number>;

    // ============================================================================
    // Statistics and Analytics
    // ============================================================================

    /**
     * Get overall statistics about the review index
     * @returns Promise resolving to review index statistics
     */
    getStats(): Promise<ReviewIndexStats>;

    /**
     * Get aggregated statistics by a specific field
     * @param field The field to aggregate by
     * @param options Optional aggregation options
     * @returns Promise resolving to aggregated counts
     */
    getAggregatedStats(
        field:
            | 'reviewType'
            | 'publicationStatus'
            | 'evidenceQuality'
            | 'qualityRating'
            | 'databaseSource'
            | 'journal',
        options?: {
            /** Date range filter */
            dateRange?: { start: Date; end: Date };
            /** Additional filters to apply */
            filters?: ReviewSearchFilters;
        },
    ): Promise<Record<string, number>>;

    /**
     * Get time series data for review additions/updates
     * @param options Options for time series query
     * @returns Promise resolving to time series data points
     */
    getTimeSeriesData(options?: {
        /** Start date for the time series */
        start?: Date;
        /** End date for the time series */
        end?: Date;
        /** Interval for grouping (e.g., 'day', 'week', 'month', 'year') */
        interval?: 'day' | 'week' | 'month' | 'year';
        /** Field to track (e.g., 'createdAt', 'updatedAt', 'publicationDate') */
        field?: 'createdAt' | 'updatedAt' | 'publicationDate';
    }): Promise<Array<{ date: Date; count: number }>>;

    // ============================================================================
    // Export Operations
    // ============================================================================

    /**
     * Export reviews to a specified format
     * @param options Export options including format, filters, and fields
     * @returns Promise resolving to export result with download URL
     */
    exportReviews(options: ExportOptions): Promise<ExportResult>;

    /**
     * Get export status by ID
     * @param exportId The export ID
     * @returns Promise resolving to export result or null if not found
     */
    getExportStatus(exportId: string): Promise<ExportResult | null>;

    /**
     * Delete an export
     * @param exportId The export ID
     * @returns Promise resolving to true if deleted successfully
     */
    deleteExport(exportId: string): Promise<boolean>;

    // ============================================================================
    // Maintenance Operations
    // ============================================================================

    /**
     * Rebuild search indexes
     * @param options Options for index rebuild
     * @returns Promise resolving when rebuild is complete
     */
    rebuildSearchIndexes(options?: {
        /** Rebuild only specific indexes */
        indexes?: string[];
    }): Promise<void>;

    /**
     * Optimize storage (e.g., vacuum, compact, etc.)
     * @returns Promise resolving when optimization is complete
     */
    optimizeStorage(): Promise<void>;

    /**
     * Validate data integrity
     * @returns Promise resolving to validation report
     */
    validateDataIntegrity(): Promise<{
        /** Whether validation passed */
        valid: boolean;

        /** Number of records checked */
        recordsChecked: number;

        /** Number of issues found */
        issuesFound: number;

        /** Details of issues found */
        issues: Array<{
            recordId: string;
            issue: string;
            severity: 'error' | 'warning';
        }>;
    }>;

    /**
     * Get storage health status
     * @returns Promise resolving to health status
     */
    getHealthStatus(): Promise<{
        /** Whether storage is healthy */
        healthy: boolean;

        /** Connection status */
        connected: boolean;

        /** Latency in milliseconds */
        latency?: number;

        /** Number of active connections */
        activeConnections?: number;

        /** Storage usage information */
        storageUsage?: {
            used: number;
            total: number;
            percentage: number;
        };

        /** Additional health metrics */
        metrics?: Record<string, unknown>;
    }>;

    /**
     * Initialize storage (create tables, indexes, etc.)
     * @returns Promise resolving when initialization is complete
     */
    initialize(): Promise<void>;

    /**
     * Close storage connection and cleanup resources
     * @returns Promise resolving when cleanup is complete
     */
    close(): Promise<void>;
}

/**
 * Storage interface for SyncJob operations
 * This interface manages synchronization job tracking and execution
 */
export interface ISyncJobStorage {
    /**
     * Create a new sync job
     * @param job The sync job data to create (without id, createdAt)
     * @returns Promise resolving to the created sync job with generated ID
     */
    create(job: Omit<SyncJob, 'id' | 'createdAt'>): Promise<SyncJob>;

    /**
     * Retrieve a sync job by ID
     * @param id The job ID
     * @returns Promise resolving to the sync job or null if not found
     */
    findById(id: string): Promise<SyncJob | null>;

    /**
     * Update a sync job
     * @param id The job ID to update
     * @param updates Partial job data to update
     * @returns Promise resolving to the updated job or null if not found
     */
    update(id: string, updates: Partial<Omit<SyncJob, 'id' | 'createdAt'>>): Promise<SyncJob | null>;

    /**
     * Delete a sync job
     * @param id The job ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    delete(id: string): Promise<boolean>;

    /**
     * Find sync jobs by status
     * @param status The job status
     * @returns Promise resolving to array of jobs with that status
     */
    findByStatus(status: SyncJobStatus): Promise<SyncJob[]>;

    /**
     * Find sync jobs by database source
     * @param database The database source
     * @returns Promise resolving to array of jobs for that database
     */
    findByDatabase(database: DatabaseSource): Promise<SyncJob[]>;

    /**
     * Find sync jobs by date range
     * @param start Start date
     * @param end End date
     * @returns Promise resolving to array of jobs in that date range
     */
    findByDateRange(start: Date, end: Date): Promise<SyncJob[]>;

    /**
     * Get the most recent sync job for a database
     * @param database The database source
     * @returns Promise resolving to the most recent job or null if none found
     */
    findMostRecentByDatabase(database: DatabaseSource): Promise<SyncJob | null>;

    /**
     * Get all sync jobs with pagination
     * @param options Pagination options
     * @returns Promise resolving to paginated jobs and total count
     */
    findAll(options?: {
        page?: number;
        pageSize?: number;
        status?: SyncJobStatus;
        database?: DatabaseSource;
    }): Promise<{ jobs: SyncJob[]; total: number }>;

    /**
     * Count sync jobs by status
     * @returns Promise resolving to count of jobs by status
     */
    countByStatus(): Promise<Record<SyncJobStatus, number>>;

    /**
     * Delete old sync jobs
     * @param options Options for cleanup
     * @returns Promise resolving to number of jobs deleted
     */
    deleteOldJobs(options?: {
        /** Delete jobs older than this date */
        olderThan?: Date;
        /** Delete only jobs with specific statuses */
        statuses?: SyncJobStatus[];
    }): Promise<number>;

    /**
     * Get sync job statistics
     * @returns Promise resolving to sync job statistics
     */
    getStats(): Promise<{
        /** Total number of jobs */
        total: number;

        /** Number of jobs by status */
        byStatus: Record<SyncJobStatus, number>;

        /** Number of jobs by database */
        byDatabase: Record<DatabaseSource, number>;

        /** Average job duration in milliseconds */
        averageDuration?: number;

        /** Success rate (0-1) */
        successRate?: number;
    }>;
}

/**
 * Storage interface for SyncConfig operations
 * This interface manages synchronization configuration
 */
export interface ISyncConfigStorage {
    /**
     * Get the current sync configuration
     * @returns Promise resolving to the sync configuration or null if not set
     */
    getConfig(): Promise<SyncConfig | null>;

    /**
     * Save or update the sync configuration
     * @param config The sync configuration to save
     * @returns Promise resolving to the saved configuration
     */
    saveConfig(config: SyncConfig): Promise<SyncConfig>;

    /**
     * Get configuration for a specific database
     * @param source The database source
     * @returns Promise resolving to the database config or null if not found
     */
    getDatabaseConfig(source: DatabaseSource): Promise<DatabaseSyncConfig | null>;

    /**
     * Update configuration for a specific database
     * @param source The database source
     * @param config The database configuration to update
     * @returns Promise resolving to the updated configuration
     */
    updateDatabaseConfig(source: DatabaseSource, config: DatabaseSyncConfig): Promise<DatabaseSyncConfig>;

    /**
     * Enable or disable a database for sync
     * @param source The database source
     * @param enabled Whether to enable or disable
     * @returns Promise resolving to the updated configuration
     */
    toggleDatabase(source: DatabaseSource, enabled: boolean): Promise<DatabaseSyncConfig>;

    /**
     * Get sync history
     * @param options Options for retrieving history
     * @returns Promise resolving to sync history
     */
    getHistory(options?: {
        /** Start date */
        start?: Date;
        /** End date */
        end?: Date;
        /** Database filter */
        database?: DatabaseSource;
        /** Limit number of results */
        limit?: number;
    }): Promise<Array<{
        timestamp: Date;
        database: DatabaseSource;
        status: SyncJobStatus;
        recordsProcessed: number;
        newRecords: number;
        updatedRecords: number;
        failedRecords: number;
    }>>;

    /**
     * Get configuration version history
     * @returns Promise resolving to array of configuration versions
     */
    getConfigHistory(): Promise<Array<{
        version: number;
        config: SyncConfig;
        updatedAt: Date;
        updatedBy?: string;
    }>>;

    /**
     * Restore configuration to a previous version
     * @param version The version to restore to
     * @returns Promise resolving to the restored configuration
     */
    restoreConfigVersion(version: number): Promise<SyncConfig>;
}

/**
 * Main storage interface that combines all storage operations
 * Implementations should provide all three storage interfaces
 */
export interface ISynthesesStorage {
    /** Review storage operations */
    reviews: IReviewStorage;

    /** Sync job storage operations */
    syncJobs: ISyncJobStorage;

    /** Sync config storage operations */
    syncConfig: ISyncConfigStorage;

    /**
     * Initialize all storage components
     * @param config Storage configuration
     * @returns Promise resolving when initialization is complete
     */
    initialize(config?: ReviewStorageConfig): Promise<void>;

    /**
     * Close all storage connections and cleanup resources
     * @returns Promise resolving when cleanup is complete
     */
    close(): Promise<void>;

    /**
     * Get overall storage health status
     * @returns Promise resolving to health status for all components
     */
    getHealthStatus(): Promise<{
        /** Overall health status */
        healthy: boolean;

        /** Review storage health */
        reviews: Awaited<ReturnType<IReviewStorage['getHealthStatus']>>;

        /** Sync job storage health */
        syncJobs?: {
            healthy: boolean;
            connected: boolean;
        };

        /** Sync config storage health */
        syncConfig?: {
            healthy: boolean;
            connected: boolean;
        };
    }>;
}
