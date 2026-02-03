import type {
    ReviewIndex,
    DatabaseSource,
    DatabaseIdentifier,
    ReviewType,
    PublicationStatus,
    EvidenceQuality,
    SyncJob,
    SyncJobStatus,
    SyncConfig,
    DatabaseSyncConfig,
    FailedSync,
    SyncStatus,
    ReviewUrl,
    Author,
    Journal,
    EligibilityCriteria,
    PICO,
    QualityAssessment,
    RelatedReview,
    ReviewRelationship,
} from '../types.js';
import {
    UrlType,
    AccessLevel,
    AuthorRole,
} from '../types.js';
import type { ISynthesesStorage } from '../storage/storage.js';

/**
 * Raw data from a database source before transformation
 */
export interface RawReviewData {
    /** Database source */
    source: DatabaseSource;

    /** Unique identifier in the source database */
    sourceId: string;

    /** Raw data from the source (could be any format) */
    rawData: unknown;

    /** Optional version identifier */
    version?: string;
}

/**
 * Transformation result from raw data to ReviewIndex
 */
export interface TransformationResult {
    /** The transformed review index */
    review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>;

    /** Any warnings or issues during transformation */
    warnings: string[];

    /** Whether the transformation was successful */
    success: boolean;

    /** Error message if transformation failed */
    error?: string;
}

/**
 * Sync progress callback
 */
export interface SyncProgressCallback {
    (progress: {
        /** Current job ID */
        jobId: string;

        /** Database being synced */
        database: DatabaseSource;

        /** Progress percentage (0-100) */
        progress: number;

        /** Number of records processed */
        processed: number;

        /** Total number of records to process */
        total: number;

        /** Current operation being performed */
        currentOperation: string;

        /** Estimated time remaining (in seconds) */
        estimatedTimeRemaining?: number;
    }): void | Promise<void>;
}

/**
 * Sync result for a single database
 */
export interface DatabaseSyncResult {
    /** Database that was synced */
    database: DatabaseSource;

    /** Whether the sync was successful */
    success: boolean;

    /** Number of records fetched */
    recordsFetched: number;

    /** Number of records successfully transformed */
    recordsTransformed: number;

    /** Number of new records added */
    newRecords: number;

    /** Number of records updated */
    updatedRecords: number;

    /** Number of records that failed */
    failedRecords: number;

    /** Errors that occurred */
    errors: Array<{
        sourceId: string;
        error: string;
    }>;

    /** Warnings that occurred */
    warnings: string[];

    /** Duration of the sync in milliseconds */
    duration: number;
}

/**
 * Overall sync result
 */
export interface SyncResult {
    /** Job ID */
    jobId: string;

    /** Overall success status */
    success: boolean;

    /** Results for each database */
    databaseResults: DatabaseSyncResult[];

    /** Total number of records fetched */
    totalRecordsFetched: number;

    /** Total number of new records added */
    totalNewRecords: number;

    /** Total number of records updated */
    totalUpdatedRecords: number;

    /** Total number of records that failed */
    totalFailedRecords: number;

    /** Overall duration in milliseconds */
    duration: number;

    /** Timestamp when sync started */
    startedAt: Date;

    /** Timestamp when sync completed */
    completedAt: Date;
}

/**
 * Data source adapter interface
 * Each database source should implement this interface to provide data fetching
 */
export interface IDataSourceAdapter {
    /**
     * Get the database source this adapter handles
     */
    getSource(): DatabaseSource;

    /**
     * Fetch reviews from the data source
     * @param options Options for fetching reviews
     * @returns Promise resolving to array of raw review data
     */
    fetchReviews(options?: {
        /** Maximum number of reviews to fetch */
        limit?: number;

        /** Offset for pagination */
        offset?: number;

        /** Date range filter */
        dateRange?: {
            start?: Date;
            end?: Date;
        };

        /** Custom query parameters */
        queryParams?: Record<string, unknown>;

        /** Progress callback */
        onProgress?: (progress: { fetched: number; total?: number }) => void;
    }): Promise<RawReviewData[]>;

    /**
     * Fetch a single review by its source ID
     * @param sourceId The source ID of the review
     * @returns Promise resolving to raw review data or null if not found
     */
    fetchReview(sourceId: string): Promise<RawReviewData | null>;

    /**
     * Get total number of reviews available in the source
     * @param options Optional filters
     * @returns Promise resolving to total count
     */
    getTotalCount(options?: {
        /** Date range filter */
        dateRange?: {
            start?: Date;
            end?: Date;
        };
    }): Promise<number>;

    /**
     * Check if the adapter is properly configured and can connect
     * @returns Promise resolving to true if healthy
     */
    checkHealth(): Promise<boolean>;

    /**
     * Get adapter configuration
     * @returns The database sync configuration
     */
    getConfig(): DatabaseSyncConfig;
}

/**
 * Data transformer interface
 * Transforms raw data from different sources into ReviewIndex format
 */
export interface IDataTransformer {
    /**
     * Transform raw data into ReviewIndex
     * @param rawData The raw data from the source
     * @returns Promise resolving to transformation result
     */
    transform(rawData: RawReviewData): Promise<TransformationResult>;

    /**
     * Batch transform multiple raw data items
     * @param rawDataArray Array of raw data items
     * @param options Options for batch transformation
     * @returns Promise resolving to array of transformation results
     */
    transformBatch(
        rawDataArray: RawReviewData[],
        options?: {
            /** Continue on error instead of failing entire batch */
            continueOnError?: boolean;

            /** Progress callback */
            onProgress?: (progress: { transformed: number; total: number }) => void;
        },
    ): Promise<TransformationResult[]>;

    /**
     * Validate that raw data can be transformed
     * @param rawData The raw data to validate
     * @returns Promise resolving to true if valid
     */
    validate(rawData: RawReviewData): Promise<boolean>;

    /**
     * Get supported database sources
     * @returns Array of supported database sources
     */
    getSupportedSources(): DatabaseSource[];
}

/**
 * Deduplication strategy interface
 */
export interface IDeduplicationStrategy {
    /**
     * Detect duplicates for a review
     * @param review The review to check
     * @param existingReviews Existing reviews in storage
     * @param options Options for duplicate detection
     * @returns Promise resolving to duplicate detection result
     */
    detectDuplicates(
        review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>,
        existingReviews: ReviewIndex[],
        options?: {
            /** Similarity threshold (0-1) */
            threshold?: number;

            /** Maximum number of potential duplicates to return */
            maxResults?: number;
        },
    ): Promise<Array<{ review: ReviewIndex; similarity: number }>>;

    /**
     * Merge duplicate reviews
     * @param reviews Array of duplicate reviews to merge
     * @returns Promise resolving to merged review
     */
    mergeDuplicates(reviews: ReviewIndex[]): Promise<ReviewIndex>;
}

/**
 * Quality assessment interface
 */
export interface IQualityAssessor {
    /**
     * Assess the quality of a review
     * @param review The review to assess
     * @returns Promise resolving to quality assessment
     */
    assess(review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>): Promise<QualityAssessment>;

    /**
     * Batch assess multiple reviews
     * @param reviews Array of reviews to assess
     * @param options Options for batch assessment
     * @returns Promise resolving to array of quality assessments
     */
    assessBatch(
        reviews: Array<Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>>,
        options?: {
            /** Continue on error instead of failing entire batch */
            continueOnError?: boolean;

            /** Progress callback */
            onProgress?: (progress: { assessed: number; total: number }) => void;
        },
    ): Promise<Array<{ review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>; assessment: QualityAssessment | null; error?: string }>>;

    /**
     * Get the assessment tool being used
     * @returns Name of the assessment tool
     */
    getTool(): string;
}

/**
 * Synchronizer configuration
 */
export interface SynchronizerConfig {
    /** Storage instance */
    storage: ISynthesesStorage;

    /** Data source adapters for each database */
    adapters: Map<DatabaseSource, IDataSourceAdapter>;

    /** Data transformer */
    transformer: IDataTransformer;

    /** Optional deduplication strategy */
    deduplicationStrategy?: IDeduplicationStrategy;

    /** Optional quality assessor */
    qualityAssessor?: IQualityAssessor;

    /** Default sync configuration */
    defaultSyncConfig?: Partial<SyncConfig>;

    /** Whether to enable automatic deduplication */
    enableDeduplication?: boolean;

    /** Whether to enable automatic quality assessment */
    enableQualityAssessment?: boolean;

    /** Maximum concurrent sync operations */
    maxConcurrentSyncs?: number;

    /** Sync timeout in milliseconds */
    syncTimeout?: number;
}

/**
 * Main synchronizer interface
 * Coordinates the synchronization of review indexes from multiple data sources
 */
export interface ISynchronizer {
    /**
     * Sync reviews from a specific database
     * @param database The database to sync
     * @param options Sync options
     * @returns Promise resolving to sync result
     */
    syncDatabase(
        database: DatabaseSource,
        options?: {
            /** Maximum number of reviews to sync */
            limit?: number;

            /** Date range filter */
            dateRange?: {
                start?: Date;
                end?: Date;
            };

            /** Whether to force full sync (ignore incremental updates) */
            forceFullSync?: boolean;

            /** Progress callback */
            onProgress?: SyncProgressCallback;
        },
    ): Promise<DatabaseSyncResult>;

    /**
     * Sync reviews from multiple databases
     * @param databases Array of databases to sync
     * @param options Sync options
     * @returns Promise resolving to overall sync result
     */
    syncMultiple(
        databases: DatabaseSource[],
        options?: {
            /** Maximum number of reviews to sync per database */
            limit?: number;

            /** Date range filter */
            dateRange?: {
                start?: Date;
                end?: Date;
            };

            /** Whether to sync databases in parallel */
            parallel?: boolean;

            /** Progress callback */
            onProgress?: SyncProgressCallback;
        },
    ): Promise<SyncResult>;

    /**
     * Sync all enabled databases
     * @param options Sync options
     * @returns Promise resolving to overall sync result
     */
    syncAll(options?: {
        /** Maximum number of reviews to sync per database */
        limit?: number;

        /** Date range filter */
        dateRange?: {
            start?: Date;
            end?: Date;
        };

        /** Whether to sync databases in parallel */
        parallel?: boolean;

        /** Progress callback */
        onProgress?: SyncProgressCallback;
    }): Promise<SyncResult>;

    /**
     * Sync a single review by its source ID
     * @param database The database source
     * @param sourceId The source ID of the review
     * @returns Promise resolving to the synced review or null if failed
     */
    syncReview(database: DatabaseSource, sourceId: string): Promise<ReviewIndex | null>;

    /**
     * Start a scheduled sync job
     * @param schedule Cron expression for the schedule
     * @param databases Databases to sync
     * @returns Promise resolving to job ID
     */
    startScheduledSync(schedule: string, databases: DatabaseSource[]): Promise<string>;

    /**
     * Stop a scheduled sync job
     * @param jobId The job ID to stop
     * @returns Promise resolving to true if stopped successfully
     */
    stopScheduledSync(jobId: string): Promise<boolean>;

    /**
     * Get active sync jobs
     * @returns Promise resolving to array of active sync jobs
     */
    getActiveJobs(): Promise<SyncJob[]>;

    /**
     * Get sync job by ID
     * @param jobId The job ID
     * @returns Promise resolving to the sync job or null if not found
     */
    getJob(jobId: string): Promise<SyncJob | null>;

    /**
     * Cancel a sync job
     * @param jobId The job ID to cancel
     * @returns Promise resolving to true if cancelled successfully
     */
    cancelJob(jobId: string): Promise<boolean>;

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
        jobId: string;
        database: DatabaseSource;
        status: SyncJobStatus;
        startedAt: Date;
        completedAt?: Date;
        recordsProcessed: number;
        newRecords: number;
        updatedRecords: number;
        failedRecords: number;
        duration: number;
    }>>;

    /**
     * Get sync statistics
     * @returns Promise resolving to sync statistics
     */
    getStats(): Promise<{
        /** Total number of sync jobs */
        totalJobs: number;

        /** Number of jobs by status */
        byStatus: Record<SyncJobStatus, number>;

        /** Number of jobs by database */
        byDatabase: Record<DatabaseSource, number>;

        /** Average sync duration in milliseconds */
        averageDuration: number;

        /** Success rate (0-1) */
        successRate: number;

        /** Last sync timestamp */
        lastSyncAt?: Date;

        /** Last successful sync timestamp */
        lastSuccessfulSyncAt?: Date;
    }>;

    /**
     * Check health of synchronizer and all adapters
     * @returns Promise resolving to health status
     */
    checkHealth(): Promise<{
        /** Overall health status */
        healthy: boolean;

        /** Storage health */
        storage: boolean;

        /** Adapter health by database */
        adapters: Record<DatabaseSource, boolean>;

        /** Number of active jobs */
        activeJobs: number;
    }>;

    /**
     * Get configuration
     * @returns The synchronizer configuration
     */
    getConfig(): SynchronizerConfig;

    /**
     * Update configuration
     * @param config Partial configuration updates
     * @returns Promise resolving to updated configuration
     */
    updateConfig(config: Partial<SynchronizerConfig>): Promise<SynchronizerConfig>;

    /**
     * Register a new data source adapter
     * @param adapter The adapter to register
     * @returns Promise resolving to true if registered successfully
     */
    registerAdapter(adapter: IDataSourceAdapter): Promise<boolean>;

    /**
     * Unregister a data source adapter
     * @param source The database source to unregister
     * @returns Promise resolving to true if unregistered successfully
     */
    unregisterAdapter(source: DatabaseSource): Promise<boolean>;

    /**
     * Get registered adapters
     * @returns Map of registered adapters
     */
    getAdapters(): Map<DatabaseSource, IDataSourceAdapter>;

    /**
     * Set the data transformer
     * @param transformer The transformer to use
     */
    setTransformer(transformer: IDataTransformer): void;

    /**
     * Get the current data transformer
     * @returns The current transformer
     */
    getTransformer(): IDataTransformer;

    /**
     * Set the deduplication strategy
     * @param strategy The deduplication strategy to use
     */
    setDeduplicationStrategy(strategy: IDeduplicationStrategy): void;

    /**
     * Get the current deduplication strategy
     * @returns The current deduplication strategy or null if not set
     */
    getDeduplicationStrategy(): IDeduplicationStrategy | null;

    /**
     * Set the quality assessor
     * @param assessor The quality assessor to use
     */
    setQualityAssessor(assessor: IQualityAssessor): void;

    /**
     * Get the current quality assessor
     * @returns The current quality assessor or null if not set
     */
    getQualityAssessor(): IQualityAssessor | null;

    /**
     * Initialize the synchronizer
     * @returns Promise resolving when initialization is complete
     */
    initialize(): Promise<void>;

    /**
     * Shutdown the synchronizer
     * @returns Promise resolving when shutdown is complete
     */
    shutdown(): Promise<void>;
}

/**
 * Base data source adapter implementation
 * Provides common functionality for database adapters
 */
export abstract class BaseDataSourceAdapter implements IDataSourceAdapter {
    protected config: DatabaseSyncConfig;

    constructor(config: DatabaseSyncConfig) {
        this.config = config;
    }

    abstract getSource(): DatabaseSource;
    abstract fetchReviews(options?: {
        limit?: number;
        offset?: number;
        dateRange?: { start?: Date; end?: Date };
        queryParams?: Record<string, unknown>;
        onProgress?: (progress: { fetched: number; total?: number }) => void;
    }): Promise<RawReviewData[]>;
    abstract fetchReview(sourceId: string): Promise<RawReviewData | null>;
    abstract getTotalCount(options?: {
        dateRange?: { start?: Date; end?: Date };
    }): Promise<number>;
    abstract checkHealth(): Promise<boolean>;

    getConfig(): DatabaseSyncConfig {
        return this.config;
    }

    /**
     * Make an HTTP request with timeout and retry logic
     */
    protected async fetchWithRetry(
        url: string,
        options: RequestInit = {},
        retries = 3,
    ): Promise<Response> {
        const timeout = this.config.timeout || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url, {
                        ...options,
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    return response;
                } catch (error) {
                    if (i === retries - 1) throw error;

                    // Exponential backoff
                    const delay = Math.pow(2, i) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            throw new Error('Max retries exceeded');
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Apply rate limiting
     */
    protected async applyRateLimit(): Promise<void> {
        const rateLimit = this.config.rateLimit;
        if (rateLimit && rateLimit > 0) {
            const delay = (60 * 1000) / rateLimit;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Base data transformer implementation
 * Provides common transformation logic
 */
export abstract class BaseDataTransformer implements IDataTransformer {
    abstract transform(rawData: RawReviewData): Promise<TransformationResult>;
    abstract getSupportedSources(): DatabaseSource[];

    async transformBatch(
        rawDataArray: RawReviewData[],
        options?: {
            continueOnError?: boolean;
            onProgress?: (progress: { transformed: number; total: number }) => void;
        },
    ): Promise<TransformationResult[]> {
        const results: TransformationResult[] = [];
        const continueOnError = options?.continueOnError ?? true;

        for (let i = 0; i < rawDataArray.length; i++) {
            try {
                const result = await this.transform(rawDataArray[i]);
                results.push(result);

                if (options?.onProgress) {
                    options.onProgress({ transformed: i + 1, total: rawDataArray.length });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);

                if (continueOnError) {
                    results.push({
                        review: this.createEmptyReview(),
                        warnings: [],
                        success: false,
                        error: errorMessage,
                    });
                } else {
                    throw error;
                }
            }
        }

        return results;
    }

    async validate(rawData: RawReviewData): Promise<boolean> {
        try {
            const result = await this.transform(rawData);
            return result.success;
        } catch {
            return false;
        }
    }

    /**
     * Create an empty review for error cases
     */
    protected createEmptyReview(): Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'> {
        return {
            databaseIds: [],
            title: '',
            reviewType: 'SYSTEMATIC_REVIEW' as ReviewType,
            publicationStatus: 'PUBLISHED' as PublicationStatus,
            authors: [],
            syncMetadata: {
                firstSyncedAt: new Date(),
                lastSyncedAt: new Date(),
                status: 'FAILED' as SyncStatus,
                syncedDatabases: [],
                syncVersion: 1,
                primarySource: 'CUSTOM' as DatabaseSource,
            },
        };
    }

    /**
     * Parse date string to Date object
     */
    protected parseDate(dateString: string | undefined | null): Date | undefined {
        if (!dateString) return undefined;

        const date = new Date(dateString);
        return isNaN(date.getTime()) ? undefined : date;
    }

    /**
     * Extract authors from various formats
     */
    protected extractAuthors(
        authorsData: unknown,
    ): Author[] {
        if (!authorsData) return [];

        if (Array.isArray(authorsData)) {
            return authorsData.map((author, index) => {
                if (typeof author === 'string') {
                    return { name: author, role: index === 0 ? AuthorRole.PRIMARY : AuthorRole.CO_AUTHOR };
                }
                if (typeof author === 'object' && author !== null) {
                    return {
                        name: (author as any).name || '',
                        initials: (author as any).initials,
                        affiliation: (author as any).affiliation,
                        orcid: (author as any).orcid,
                        role: index === 0 ? AuthorRole.PRIMARY : AuthorRole.CO_AUTHOR,
                    };
                }
                return { name: String(author) };
            });
        }

        if (typeof authorsData === 'string') {
            return authorsData.split(',').map(name => ({ name: name.trim() }));
        }

        return [];
    }

    /**
     * Extract journal information
     */
    protected extractJournal(journalData: unknown): Journal | undefined {
        if (!journalData) return undefined;

        if (typeof journalData === 'string') {
            return { name: journalData };
        }

        if (typeof journalData === 'object' && journalData !== null) {
            const data = journalData as any;
            return {
                name: data.name || data.journal || data.title,
                abbreviation: data.abbreviation,
                issn: data.issn,
                eissn: data.eissn,
                publisher: data.publisher,
                volume: data.volume,
                issue: data.issue,
                pages: data.pages,
                articleNumber: data.articleNumber,
            };
        }

        return undefined;
    }

    /**
     * Extract URLs
     */
    protected extractUrls(urlsData: unknown, source: DatabaseSource): ReviewUrl[] {
        if (!urlsData) return [];

        const urls: ReviewUrl[] = [];

        if (Array.isArray(urlsData)) {
            urlsData.forEach(urlData => {
                if (typeof urlData === 'string') {
                    urls.push({
                        type: UrlType.DATABASE_ENTRY,
                        url: urlData,
                        access: AccessLevel.UNKNOWN,
                    });
                } else if (typeof urlData === 'object' && urlData !== null) {
                    const data = urlData as any;
                    urls.push({
                        type: data.type || UrlType.DATABASE_ENTRY,
                        url: data.url || data.href,
                        description: data.description,
                        access: data.access || AccessLevel.UNKNOWN,
                    });
                }
            });
        } else if (typeof urlsData === 'string') {
            urls.push({
                type: UrlType.DATABASE_ENTRY,
                url: urlsData,
                access: AccessLevel.UNKNOWN,
            });
        }

        return urls;
    }
}

/**
 * Base deduplication strategy implementation
 * Uses similarity-based duplicate detection
 */
export abstract class BaseDeduplicationStrategy implements IDeduplicationStrategy {
    abstract detectDuplicates(
        review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>,
        existingReviews: ReviewIndex[],
        options?: {
            threshold?: number;
            maxResults?: number;
        },
    ): Promise<Array<{ review: ReviewIndex; similarity: number }>>;

    async mergeDuplicates(reviews: ReviewIndex[]): Promise<ReviewIndex> {
        // Use the review with the most recent sync as the base
        const baseReview = reviews.reduce((latest, current) => {
            return current.syncMetadata.lastSyncedAt > latest.syncMetadata.lastSyncedAt
                ? current
                : latest;
        });

        // Merge database IDs from all reviews
        const allDatabaseIds = reviews.flatMap(r => r.databaseIds);
        const uniqueDatabaseIds = Array.from(
            new Map(allDatabaseIds.map(id => [`${id.source}:${id.id}`, id])).values(),
        );

        // Merge URLs from all reviews
        const allUrls = reviews.flatMap(r => r.urls || []);
        const uniqueUrls = Array.from(
            new Map(allUrls.map(u => [u.url, u])).values(),
        );

        // Merge MeSH terms and keywords
        const allMeshTerms = reviews.flatMap(r => r.meshTerms || []);
        const uniqueMeshTerms = Array.from(new Set(allMeshTerms));

        const allKeywords = reviews.flatMap(r => r.keywords || []);
        const uniqueKeywords = Array.from(new Set(allKeywords));

        // Merge authors
        const allAuthors = reviews.flatMap(r => r.authors);
        const uniqueAuthors = Array.from(
            new Map(allAuthors.map(a => [a.name, a])).values(),
        );

        // Update the base review with merged data
        return {
            ...baseReview,
            databaseIds: uniqueDatabaseIds,
            urls: uniqueUrls,
            meshTerms: uniqueMeshTerms,
            keywords: uniqueKeywords,
            authors: uniqueAuthors,
            updatedAt: new Date(),
        };
    }
}
