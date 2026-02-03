/**
 * Core interfaces for synchronizing systematic review and meta-analysis indexes
 * from multiple medical databases (PubMed, Cochrane, Embase, etc.)
 */

// ============================================================================
// Database Source Types
// ============================================================================

/**
 * Supported medical database sources
 */
export enum DatabaseSource {
    /** PubMed (NCBI) */
    PUBMED = 'PUBMED',
    /** Cochrane Library */
    COCHRANE = 'COCHRANE',
    /** Embase (Elsevier) */
    EMBASE = 'EMBASE',
    /** Web of Science */
    WEB_OF_SCIENCE = 'WEB_OF_SCIENCE',
    /** Scopus */
    SCOPUS = 'SCOPUS',
    /** PsycINFO */
    PSYCINFO = 'PSYCINFO',
    /** CINAHL */
    CINAHL = 'CINAHL',
    /** Custom/Other database */
    CUSTOM = 'CUSTOM',
}

/**
 * Database-specific identifier for a review
 */
export interface DatabaseIdentifier {
    /** The database source */
    source: DatabaseSource;
    /** The unique identifier in that database (e.g., PMID, DOI) */
    id: string;
    /** Optional version or revision identifier */
    version?: string;
}

// ============================================================================
// Review Types
// ============================================================================

/**
 * Type of systematic review or analysis
 */
export enum ReviewType {
    /** Systematic Review */
    SYSTEMATIC_REVIEW = 'SYSTEMATIC_REVIEW',
    /** Meta-analysis */
    META_ANALYSIS = 'META_ANALYSIS',
    /** Systematic Review with Meta-analysis */
    SYSTEMATIC_REVIEW_WITH_META_ANALYSIS = 'SYSTEMATIC_REVIEW_WITH_META_ANALYSIS',
    /** Overview of Reviews (Umbrella Review) */
    OVERVIEW_OF_REVIEWS = 'OVERVIEW_OF_REVIEWS',
    /** Scoping Review */
    SCOPING_REVIEW = 'SCOPING_REVIEW',
    /** Rapid Review */
    RAPID_REVIEW = 'RAPID_REVIEW',
    /** Network Meta-analysis */
    NETWORK_META_ANALYSIS = 'NETWORK_META_ANALYSIS',
    /** Living Systematic Review */
    LIVING_SYSTEMATIC_REVIEW = 'LIVING_SYSTEMATIC_REVIEW',
}

/**
 * Publication status of a review
 */
export enum PublicationStatus {
    /** Published */
    PUBLISHED = 'PUBLISHED',
    /** Preprint */
    PREPRINT = 'PREPRINT',
    /** In Progress */
    IN_PROGRESS = 'IN_PROGRESS',
    /** Withdrawn */
    WITHDRAWN = 'WITHDRAWN',
    /** Protocol Only */
    PROTOCOL = 'PROTOCOL',
}

// ============================================================================
// Core Review Index Interface
// ============================================================================

/**
 * Main index entry for a systematic review or meta-analysis
 * Represents the synchronized view across multiple databases
 */
export interface ReviewIndex {
    /** Unique identifier for this review in the syntheses system */
    id: string;

    /** Database identifiers from all sources where this review exists */
    databaseIds: DatabaseIdentifier[];

    /** Primary title of the review */
    title: string;

    /** Alternative titles or abbreviations */
    alternativeTitles?: string[];

    /** Type of review */
    reviewType: ReviewType;

    /** Publication status */
    publicationStatus: PublicationStatus;

    /** DOI (Digital Object Identifier) */
    doi?: string;

    /** PubMed ID (if available) */
    pmid?: string;

    /** Cochrane ID (if available) */
    cochraneId?: string;

    /** Publication date */
    publicationDate?: Date;

    /** Last updated date (for living reviews or updates) */
    lastUpdatedDate?: Date;

    /** Authors of the review */
    authors: Author[];

    /** Journal or publication source */
    journal?: Journal;

    /** Abstract or summary */
    abstract?: string;

    /** MeSH terms (Medical Subject Headings) */
    meshTerms?: string[];

    /** Keywords */
    keywords?: string[];

    /** Research question(s) addressed */
    researchQuestions?: string[];

    /** Inclusion/exclusion criteria */
    eligibilityCriteria?: EligibilityCriteria;

    /** Number of studies included in the review */
    includedStudiesCount?: number;

    /** Number of participants across all studies */
    totalParticipantsCount?: number;

    /** PICO elements (Population, Intervention, Comparison, Outcome) */
    pico?: PICO;

    /** Main findings and conclusions */
    conclusions?: string;

    /** Confidence in the evidence (GRADE assessment) */
    evidenceQuality?: EvidenceQuality;

    /** Funding sources */
    funding?: string[];

    /** Conflict of interest statements */
    conflictsOfInterest?: string;

    /** URL to full text or database entry */
    urls?: ReviewUrl[];

    /** Synchronization metadata */
    syncMetadata: SyncMetadata;

    /** Quality assessment scores */
    qualityAssessment?: QualityAssessment;

    /** Related reviews (e.g., updates, duplicates) */
    relatedReviews?: RelatedReview[];

    /** Custom metadata for database-specific information */
    customMetadata?: Record<string, unknown>;

    /** Timestamp when this record was created in the syntheses system */
    createdAt: Date;

    /** Timestamp when this record was last modified */
    updatedAt: Date;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Author information
 */
export interface Author {
    /** Author's full name */
    name: string;

    /** Author's initials */
    initials?: string;

    /** Author's affiliation/institution */
    affiliation?: string;

    /** ORCID identifier */
    orcid?: string;

    /** Author's role (e.g., corresponding author) */
    role?: AuthorRole;
}

/**
 * Author roles
 */
export enum AuthorRole {
    /** Primary/First author */
    PRIMARY = 'PRIMARY',
    /** Corresponding author */
    CORRESPONDING = 'CORRESPONDING',
    /** Co-author */
    CO_AUTHOR = 'CO_AUTHOR',
    /** Reviewer */
    REVIEWER = 'REVIEWER',
}

/**
 * Journal or publication source
 */
export interface Journal {
    /** Journal name */
    name: string;

    /** Journal abbreviation */
    abbreviation?: string;

    /** ISSN (International Standard Serial Number) */
    issn?: string;

    /** eISSN (electronic ISSN) */
    eissn?: string;

    /** Publisher */
    publisher?: string;

    /** Volume number */
    volume?: string;

    /** Issue number */
    issue?: string;

    /** Page range or article number */
    pages?: string;

    /** Article number (for journals that use them) */
    articleNumber?: string;
}

/**
 * Eligibility criteria for studies included in the review
 */
export interface EligibilityCriteria {
    /** Inclusion criteria */
    inclusionCriteria?: string[];

    /** Exclusion criteria */
    exclusionCriteria?: string[];

    /** Study designs included */
    studyDesigns?: string[];

    /** Population characteristics */
    population?: string;

    /** Intervention/exposure characteristics */
    intervention?: string;

    /** Comparison characteristics */
    comparison?: string;

    /** Outcome measures */
    outcomes?: string[];
}

/**
 * PICO framework elements
 */
export interface PICO {
    /** Population or Problem */
    population?: string;

    /** Intervention or Exposure */
    intervention?: string;

    /** Comparator or Control */
    comparison?: string;

    /** Outcome */
    outcome?: string;

    /** Study design */
    studyDesign?: string;

    /** Timeframe */
    timeframe?: string;
}

/**
 * Evidence quality assessment (GRADE)
 */
export enum EvidenceQuality {
    /** High quality */
    HIGH = 'HIGH',
    /** Moderate quality */
    MODERATE = 'MODERATE',
    /** Low quality */
    LOW = 'LOW',
    /** Very low quality */
    VERY_LOW = 'VERY_LOW',
    /** Not assessed */
    NOT_ASSESSED = 'NOT_ASSESSED',
}

/**
 * URL references for the review
 */
export interface ReviewUrl {
    /** Type of URL */
    type: UrlType;

    /** The URL itself */
    url: string;

    /** Description of the resource */
    description?: string;

    /** Access level */
    access?: AccessLevel;
}

/**
 * URL types
 */
export enum UrlType {
    /** Full text article */
    FULL_TEXT = 'FULL_TEXT',
    /** Abstract only */
    ABSTRACT = 'ABSTRACT',
    /** Database entry */
    DATABASE_ENTRY = 'DATABASE_ENTRY',
    /** Supplementary materials */
    SUPPLEMENTARY = 'SUPPLEMENTARY',
    /** Protocol */
    PROTOCOL = 'PROTOCOL',
    /** Preprint server */
    PREPRINT = 'PREPRINT',
    /** Publisher page */
    PUBLISHER = 'PUBLISHER',
}

/**
 * Access level for resources
 */
export enum AccessLevel {
    /** Open access */
    OPEN = 'OPEN',
    /** Subscription required */
    SUBSCRIPTION = 'SUBSCRIPTION',
    /** Pay-per-view */
    PAY_PER_VIEW = 'PAY_PER_VIEW',
    /** Unknown access */
    UNKNOWN = 'UNKNOWN',
}

/**
 * Synchronization metadata
 */
export interface SyncMetadata {
    /** When this review was first synced */
    firstSyncedAt: Date;

    /** When this review was last synced */
    lastSyncedAt: Date;

    /** Sync status */
    status: SyncStatus;

    /** List of databases that have been synced */
    syncedDatabases: DatabaseSource[];

    /** Databases that failed to sync */
    failedDatabases?: FailedSync[];

    /** Sync version (for tracking schema changes) */
    syncVersion: number;

    /** Hash of the content for change detection */
    contentHash?: string;

    /** Source database that was the primary sync source */
    primarySource: DatabaseSource;
}

/**
 * Synchronization status
 */
export enum SyncStatus {
    /** Successfully synced */
    SYNCED = 'SYNCED',
    /** Sync in progress */
    SYNCING = 'SYNCING',
    /** Sync failed */
    FAILED = 'FAILED',
    /** Partial sync (some sources failed) */
    PARTIAL = 'PARTIAL',
    /** Pending sync */
    PENDING = 'PENDING',
    /** Stale (needs re-sync) */
    STALE = 'STALE',
}

/**
 * Failed sync information
 */
export interface FailedSync {
    /** Database that failed to sync */
    database: DatabaseSource;

    /** Error message */
    error: string;

    /** Timestamp of failure */
    failedAt: Date;

    /** Number of retry attempts */
    retryCount: number;
}

/**
 * Quality assessment for the review
 */
export interface QualityAssessment {
    /** Assessment tool used (e.g., AMSTAR, ROBIS) */
    tool?: string;

    /** Overall quality score */
    overallScore?: number;

    /** Maximum possible score */
    maxScore?: number;

    /** Quality rating */
    rating?: QualityRating;

    /** Assessment date */
    assessedAt?: Date;

    /** Individual domain scores */
    domainScores?: DomainScore[];

    /** Comments on the assessment */
    comments?: string;
}

/**
 * Quality rating categories
 */
export enum QualityRating {
    /** High quality */
    HIGH = 'HIGH',
    /** Moderate quality */
    MODERATE = 'MODERATE',
    /** Low quality */
    LOW = 'LOW',
    /** Critically low quality */
    CRITICALLY_LOW = 'CRITICALLY_LOW',
}

/**
 * Domain score for quality assessment
 */
export interface DomainScore {
    /** Domain name */
    domain: string;

    /** Score for this domain */
    score: number;

    /** Maximum possible score */
    maxScore: number;

    /** Comments on this domain */
    comments?: string;
}

/**
 * Related reviews
 */
export interface RelatedReview {
    /** ID of the related review */
    reviewId: string;

    /** Type of relationship */
    relationship: ReviewRelationship;

    /** Description of the relationship */
    description?: string;
}

/**
 * Types of relationships between reviews
 */
export enum ReviewRelationship {
    /** Updated version */
    UPDATE = 'UPDATE',
    /** Previous version */
    PREVIOUS_VERSION = 'PREVIOUS_VERSION',
    /** Duplicate or near-duplicate */
    DUPLICATE = 'DUPLICATE',
    /** Covers similar topic */
    SIMILAR_TOPIC = 'SIMILAR_TOPIC',
    /** Companion review (e.g., protocol vs final) */
    COMPANION = 'COMPANION',
    /** Correction or erratum */
    CORRECTION = 'CORRECTION',
    /** Withdrawn by */
    WITHDRAWN_BY = 'WITHDRAWN_BY',
}

// ============================================================================
// Sync Configuration Types
// ============================================================================

/**
 * Configuration for synchronizing from a specific database
 */
export interface DatabaseSyncConfig {
    /** Database source */
    source: DatabaseSource;

    /** Whether this database is enabled for sync */
    enabled: boolean;

    /** API endpoint or base URL */
    endpoint?: string;

    /** API key or authentication token */
    apiKey?: string;

    /** Sync frequency (cron expression) */
    syncSchedule?: string;

    /** Maximum number of records to fetch per sync */
    batchSize?: number;

    /** Timeout for API requests (in milliseconds) */
    timeout?: number;

    /** Rate limiting (requests per minute) */
    rateLimit?: number;

    /** Custom query parameters */
    queryParams?: Record<string, string>;

    /** Field mappings for database-specific fields */
    fieldMappings?: FieldMapping[];
}

/**
 * Field mapping for database-specific fields
 */
export interface FieldMapping {
    /** Source field name */
    sourceField: string;

    /** Target field in ReviewIndex */
    targetField: keyof ReviewIndex;

    /** Transformation function to apply */
    transform?: string;
}

/**
 * Overall synchronization configuration
 */
export interface SyncConfig {
    /** Configuration for each database */
    databases: DatabaseSyncConfig[];

    /** Default sync version */
    syncVersion: number;

    /** Whether to enable automatic deduplication */
    enableDeduplication: boolean;

    /** Similarity threshold for deduplication (0-1) */
    deduplicationThreshold?: number;

    /** Whether to enable quality assessment */
    enableQualityAssessment: boolean;

    /** Default quality assessment tool */
    defaultQualityTool?: string;

    /** Retention policy for old versions */
    retentionPolicy?: RetentionPolicy;

    /** Notification settings */
    notifications?: NotificationConfig;

    /** Checkpoint configuration for resumable syncs */
    checkpointConfig?: CheckpointConfig;
}

/**
 * Checkpoint configuration for resumable synchronization
 */
export interface CheckpointConfig {
    /** Whether checkpoint/recovery is enabled */
    enabled: boolean;

    /** Checkpoint interval (number of records between checkpoints) */
    checkpointInterval?: number;

    /** Maximum number of checkpoints to keep per database */
    maxCheckpoints?: number;

    /** Whether to automatically resume interrupted syncs */
    autoResume?: boolean;

    /** Checkpoint retention policy */
    retentionPolicy?: CheckpointRetentionPolicy;
}

/**
 * Checkpoint retention policy
 */
export interface CheckpointRetentionPolicy {
    /** Maximum age of checkpoints to keep (in days) */
    maxAgeDays?: number;

    /** Whether to keep only the latest checkpoint */
    keepLatestOnly?: boolean;

    /** Whether to keep checkpoints for completed syncs */
    keepCompleted?: boolean;
}

/**
 * Sync checkpoint for tracking progress and enabling resume
 */
export interface SyncCheckpoint {
    /** Unique checkpoint identifier */
    id: string;

    /** Database source this checkpoint is for */
    database: DatabaseSource;

    /** Sync job ID this checkpoint belongs to */
    jobId: string;

    /** Checkpoint status */
    status: CheckpointStatus;

    /** Position in the sync process */
    position: CheckpointPosition;

    /** Number of records processed so far */
    processedCount: number;

    /** Total number of records to process (if known) */
    totalCount?: number;

    /** Timestamp when checkpoint was created */
    createdAt: Date;

    /** Timestamp when checkpoint was last updated */
    updatedAt: Date;

    /** Timestamp when sync completed (if applicable) */
    completedAt?: Date;

    /** Error information if sync failed */
    error?: string;

    /** Additional metadata */
    metadata?: CheckpointMetadata;
}

/**
 * Checkpoint status
 */
export enum CheckpointStatus {
    /** Checkpoint is active and sync is in progress */
    ACTIVE = 'ACTIVE',
    /** Sync completed successfully */
    COMPLETED = 'COMPLETED',
    /** Sync failed and can be resumed */
    FAILED = 'FAILED',
    /** Sync was cancelled */
    CANCELLED = 'CANCELLED',
    /** Checkpoint is expired and should not be used */
    EXPIRED = 'EXPIRED',
}

/**
 * Checkpoint position - represents where in the sync process we are
 */
export interface CheckpointPosition {
    /** Type of position marker */
    type: PositionType;

    /** Offset for pagination-based sync */
    offset?: number;

    /** Last processed source ID for ID-based sync */
    lastSourceId?: string;

    /** Timestamp for time-based incremental sync */
    lastTimestamp?: Date;

    /** Page number for page-based sync */
    page?: number;

    /** Custom position data for database-specific implementations */
    customData?: Record<string, unknown>;
}

/**
 * Position type determines how the checkpoint tracks progress
 */
export enum PositionType {
    /** Offset-based pagination */
    OFFSET = 'OFFSET',
    /** Page-based pagination */
    PAGE = 'PAGE',
    /** ID-based cursor (using last processed ID) */
    CURSOR_ID = 'CURSOR_ID',
    /** Timestamp-based incremental sync */
    TIMESTAMP = 'TIMESTAMP',
    /** Custom position type */
    CUSTOM = 'CUSTOM',
}

/**
 * Checkpoint metadata
 */
export interface CheckpointMetadata {
    /** Sync options used when creating this checkpoint */
    syncOptions?: {
        limit?: number;
        dateRange?: {
            start?: Date;
            end?: Date;
        };
        queryParams?: Record<string, unknown>;
    };

    /** Performance metrics */
    metrics?: {
        /** Records processed per second */
        recordsPerSecond?: number;
        /** Average processing time per record (in milliseconds) */
        avgProcessingTime?: number;
        /** Estimated time remaining (in seconds) */
        estimatedTimeRemaining?: number;
    };

    /** Data quality metrics */
    qualityMetrics?: {
        /** Number of records that failed transformation */
        failedTransformations?: number;
        /** Number of duplicates detected */
        duplicatesDetected?: number;
        /** Number of records with quality issues */
        qualityIssues?: number;
    };
}

/**
 * Checkpoint summary for listing checkpoints
 */
export interface CheckpointSummary {
    /** Checkpoint ID */
    id: string;

    /** Database source */
    database: DatabaseSource;

    /** Job ID */
    jobId: string;

    /** Status */
    status: CheckpointStatus;

    /** Progress percentage */
    progress: number;

    /** Created at */
    createdAt: Date;

    /** Updated at */
    updatedAt: Date;
}

/**
 * Retention policy for review versions
 */
export interface RetentionPolicy {
    /** Maximum number of versions to keep */
    maxVersions?: number;

    /** Maximum age of versions to keep */
    maxAgeDays?: number;

    /** Whether to archive old versions instead of deleting */
    archiveOldVersions: boolean;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
    /** Email notifications */
    email?: EmailNotificationConfig;

    /** Webhook notifications */
    webhook?: WebhookNotificationConfig;
}

/**
 * Email notification configuration
 */
export interface EmailNotificationConfig {
    /** Whether email notifications are enabled */
    enabled: boolean;

    /** Recipient email addresses */
    recipients: string[];

    /** Events to notify about */
    events: NotificationEvent[];
}

/**
 * Webhook notification configuration
 */
export interface WebhookNotificationConfig {
    /** Whether webhook notifications are enabled */
    enabled: boolean;

    /** Webhook URL */
    url: string;

    /** Events to notify about */
    events: NotificationEvent[];

    /** Secret for webhook signature verification */
    secret?: string;
}

/**
 * Events that can trigger notifications
 */
export enum NotificationEvent {
    /** Sync completed successfully */
    SYNC_COMPLETED = 'SYNC_COMPLETED',
    /** Sync failed */
    SYNC_FAILED = 'SYNC_FAILED',
    /** New review added */
    NEW_REVIEW = 'NEW_REVIEW',
    /** Review updated */
    REVIEW_UPDATED = 'REVIEW_UPDATED',
    /** Duplicate detected */
    DUPLICATE_DETECTED = 'DUPLICATE_DETECTED',
    /** Quality assessment completed */
    QUALITY_ASSESSMENT_COMPLETED = 'QUALITY_ASSESSMENT_COMPLETED',
}

// ============================================================================
// Search and Query Types
// ============================================================================

/**
 * Search filters for querying reviews
 */
export interface ReviewSearchFilters {
    /** Search in title */
    title?: string;

    /** Search in abstract */
    abstract?: string;

    /** Filter by review type */
    reviewType?: ReviewType[];

    /** Filter by publication status */
    publicationStatus?: PublicationStatus[];

    /** Filter by database source */
    databaseSource?: DatabaseSource[];

    /** Filter by MeSH terms */
    meshTerms?: string[];

    /** Filter by keywords */
    keywords?: string[];

    /** Filter by publication date range */
    publicationDateRange?: DateRange;

    /** Filter by last updated date range */
    lastUpdatedDateRange?: DateRange;

    /** Filter by evidence quality */
    evidenceQuality?: EvidenceQuality[];

    /** Filter by quality rating */
    qualityRating?: QualityRating[];

    /** Filter by authors */
    authors?: string[];

    /** Filter by journal name */
    journal?: string;

    /** Filter by DOI */
    doi?: string;

    /** Filter by PMID */
    pmid?: string;

    /** Filter by Cochrane ID */
    cochraneId?: string;

    /** PICO filters */
    pico?: Partial<PICO>;

    /** Minimum number of included studies */
    minIncludedStudies?: number;

    /** Maximum number of included studies */
    maxIncludedStudies?: number;

    /** Minimum number of participants */
    minParticipants?: number;

    /** Maximum number of participants */
    maxParticipants?: number;
}

/**
 * Date range filter
 */
export interface DateRange {
    /** Start date (inclusive) */
    start?: Date;

    /** End date (inclusive) */
    end?: Date;
}

/**
 * Sort options for review results
 */
export interface ReviewSortOptions {
    /** Field to sort by */
    field: SortField;

    /** Sort direction */
    direction: SortDirection;
}

/**
 * Sortable fields
 */
export enum SortField {
    /** Publication date */
    PUBLICATION_DATE = 'PUBLICATION_DATE',
    /** Last updated date */
    LAST_UPDATED_DATE = 'LAST_UPDATED_DATE',
    /** Title (alphabetical) */
    TITLE = 'TITLE',
    /** Number of included studies */
    INCLUDED_STUDIES_COUNT = 'INCLUDED_STUDIES_COUNT',
    /** Number of participants */
    PARTICIPANTS_COUNT = 'PARTICIPANTS_COUNT',
    /** Evidence quality */
    EVIDENCE_QUALITY = 'EVIDENCE_QUALITY',
    /** Quality score */
    QUALITY_SCORE = 'QUALITY_SCORE',
    /** Sync date */
    SYNC_DATE = 'SYNC_DATE',
    /** Relevance score (for text search) */
    RELEVANCE = 'RELEVANCE',
}

/**
 * Sort direction
 */
export enum SortDirection {
    /** Ascending order */
    ASC = 'ASC',
    /** Descending order */
    DESC = 'DESC',
}

/**
 * Pagination options
 */
export interface PaginationOptions {
    /** Page number (1-indexed) */
    page: number;

    /** Number of items per page */
    pageSize: number;
}

/**
 * Search result with pagination metadata
 */
export interface ReviewSearchResult {
    /** The matching reviews */
    reviews: ReviewIndex[];

    /** Total number of matching reviews */
    total: number;

    /** Current page number */
    page: number;

    /** Number of pages */
    totalPages: number;

    /** Number of items per page */
    pageSize: number;

    /** Whether there are more results */
    hasNext: boolean;

    /** Whether there are previous results */
    hasPrevious: boolean;
}

// ============================================================================
// Sync Job Types
// ============================================================================

/**
 * Status of a sync job
 */
export enum SyncJobStatus {
    /** Job is queued */
    QUEUED = 'QUEUED',
    /** Job is running */
    RUNNING = 'RUNNING',
    /** Job completed successfully */
    COMPLETED = 'COMPLETED',
    /** Job failed */
    FAILED = 'FAILED',
    /** Job was cancelled */
    CANCELLED = 'CANCELLED',
}

/**
 * A synchronization job
 */
export interface SyncJob {
    /** Unique job identifier */
    id: string;

    /** Job status */
    status: SyncJobStatus;

    /** Database being synced */
    database: DatabaseSource;

    /** When the job was created */
    createdAt: Date;

    /** When the job started running */
    startedAt?: Date;

    /** When the job completed */
    completedAt?: Date;

    /** Number of records processed */
    recordsProcessed: number;

    /** Number of new records added */
    newRecords: number;

    /** Number of records updated */
    updatedRecords: number;

    /** Number of records that failed */
    failedRecords: number;

    /** Error message if job failed */
    error?: string;

    /** Progress percentage (0-100) */
    progress: number;

    /** Estimated time remaining (in seconds) */
    estimatedTimeRemaining?: number;
}

// ============================================================================
// Statistics and Analytics Types
// ============================================================================

/**
 * Statistics about the review index
 */
export interface ReviewIndexStats {
    /** Total number of reviews */
    totalReviews: number;

    /** Number of reviews by type */
    reviewsByType: Record<ReviewType, number>;

    /** Number of reviews by database source */
    reviewsByDatabase: Record<DatabaseSource, number>;

    /** Number of reviews by publication status */
    reviewsByStatus: Record<PublicationStatus, number>;

    /** Number of reviews by evidence quality */
    reviewsByEvidenceQuality: Record<EvidenceQuality, number>;

    /** Number of reviews by quality rating */
    reviewsByQualityRating: Record<QualityRating, number>;

    /** Date range of reviews */
    dateRange: {
        /** Earliest publication date */
        earliest: Date;
        /** Latest publication date */
        latest: Date;
    };

    /** Total number of included studies across all reviews */
    totalIncludedStudies: number;

    /** Total number of participants across all reviews */
    totalParticipants: number;

    /** Last sync timestamp */
    lastSyncAt?: Date;

    /** Sync status by database */
    syncStatusByDatabase: Record<DatabaseSource, SyncStatus>;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * Export format options
 */
export enum ExportFormat {
    /** JSON format */
    JSON = 'JSON',
    /** CSV format */
    CSV = 'CSV',
    /** Excel format */
    EXCEL = 'EXCEL',
    /** XML format */
    XML = 'XML',
    /** BibTeX format */
    BIBTEX = 'BIBTEX',
    /** RIS format */
    RIS = 'RIS',
}

/**
 * Export options
 */
export interface ExportOptions {
    /** Export format */
    format: ExportFormat;

    /** Fields to include (if empty, includes all) */
    fields?: (keyof ReviewIndex)[];

    /** Filters to apply before export */
    filters?: ReviewSearchFilters;

    /** Sort options */
    sort?: ReviewSortOptions;

    /** Whether to include related reviews */
    includeRelatedReviews?: boolean;

    /** Whether to include sync metadata */
    includeSyncMetadata?: boolean;

    /** Whether to include quality assessment */
    includeQualityAssessment?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
    /** Unique export ID */
    id: string;

    /** Export format */
    format: ExportFormat;

    /** Number of records exported */
    recordCount: number;

    /** URL to download the export */
    downloadUrl: string;

    /** File size in bytes */
    fileSize: number;

    /** When the export was created */
    createdAt: Date;

    /** When the export expires */
    expiresAt: Date;
}
