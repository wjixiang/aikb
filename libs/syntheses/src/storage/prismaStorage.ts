import { prisma, Prisma } from 'syntheses-db';

import type {
    IReviewStorage,
    ReviewStorageConfig,
    UpsertResult,
    BulkOperationResult,
    DuplicateDetectionResult,
    ReviewVersion,
} from './storage';
import type {
    ReviewIndex,
    DatabaseIdentifier,
    DatabaseSource,
    ReviewType,
    PublicationStatus,
    EvidenceQuality,
    QualityRating,
    Author,
    AuthorRole,
    Journal,
    EligibilityCriteria,
    PICO,
    ReviewUrl,
    SyncMetadata,
    QualityAssessment,
    RelatedReview,
    ReviewSearchFilters,
    ReviewSortOptions,
    PaginationOptions,
    ReviewSearchResult,
    ReviewIndexStats,
    ExportFormat,
    ExportOptions,
    ExportResult,
    SyncStatus,
    UrlType,
    ReviewRelationship,
    AccessLevel,
} from '../types';

/**
 * Prisma-based implementation of IReviewStorage
 */
export class PrismaReviewStorage implements IReviewStorage {
    private config: ReviewStorageConfig;
    private initialized = false;

    constructor(config: ReviewStorageConfig = {}) {
        this.config = {
            enableLogging: false,
            enableProfiling: false,
            ...config,
        };
    }

    // ============================================================================
    // CRUD Operations
    // ============================================================================

    async create(review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>): Promise<ReviewIndex> {
        const data = this.toPrismaCreateData(review);
        const created = await prisma.review_index.create({ data, include: this.getInclude() });
        return this.fromPrisma(created);
    }

    async findById(id: string): Promise<ReviewIndex | null> {
        const found = await prisma.review_index.findUnique({
            where: { id },
            include: this.getInclude(),
        });
        return found ? this.fromPrisma(found) : null;
    }

    async findByIds(ids: string[]): Promise<(ReviewIndex | null)[]> {
        const reviews = await prisma.review_index.findMany({
            where: { id: { in: ids } },
            include: this.getInclude(),
        });

        const map = new Map(reviews.map((r) => [r.id, this.fromPrisma(r)]));
        return ids.map((id) => map.get(id) ?? null);
    }

    async update(
        id: string,
        updates: Partial<Omit<ReviewIndex, 'id' | 'createdAt'>>,
    ): Promise<ReviewIndex | null> {
        try {
            const data = this.toPrismaUpdateData(updates);
            const updated = await prisma.review_index.update({
                where: { id },
                data,
                include: this.getInclude(),
            });
            return this.fromPrisma(updated);
        } catch {
            return null;
        }
    }

    async delete(id: string, options?: { soft?: boolean }): Promise<boolean> {
        if (options?.soft) {
            const result = await prisma.review_index.updateMany({
                where: { id },
                data: { publication_status: 'WITHDRAWN' },
            });
            return result.count > 0;
        }

        try {
            await prisma.review_index.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }

    async upsert(
        review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>,
        options?: { matchByDatabaseIds?: boolean; forceUpdate?: boolean },
    ): Promise<UpsertResult> {
        let existingReview: ReviewIndex | null = null;

        if (options?.matchByDatabaseIds && review.databaseIds.length > 0) {
            for (const dbId of review.databaseIds) {
                const byDb = await this.findByDatabaseId(dbId);
                if (byDb.length > 0) {
                    existingReview = byDb[0];
                    break;
                }
            }
        }

        if (!existingReview && review.doi) {
            const byDoi = await this.findByDoi(review.doi);
            if (byDoi.length > 0) existingReview = byDoi[0];
        }

        if (!existingReview && review.pmid) {
            const byPmid = await this.findByPmid(review.pmid);
            if (byPmid.length > 0) existingReview = byPmid[0];
        }

        if (!existingReview && review.cochraneId) {
            const byCochrane = await this.findByCochraneId(review.cochraneId);
            if (byCochrane.length > 0) existingReview = byCochrane[0];
        }

        if (existingReview) {
            if (!options?.forceUpdate) {
                const newHash = this.generateContentHash(review);
                const existing = await prisma.review_index.findUnique({
                    where: { id: existingReview.id },
                    select: { content_hash: true },
                });

                if (existing?.content_hash === newHash) {
                    return { id: existingReview.id, created: false, review: existingReview };
                }
            }

            const updated = await this.update(existingReview.id, review);
            return {
                id: existingReview.id,
                created: false,
                review: updated ?? existingReview,
            };
        }

        const created = await this.create(review);
        return { id: created.id, created: true, review: created };
    }

    async bulkUpsert(
        reviews: Array<Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>>,
        options?: { continueOnError?: boolean; batchSize?: number },
    ): Promise<BulkOperationResult> {
        const batchSize = options?.batchSize ?? 100;
        const successIds: string[] = [];
        const errors: Array<{ id: string; error: string }> = [];

        for (let i = 0; i < reviews.length; i += batchSize) {
            const batch = reviews.slice(i, i + batchSize);

            for (const review of batch) {
                try {
                    const result = await this.upsert(review, { matchByDatabaseIds: true });
                    successIds.push(result.id);
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    errors.push({
                        id: review.doi ?? review.pmid ?? review.cochraneId ?? 'unknown',
                        error: errorMsg,
                    });
                    if (!options?.continueOnError) break;
                }
            }
        }

        return {
            successCount: successIds.length,
            failureCount: errors.length,
            successIds,
            errors,
        };
    }

    // ============================================================================
    // Query Operations
    // ============================================================================

    async search(
        filters: ReviewSearchFilters,
        sort?: ReviewSortOptions,
        pagination?: PaginationOptions,
    ): Promise<ReviewSearchResult> {
        const where = this.buildWhereClause(filters);
        const orderBy = this.buildOrderBy(sort);
        const { skip, take } = this.getPagination(pagination);

        const [reviews, total] = await Promise.all([
            prisma.review_index.findMany({
                where,
                orderBy,
                skip,
                take,
                include: this.getInclude(),
            }),
            prisma.review_index.count({ where }),
        ]);

        const pageSize = pagination?.pageSize ?? reviews.length;
        const totalPages = Math.ceil(total / pageSize);

        return {
            reviews: reviews.map((r) => this.fromPrisma(r)),
            total,
            page: pagination?.page ?? 1,
            pageSize,
            totalPages,
            hasNext: (pagination?.page ?? 1) < totalPages,
            hasPrevious: (pagination?.page ?? 1) > 1,
        };
    }

    async fullTextSearch(
        query: string,
        options?: {
            filters?: ReviewSearchFilters;
            sort?: ReviewSortOptions;
            pagination?: PaginationOptions;
            minScore?: number;
        },
    ): Promise<ReviewSearchResult> {
        const where: Record<string, unknown> = {
            AND: [
                this.buildWhereClause(options?.filters ?? {}),
                {
                    OR: [
                        { title: { contains: query, mode: 'insensitive' } },
                        { abstract: { contains: query, mode: 'insensitive' } },
                        { conclusions: { contains: query, mode: 'insensitive' } },
                    ],
                },
            ],
        };

        const orderBy = this.buildOrderBy(options?.sort);
        const { skip, take } = this.getPagination(options?.pagination);

        const [reviews, total] = await Promise.all([
            prisma.review_index.findMany({
                where,
                orderBy,
                skip,
                take,
                include: this.getInclude(),
            }),
            prisma.review_index.count({ where }),
        ]);

        const pageSize = options?.pagination?.pageSize ?? reviews.length;
        const totalPages = Math.ceil(total / pageSize);

        return {
            reviews: reviews.map((r) => this.fromPrisma(r)),
            total,
            page: options?.pagination?.page ?? 1,
            pageSize,
            totalPages,
            hasNext: (options?.pagination?.page ?? 1) < totalPages,
            hasPrevious: (options?.pagination?.page ?? 1) > 1,
        };
    }

    async findByDatabaseId(databaseId: DatabaseIdentifier): Promise<ReviewIndex[]> {
        const dbIdRecords = await prisma.review_database_id.findMany({
            where: {
                source: databaseId.source,
                source_id: databaseId.id,
            },
        });

        if (dbIdRecords.length === 0) return [];

        const reviewIds = dbIdRecords.map((r) => r.review_id);
        const reviews = await prisma.review_index.findMany({
            where: { id: { in: reviewIds } },
            include: this.getInclude(),
        });

        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByDoi(doi: string): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { doi: { equals: doi, mode: 'insensitive' } },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByPmid(pmid: string): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { pmid },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByCochraneId(cochraneId: string): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { cochrane_id: cochraneId },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByDatabaseSource(source: DatabaseSource): Promise<ReviewIndex[]> {
        const dbIdRecords = await prisma.review_database_id.findMany({
            where: { source },
        });

        if (dbIdRecords.length === 0) return [];

        const reviewIds = dbIdRecords.map((r) => r.review_id);
        const reviews = await prisma.review_index.findMany({
            where: { id: { in: reviewIds } },
            include: this.getInclude(),
        });

        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByReviewType(type: ReviewType): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { review_type: type },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByPublicationStatus(status: PublicationStatus): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { publication_status: status },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByEvidenceQuality(quality: EvidenceQuality): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { evidence_quality: quality },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByQualityRating(rating: QualityRating): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: {
                quality_assessment: {
                    rating,
                },
            },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByMeshTerm(meshTerm: string): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { mesh_terms: { has: meshTerm } },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByKeyword(keyword: string): Promise<ReviewIndex[]> {
        const reviews = await prisma.review_index.findMany({
            where: { keywords: { has: keyword } },
            include: this.getInclude(),
        });
        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByAuthor(authorName: string): Promise<ReviewIndex[]> {
        const authorRecords = await prisma.review_author.findMany({
            where: { name: { contains: authorName, mode: 'insensitive' } },
        });

        if (authorRecords.length === 0) return [];

        const reviewIds = authorRecords.map((a) => a.review_id);
        const reviews = await prisma.review_index.findMany({
            where: { id: { in: reviewIds } },
            include: this.getInclude(),
        });

        return reviews.map((r) => this.fromPrisma(r));
    }

    async findByJournal(journalName: string): Promise<ReviewIndex[]> {
        const journalRecords = await prisma.review_journal.findMany({
            where: { name: { contains: journalName, mode: 'insensitive' } },
        });

        if (journalRecords.length === 0) return [];

        const reviewIds = journalRecords.map((j) => j.review_id);
        const reviews = await prisma.review_index.findMany({
            where: { id: { in: reviewIds } },
            include: this.getInclude(),
        });

        return reviews.map((r) => this.fromPrisma(r));
    }

    async findAll(pagination?: PaginationOptions): Promise<ReviewSearchResult> {
        const { skip, take } = this.getPagination(pagination);

        const [reviews, total] = await Promise.all([
            prisma.review_index.findMany({
                skip,
                take,
                include: this.getInclude(),
                orderBy: { created_at: 'desc' },
            }),
            prisma.review_index.count(),
        ]);

        const pageSize = pagination?.pageSize ?? reviews.length;
        const totalPages = Math.ceil(total / pageSize);

        return {
            reviews: reviews.map((r) => this.fromPrisma(r)),
            total,
            page: pagination?.page ?? 1,
            pageSize,
            totalPages,
            hasNext: (pagination?.page ?? 1) < totalPages,
            hasPrevious: (pagination?.page ?? 1) > 1,
        };
    }

    async count(filters?: ReviewSearchFilters): Promise<number> {
        return prisma.review_index.count({
            where: this.buildWhereClause(filters ?? {}),
        });
    }

    async exists(id: string): Promise<boolean> {
        const count = await prisma.review_index.count({ where: { id } });
        return count > 0;
    }

    // ============================================================================
    // Duplicate Detection
    // ============================================================================

    async detectDuplicates(
        review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>,
        options?: { threshold?: number; maxResults?: number },
    ): Promise<DuplicateDetectionResult> {
        const threshold = options?.threshold ?? 0.8;
        const maxResults = options?.maxResults ?? 10;

        const allReviews = await prisma.review_index.findMany({
            take: 1000,
            select: {
                id: true,
                title: true,
                doi: true,
                pmid: true,
            },
        });

        const potentialDuplicates = allReviews
            .map((r) => ({
                reviewId: r.id,
                title: r.title,
                similarity: this.calculateSimilarity(review.title, r.title),
            }))
            .filter((d) => d.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);

        return {
            hasDuplicates: potentialDuplicates.length > 0,
            potentialDuplicates,
            confidence: potentialDuplicates.length > 0 ? potentialDuplicates[0].similarity : 0,
        };
    }

    async findAllDuplicatePairs(options?: { threshold?: number; limit?: number }): Promise<
        Array<{
            review1: ReviewIndex;
            review2: ReviewIndex;
            similarity: number;
        }>
    > {
        const threshold = options?.threshold ?? 0.8;
        const limit = options?.limit ?? 100;

        const pairs = await prisma.duplicate_review_pair.findMany({
            where: { similarity: { gte: threshold } },
            take: limit,
        });

        const results: Array<{
            review1: ReviewIndex;
            review2: ReviewIndex;
            similarity: number;
        }> = [];

        for (const pair of pairs) {
            const [review1, review2] = await Promise.all([
                this.findById(pair.review1_id),
                this.findById(pair.review2_id),
            ]);

            if (review1 && review2) {
                results.push({
                    review1,
                    review2,
                    similarity: pair.similarity,
                });
            }
        }

        return results;
    }

    async markAsDuplicates(reviewId1: string, reviewId2: string): Promise<boolean> {
        try {
            const [review1, review2] = await Promise.all([
                prisma.review_index.findUnique({ where: { id: reviewId1 }, select: { title: true } }),
                prisma.review_index.findUnique({ where: { id: reviewId2 }, select: { title: true } }),
            ]);

            if (!review1 || !review2) return false;

            const similarity = this.calculateSimilarity(review1.title, review2.title);

            await prisma.duplicate_review_pair.create({
                data: {
                    review1_id: reviewId1,
                    review2_id: reviewId2,
                    similarity,
                    confidence: similarity,
                },
            });

            await prisma.review_related_review.upsert({
                where: {
                    review_id_related_id: {
                        review_id: reviewId1,
                        related_id: reviewId2,
                    },
                },
                create: {
                    review_id: reviewId1,
                    related_id: reviewId2,
                    relationship: 'DUPLICATE',
                },
                update: {},
            });

            return true;
        } catch {
            return false;
        }
    }

    async unmarkAsDuplicates(reviewId1: string, reviewId2: string): Promise<boolean> {
        try {
            await prisma.duplicate_review_pair.deleteMany({
                where: {
                    review1_id: reviewId1,
                    review2_id: reviewId2,
                },
            });

            await prisma.review_related_review.deleteMany({
                where: {
                    review_id: reviewId1,
                    related_id: reviewId2,
                    relationship: 'DUPLICATE',
                },
            });

            return true;
        } catch {
            return false;
        }
    }

    // ============================================================================
    // Version History
    // ============================================================================

    async getVersionHistory(
        id: string,
        options?: { limit?: number; includeFullData?: boolean },
    ): Promise<ReviewVersion[]> {
        const versions = await prisma.review_version.findMany({
            where: { review_id: id },
            orderBy: { created_at: 'desc' },
            take: options?.limit,
        });

        return versions.map((v) => ({
            version: v.version,
            review: v.review_data as unknown as ReviewIndex,
            createdAt: v.created_at,
            changeReason: v.change_reason ?? undefined,
            changedBy: v.changed_by ?? undefined,
        }));
    }

    async getVersion(id: string, version: string): Promise<ReviewIndex | null> {
        const versionRecord = await prisma.review_version.findUnique({
            where: {
                review_id_version: {
                    review_id: id,
                    version,
                },
            },
        });

        return versionRecord ? (versionRecord.review_data as unknown as ReviewIndex) : null;
    }

    async restoreVersion(id: string, version: string, reason?: string): Promise<ReviewIndex | null> {
        const versionRecord = await prisma.review_version.findUnique({
            where: {
                review_id_version: {
                    review_id: id,
                    version,
                },
            },
        });

        if (!versionRecord) return null;

        const reviewData = versionRecord.review_data as unknown as ReviewIndex;
        const { id: _, createdAt: __, updatedAt: ___, ...rest } = reviewData;

        return this.update(id, rest);
    }

    async deleteOldVersions(
        id: string,
        options?: { keepCount?: number; olderThan?: Date },
    ): Promise<number> {
        const where: { review_id: string; created_at?: { lt?: Date } } = { review_id: id };

        if (options?.olderThan) {
            where.created_at = { lt: options.olderThan };
        }

        const allVersions = await prisma.review_version.findMany({
            where,
            orderBy: { created_at: 'desc' },
            select: { id: true },
        });

        const keepCount = options?.keepCount ?? 10;
        const toDelete = allVersions.slice(keepCount);

        if (toDelete.length === 0) return 0;

        const result = await prisma.review_version.deleteMany({
            where: {
                id: { in: toDelete.map((v) => v.id) },
            },
        });

        return result.count;
    }

    // ============================================================================
    // Statistics and Analytics
    // ============================================================================

    async getStats(): Promise<ReviewIndexStats> {
        const [
            totalReviews,
            reviewsByType,
            reviewsByStatus,
            reviewsByEvidenceQuality,
            reviewsByDatabase,
            dateRange,
            totalIncludedStudies,
            totalParticipants,
        ] = await Promise.all([
            prisma.review_index.count(),
            this.getAggregatedStats('reviewType'),
            this.getAggregatedStats('publicationStatus'),
            this.getAggregatedStats('evidenceQuality'),
            this.getAggregatedStats('databaseSource'),
            prisma.review_index.aggregate({
                _min: { publication_date: true },
                _max: { publication_date: true },
            }),
            prisma.review_index.aggregate({
                _sum: { included_studies_count: true },
            }),
            prisma.review_index.aggregate({
                _sum: { total_participants_count: true },
            }),
        ]);

        return {
            totalReviews,
            reviewsByType: reviewsByType as Record<ReviewType, number>,
            reviewsByStatus: reviewsByStatus as Record<PublicationStatus, number>,
            reviewsByEvidenceQuality: reviewsByEvidenceQuality as Record<EvidenceQuality, number>,
            reviewsByDatabase: reviewsByDatabase as Record<DatabaseSource, number>,
            reviewsByQualityRating: {} as Record<QualityRating, number>,
            dateRange: {
                earliest: dateRange._min.publication_date ?? new Date(),
                latest: dateRange._max.publication_date ?? new Date(),
            },
            totalIncludedStudies: totalIncludedStudies._sum.included_studies_count ?? 0,
            totalParticipants: totalParticipants._sum.total_participants_count ?? 0,
            syncStatusByDatabase: {} as Record<DatabaseSource, SyncStatus>,
        };
    }

    async getAggregatedStats(
        field:
            | 'reviewType'
            | 'publicationStatus'
            | 'evidenceQuality'
            | 'qualityRating'
            | 'databaseSource'
            | 'journal',
        options?: {
            dateRange?: { start: Date; end: Date };
            filters?: ReviewSearchFilters;
        },
    ): Promise<Record<string, number>> {
        const where: Record<string, unknown> = {};

        if (options?.dateRange) {
            where['created_at'] = {
                gte: options.dateRange.start,
                lte: options.dateRange.end,
            };
        }

        if (options?.filters) {
            Object.assign(where, this.buildWhereClause(options.filters));
        }

        switch (field) {
            case 'reviewType': {
                const results = await prisma.review_index.groupBy({
                    by: ['review_type'],
                    where,
                    _count: true,
                });
                return results.reduce((acc, r) => {
                    acc[r.review_type] = r._count;
                    return acc;
                }, {} as Record<string, number>);
            }
            case 'publicationStatus': {
                const results = await prisma.review_index.groupBy({
                    by: ['publication_status'],
                    where,
                    _count: true,
                });
                return results.reduce((acc, r) => {
                    acc[r.publication_status] = r._count;
                    return acc;
                }, {} as Record<string, number>);
            }
            case 'evidenceQuality': {
                const results = await prisma.review_index.groupBy({
                    by: ['evidence_quality'],
                    where,
                    _count: true,
                });
                return results.reduce((acc, r) => {
                    acc[r.evidence_quality ?? 'unknown'] = r._count;
                    return acc;
                }, {} as Record<string, number>);
            }
            case 'qualityRating': {
                const results = await prisma.review_quality_assessment.groupBy({
                    by: ['rating'],
                    where: Object.keys(where).length > 0 ? { review: where } : undefined,
                    _count: true,
                });
                return results.reduce((acc, r) => {
                    acc[r.rating ?? 'unknown'] = r._count;
                    return acc;
                }, {} as Record<string, number>);
            }
            case 'databaseSource': {
                const dbStats = await prisma.review_database_id.groupBy({
                    by: ['source'],
                    _count: true,
                });
                return dbStats.reduce((acc, r) => {
                    acc[r.source] = r._count;
                    return acc;
                }, {} as Record<string, number>);
            }
            case 'journal': {
                const journalStats = await prisma.review_journal.groupBy({
                    by: ['name'],
                    _count: true,
                    orderBy: { _count: { name: 'desc' } },
                    take: 50,
                });
                return journalStats.reduce((acc, r) => {
                    const count = typeof r._count === 'number' ? r._count : 1;
                    acc[r.name] = count;
                    return acc;
                }, {} as Record<string, number>);
            }
            default:
                return {};
        }
    }

    async getTimeSeriesData(options?: {
        start?: Date;
        end?: Date;
        interval?: 'day' | 'week' | 'month' | 'year';
        field?: 'createdAt' | 'updatedAt' | 'publicationDate';
    }): Promise<Array<{ date: Date; count: number }>> {
        const start = options?.start ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const end = options?.end ?? new Date();
        const field = options?.field ?? 'createdAt';
        const interval = options?.interval ?? 'month';

        const prismaField = field === 'createdAt' ? 'created_at' : field === 'updatedAt' ? 'updated_at' : field === 'publicationDate' ? 'publication_date' : `${field}_at`;

        // Use $queryRawUnsafe for dynamic column names
        const reviews = await prisma.$queryRawUnsafe<Array<{ date: Date; count: number }>>(
            `SELECT
                date_trunc($1::text, ${prismaField}::timestamp) AS date,
                COUNT(*) AS count
            FROM review_index
            WHERE ${prismaField} >= $2 AND ${prismaField} <= $3
            GROUP BY date
            ORDER BY date`,
            interval,
            start,
            end
        );

        return reviews;
    }

    // ============================================================================
    // Export Operations
    // ============================================================================

    async exportReviews(options: ExportOptions): Promise<ExportResult> {
        const { format, filters, fields } = options;

        const where = this.buildWhereClause(filters ?? {});
        const reviews = await prisma.review_index.findMany({
            where,
            include: this.getInclude(),
            take: 10000,
        });

        const reviewData = reviews.map((r) => {
            const converted = this.fromPrisma(r);
            if (fields && fields.length > 0) {
                const obj: Record<string, unknown> = {};
                for (const f of fields) {
                    obj[f] = (converted as unknown as Record<string, unknown>)[f];
                }
                return obj;
            }
            return converted;
        });

        const exportId = `export-${Date.now()}`;
        const downloadUrl = `/exports/${exportId}.${format.toLowerCase()}`;
        const now = new Date();

        await prisma.export_job.create({
            data: {
                id: exportId,
                format: format as unknown as 'JSON' | 'CSV' | 'EXCEL' | 'XML' | 'BIBTEX' | 'RIS',
                record_count: reviewData.length,
                file_size: BigInt(JSON.stringify(reviewData).length),
                download_url: downloadUrl,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                options: options as unknown as Prisma.InputJsonValue,
            },
        });

        return {
            id: exportId,
            format,
            recordCount: reviewData.length,
            downloadUrl,
            fileSize: JSON.stringify(reviewData).length,
            createdAt: now,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
    }

    async getExportStatus(exportId: string): Promise<ExportResult | null> {
        const job = await prisma.export_job.findUnique({ where: { id: exportId } });

        if (!job) return null;

        return {
            id: job.id,
            format: job.format as unknown as ExportFormat,
            recordCount: job.record_count,
            downloadUrl: job.download_url,
            fileSize: Number(job.file_size),
            createdAt: job.created_at,
            expiresAt: job.expires_at,
        };
    }

    async deleteExport(exportId: string): Promise<boolean> {
        try {
            await prisma.export_job.delete({ where: { id: exportId } });
            return true;
        } catch {
            return false;
        }
    }

    // ============================================================================
    // Maintenance Operations
    // ============================================================================

    async rebuildSearchIndexes(options?: { indexes?: string[] }): Promise<void> {
        await prisma.$executeRaw`REINDEX TABLE review_index`;
    }

    async optimizeStorage(): Promise<void> {
        await prisma.$executeRaw`VACUUM ANALYZE`;
    }

    async validateDataIntegrity(): Promise<{
        valid: boolean;
        recordsChecked: number;
        issuesFound: number;
        issues: Array<{ recordId: string; issue: string; severity: 'error' | 'warning' }>;
    }> {
        const issues: Array<{ recordId: string; issue: string; severity: 'error' | 'warning' }> = [];

        const withoutAuthors = await prisma.review_index.findMany({
            where: { authors: { none: {} } },
            take: 100,
        });

        for (const review of withoutAuthors) {
            issues.push({
                recordId: review.id,
                issue: 'Review has no authors',
                severity: 'warning',
            });
        }

        const total = await prisma.review_index.count();

        return {
            valid: issues.filter((i) => i.severity === 'error').length === 0,
            recordsChecked: total,
            issuesFound: issues.length,
            issues,
        };
    }

    async getHealthStatus(): Promise<{
        healthy: boolean;
        connected: boolean;
        latency?: number;
        activeConnections?: number;
        storageUsage?: { used: number; total: number; percentage: number };
        metrics?: Record<string, unknown>;
    }> {
        const startTime = Date.now();

        try {
            await prisma.$queryRaw`SELECT 1`;
            const latency = Date.now() - startTime;

            const sizeResult = await prisma.$queryRaw<Array<{ size: string }>>`
                SELECT pg_size_pretty(pg_database_size(current_database())) as size
            `;

            return {
                healthy: true,
                connected: true,
                latency,
                metrics: {
                    databaseSize: sizeResult[0]?.size,
                },
            };
        } catch {
            return {
                healthy: false,
                connected: false,
            };
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        await prisma.$connect();
        this.initialized = true;
    }

    async close(): Promise<void> {
        await prisma.$disconnect();
        this.initialized = false;
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    private getInclude() {
        return {
            authors: true,
            database_ids: true,
            journal: true,
            eligibility_criteria: true,
            pico: true,
            sync_metadata: true,
            quality_assessment: {
                include: {
                    domain_scores: true,
                },
            },
            urls: true,
            related_reviews: true,
            versions: {
                take: 10,
                orderBy: { created_at: 'desc' as const },
            },
        };
    }

    private toPrismaCreateData(review: Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>) {
        const contentHash = this.generateContentHash(review);

        return {
            title: review.title,
            alternative_titles: review.alternativeTitles ?? [],
            review_type: review.reviewType,
            publication_status: review.publicationStatus,
            doi: review.doi,
            pmid: review.pmid,
            cochrane_id: review.cochraneId,
            publication_date: review.publicationDate,
            last_updated_date: review.lastUpdatedDate,
            abstract: review.abstract,
            keywords: review.keywords ?? [],
            mesh_terms: review.meshTerms ?? [],
            research_questions: review.researchQuestions ?? [],
            conclusions: review.conclusions,
            included_studies_count: review.includedStudiesCount,
            total_participants_count: review.totalParticipantsCount,
            evidence_quality: review.evidenceQuality ?? null,
            funding: review.funding ?? [],
            conflicts_of_interest: review.conflictsOfInterest,
            custom_metadata: review.customMetadata as Prisma.InputJsonValue,
            content_hash: contentHash,
            authors: {
                create: review.authors.map((a, i) => ({
                    name: a.name,
                    initials: a.initials,
                    affiliation: a.affiliation,
                    orcid: a.orcid,
                    role: (a.role ?? 'CO_AUTHOR') as 'PRIMARY' | 'CORRESPONDING' | 'CO_AUTHOR' | 'REVIEWER',
                    position: i,
                })),
            },
            database_ids: {
                create: review.databaseIds.map((dbId) => ({
                    source: dbId.source,
                    source_id: dbId.id,
                    version: dbId.version,
                })),
            },
            journal: review.journal
                ? {
                    create: {
                        name: review.journal.name,
                        abbreviation: review.journal.abbreviation,
                        issn: review.journal.issn,
                        eissn: review.journal.eissn,
                        publisher: review.journal.publisher,
                        volume: review.journal.volume,
                        issue: review.journal.issue,
                        pages: review.journal.pages,
                        article_number: review.journal.articleNumber,
                    },
                }
                : undefined,
            eligibility_criteria: review.eligibilityCriteria
                ? {
                    create: {
                        inclusion_criteria: review.eligibilityCriteria.inclusionCriteria ?? [],
                        exclusion_criteria: review.eligibilityCriteria.exclusionCriteria ?? [],
                        study_designs: review.eligibilityCriteria.studyDesigns ?? [],
                        population: review.eligibilityCriteria.population,
                        intervention: review.eligibilityCriteria.intervention,
                        comparison: review.eligibilityCriteria.comparison,
                        outcomes: review.eligibilityCriteria.outcomes ?? [],
                    },
                }
                : undefined,
            pico: review.pico
                ? {
                    create: {
                        population: review.pico.population,
                        intervention: review.pico.intervention,
                        comparison: review.pico.comparison,
                        outcome: review.pico.outcome,
                        study_design: review.pico.studyDesign,
                        timeframe: review.pico.timeframe,
                    },
                }
                : undefined,
            sync_metadata: {
                create: {
                    status: (review.syncMetadata.status ?? 'SYNCED') as 'SYNCED' | 'SYNCING' | 'FAILED' | 'PARTIAL' | 'PENDING' | 'STALE',
                    synced_databases: review.syncMetadata.syncedDatabases,
                    sync_version: review.syncMetadata.syncVersion ?? 1,
                    primary_source: review.syncMetadata.primarySource,
                },
            },
            quality_assessment: review.qualityAssessment
                ? {
                    create: {
                        tool: review.qualityAssessment.tool,
                        overall_score: review.qualityAssessment.overallScore,
                        max_score: review.qualityAssessment.maxScore,
                        rating: review.qualityAssessment.rating ?? null,
                        assessed_at: review.qualityAssessment.assessedAt,
                        comments: review.qualityAssessment.comments,
                        domain_scores: review.qualityAssessment.domainScores
                            ? {
                                create: review.qualityAssessment.domainScores.map((d) => ({
                                    domain: d.domain,
                                    score: d.score,
                                    max_score: d.maxScore,
                                    comments: d.comments,
                                })),
                            }
                            : undefined,
                    },
                }
                : undefined,
            urls: review.urls
                ? {
                    create: review.urls.map((u) => ({
                        type: (u.type ?? 'DATABASE_ENTRY') as 'FULL_TEXT' | 'ABSTRACT' | 'DATABASE_ENTRY' | 'SUPPLEMENTARY' | 'PROTOCOL' | 'PREPRINT' | 'PUBLISHER',
                        url: u.url,
                        description: u.description,
                        access: (u.access ?? 'UNKNOWN') as 'OPEN' | 'SUBSCRIPTION' | 'PAY_PER_VIEW' | 'UNKNOWN',
                    })),
                }
                : undefined,
        };
    }

    private toPrismaUpdateData(updates: Partial<Omit<ReviewIndex, 'id' | 'createdAt'>>): Record<string, unknown> {
        const data: Record<string, unknown> = {};

        if (updates.title !== undefined) data['title'] = updates.title;
        if (updates.alternativeTitles !== undefined) data['alternative_titles'] = updates.alternativeTitles;
        if (updates.reviewType !== undefined) data['review_type'] = updates.reviewType;
        if (updates.publicationStatus !== undefined) data['publication_status'] = updates.publicationStatus;
        if (updates.doi !== undefined) data['doi'] = updates.doi;
        if (updates.pmid !== undefined) data['pmid'] = updates.pmid;
        if (updates.cochraneId !== undefined) data['cochrane_id'] = updates.cochraneId;
        if (updates.publicationDate !== undefined) data['publication_date'] = updates.publicationDate;
        if (updates.lastUpdatedDate !== undefined) data['last_updated_date'] = updates.lastUpdatedDate;
        if (updates.abstract !== undefined) data['abstract'] = updates.abstract;
        if (updates.keywords !== undefined) data['keywords'] = updates.keywords;
        if (updates.meshTerms !== undefined) data['mesh_terms'] = updates.meshTerms;
        if (updates.researchQuestions !== undefined) data['research_questions'] = updates.researchQuestions;
        if (updates.conclusions !== undefined) data['conclusions'] = updates.conclusions;
        if (updates.includedStudiesCount !== undefined) data['included_studies_count'] = updates.includedStudiesCount;
        if (updates.totalParticipantsCount !== undefined) data['total_participants_count'] = updates.totalParticipantsCount;
        if (updates.evidenceQuality !== undefined) data['evidence_quality'] = updates.evidenceQuality;
        if (updates.funding !== undefined) data['funding'] = updates.funding;
        if (updates.conflictsOfInterest !== undefined) data['conflicts_of_interest'] = updates.conflictsOfInterest;
        if (updates.customMetadata !== undefined) data['custom_metadata'] = updates.customMetadata;

        if (
            updates.title ||
            updates.abstract ||
            updates.authors ||
            updates.publicationDate ||
            updates.doi
        ) {
            data['content_hash'] = this.generateContentHash(updates);
        }

        if (updates.authors !== undefined) {
            data['authors'] = {
                deleteMany: {},
                create: updates.authors.map((a, i) => ({
                    name: a.name,
                    initials: a.initials,
                    affiliation: a.affiliation,
                    orcid: a.orcid,
                    role: (a.role ?? 'CO_AUTHOR') as 'PRIMARY' | 'CORRESPONDING' | 'CO_AUTHOR' | 'REVIEWER',
                    position: i,
                })),
            };
        }

        if (updates.databaseIds !== undefined) {
            data['database_ids'] = {
                deleteMany: {},
                create: updates.databaseIds.map((dbId) => ({
                    source: dbId.source,
                    source_id: dbId.id,
                    version: dbId.version,
                })),
            };
        }

        if (updates.journal !== undefined) {
            data['journal'] = {
                upsert: {
                    create: {
                        name: updates.journal.name,
                        abbreviation: updates.journal.abbreviation,
                        issn: updates.journal.issn,
                        eissn: updates.journal.eissn,
                        publisher: updates.journal.publisher,
                        volume: updates.journal.volume,
                        issue: updates.journal.issue,
                        pages: updates.journal.pages,
                        article_number: updates.journal.articleNumber,
                    },
                    update: {
                        name: updates.journal.name,
                        abbreviation: updates.journal.abbreviation,
                        issn: updates.journal.issn,
                        eissn: updates.journal.eissn,
                        publisher: updates.journal.publisher,
                        volume: updates.journal.volume,
                        issue: updates.journal.issue,
                        pages: updates.journal.pages,
                        article_number: updates.journal.articleNumber,
                    },
                },
            };
        }

        if (updates.eligibilityCriteria !== undefined) {
            data['eligibility_criteria'] = {
                upsert: {
                    create: {
                        inclusion_criteria: updates.eligibilityCriteria.inclusionCriteria ?? [],
                        exclusion_criteria: updates.eligibilityCriteria.exclusionCriteria ?? [],
                        study_designs: updates.eligibilityCriteria.studyDesigns ?? [],
                        population: updates.eligibilityCriteria.population,
                        intervention: updates.eligibilityCriteria.intervention,
                        comparison: updates.eligibilityCriteria.comparison,
                        outcomes: updates.eligibilityCriteria.outcomes ?? [],
                    },
                    update: {
                        inclusion_criteria: updates.eligibilityCriteria.inclusionCriteria ?? [],
                        exclusion_criteria: updates.eligibilityCriteria.exclusionCriteria ?? [],
                        study_designs: updates.eligibilityCriteria.studyDesigns ?? [],
                        population: updates.eligibilityCriteria.population,
                        intervention: updates.eligibilityCriteria.intervention,
                        comparison: updates.eligibilityCriteria.comparison,
                        outcomes: updates.eligibilityCriteria.outcomes ?? [],
                    },
                },
            };
        }

        if (updates.pico !== undefined) {
            data['pico'] = {
                upsert: {
                    create: {
                        population: updates.pico.population,
                        intervention: updates.pico.intervention,
                        comparison: updates.pico.comparison,
                        outcome: updates.pico.outcome,
                        study_design: updates.pico.studyDesign,
                        timeframe: updates.pico.timeframe,
                    },
                    update: {
                        population: updates.pico.population,
                        intervention: updates.pico.intervention,
                        comparison: updates.pico.comparison,
                        outcome: updates.pico.outcome,
                        study_design: updates.pico.studyDesign,
                        timeframe: updates.pico.timeframe,
                    },
                },
            };
        }

        if (updates.syncMetadata !== undefined) {
            data['sync_metadata'] = {
                update: {
                    status: (updates.syncMetadata.status ?? 'SYNCED') as 'SYNCED' | 'SYNCING' | 'FAILED' | 'PARTIAL' | 'PENDING' | 'STALE',
                    synced_databases: updates.syncMetadata.syncedDatabases,
                    sync_version: updates.syncMetadata.syncVersion ?? 1,
                    primary_source: updates.syncMetadata.primarySource,
                },
            };
        }

        if (updates.qualityAssessment !== undefined) {
            data['quality_assessment'] = {
                upsert: {
                    create: {
                        tool: updates.qualityAssessment.tool,
                        overall_score: updates.qualityAssessment.overallScore,
                        max_score: updates.qualityAssessment.maxScore,
                        rating: updates.qualityAssessment.rating ?? null,
                        assessed_at: updates.qualityAssessment.assessedAt,
                        comments: updates.qualityAssessment.comments,
                        domain_scores: updates.qualityAssessment.domainScores
                            ? {
                                create: updates.qualityAssessment.domainScores.map((d) => ({
                                    domain: d.domain,
                                    score: d.score,
                                    max_score: d.maxScore,
                                    comments: d.comments,
                                })),
                            }
                            : undefined,
                    },
                    update: {
                        tool: updates.qualityAssessment.tool,
                        overall_score: updates.qualityAssessment.overallScore,
                        max_score: updates.qualityAssessment.maxScore,
                        rating: updates.qualityAssessment.rating ?? null,
                        assessed_at: updates.qualityAssessment.assessedAt,
                        comments: updates.qualityAssessment.comments,
                    },
                },
            };
        }

        if (updates.urls !== undefined) {
            data['urls'] = {
                deleteMany: {},
                create: updates.urls.map((u) => ({
                    type: (u.type ?? 'DATABASE_ENTRY') as 'FULL_TEXT' | 'ABSTRACT' | 'DATABASE_ENTRY' | 'SUPPLEMENTARY' | 'PROTOCOL' | 'PREPRINT' | 'PUBLISHER',
                    url: u.url,
                    description: u.description,
                    access: (u.access ?? 'UNKNOWN') as 'OPEN' | 'SUBSCRIPTION' | 'PAY_PER_VIEW' | 'UNKNOWN',
                })),
            };
        }

        return data;
    }

    private fromPrisma(
        review: Prisma.review_indexGetPayload<{
            include: ReturnType<PrismaReviewStorage['getInclude']>;
        }>,
    ): ReviewIndex {
        if (!review) {
            throw new Error('Review is null or undefined');
        }

        return {
            id: review.id,
            title: review.title,
            alternativeTitles: review.alternative_titles,
            reviewType: review.review_type as ReviewType,
            publicationStatus: review.publication_status as PublicationStatus,
            doi: review.doi ?? undefined,
            pmid: review.pmid ?? undefined,
            cochraneId: review.cochrane_id ?? undefined,
            publicationDate: review.publication_date ?? undefined,
            lastUpdatedDate: review.last_updated_date ?? undefined,
            authors: review.authors.map((a) => ({
                name: a.name,
                initials: a.initials ?? undefined,
                affiliation: a.affiliation ?? undefined,
                orcid: a.orcid ?? undefined,
                role: a.role as AuthorRole,
            })),
            databaseIds: review.database_ids.map((dbId) => ({
                source: dbId.source as DatabaseSource,
                id: dbId.source_id,
                version: dbId.version ?? undefined,
            })),
            journal: review.journal
                ? {
                    name: review.journal.name,
                    abbreviation: review.journal.abbreviation ?? undefined,
                    issn: review.journal.issn ?? undefined,
                    eissn: review.journal.eissn ?? undefined,
                    publisher: review.journal.publisher ?? undefined,
                    volume: review.journal.volume ?? undefined,
                    issue: review.journal.issue ?? undefined,
                    pages: review.journal.pages ?? undefined,
                    articleNumber: review.journal.article_number ?? undefined,
                }
                : undefined,
            abstract: review.abstract ?? undefined,
            meshTerms: review.mesh_terms,
            keywords: review.keywords,
            researchQuestions: review.research_questions,
            eligibilityCriteria: review.eligibility_criteria
                ? {
                    inclusionCriteria: review.eligibility_criteria.inclusion_criteria,
                    exclusionCriteria: review.eligibility_criteria.exclusion_criteria,
                    studyDesigns: review.eligibility_criteria.study_designs,
                    population: review.eligibility_criteria.population ?? undefined,
                    intervention: review.eligibility_criteria.intervention ?? undefined,
                    comparison: review.eligibility_criteria.comparison ?? undefined,
                    outcomes: review.eligibility_criteria.outcomes,
                }
                : undefined,
            includedStudiesCount: review.included_studies_count ?? undefined,
            totalParticipantsCount: review.total_participants_count ?? undefined,
            pico: review.pico
                ? {
                    population: review.pico.population ?? undefined,
                    intervention: review.pico.intervention ?? undefined,
                    comparison: review.pico.comparison ?? undefined,
                    outcome: review.pico.outcome ?? undefined,
                    studyDesign: review.pico.study_design ?? undefined,
                    timeframe: review.pico.timeframe ?? undefined,
                }
                : undefined,
            conclusions: review.conclusions ?? undefined,
            evidenceQuality: review.evidence_quality as EvidenceQuality | undefined,
            funding: review.funding,
            conflictsOfInterest: review.conflicts_of_interest ?? undefined,
            urls: review.urls.map((u) => ({
                type: u.type as UrlType,
                url: u.url,
                description: u.description ?? undefined,
                access: u.access as AccessLevel,
            })),
            syncMetadata: {
                status: review.sync_metadata!.status as SyncStatus,
                syncedDatabases: review.sync_metadata!.synced_databases as DatabaseSource[],
                syncVersion: review.sync_metadata!.sync_version,
                primarySource: review.sync_metadata!.primary_source as DatabaseSource,
                firstSyncedAt: review.sync_metadata!.first_synced_at,
                lastSyncedAt: review.sync_metadata!.last_synced_at,
            },
            qualityAssessment: review.quality_assessment
                ? {
                    tool: review.quality_assessment.tool ?? undefined,
                    overallScore: review.quality_assessment.overall_score ?? undefined,
                    maxScore: review.quality_assessment.max_score ?? undefined,
                    rating: review.quality_assessment.rating as QualityRating | undefined,
                    assessedAt: review.quality_assessment.assessed_at ?? undefined,
                    comments: review.quality_assessment.comments ?? undefined,
                    domainScores: review.quality_assessment.domain_scores.map((d) => ({
                        domain: d.domain,
                        score: d.score,
                        maxScore: d.max_score,
                        comments: d.comments ?? undefined,
                    })),
                }
                : undefined,
            relatedReviews: review.related_reviews.map((rr) => ({
                reviewId: rr.related_id,
                relationship: rr.relationship as ReviewRelationship,
                description: rr.description ?? undefined,
            })),
            customMetadata: review.custom_metadata as Record<string, unknown> | undefined,
            createdAt: review.created_at,
            updatedAt: review.updated_at,
        };
    }

    private buildWhereClause(filters: ReviewSearchFilters): Record<string, unknown> {
        const where: Record<string, unknown> = {};
        const and: Record<string, unknown>[] = [];

        if (filters.reviewType && filters.reviewType.length > 0) {
            where['review_type'] = { in: filters.reviewType };
        }

        if (filters.publicationStatus && filters.publicationStatus.length > 0) {
            where['publication_status'] = { in: filters.publicationStatus };
        }

        if (filters.evidenceQuality && filters.evidenceQuality.length > 0) {
            where['evidence_quality'] = { in: filters.evidenceQuality };
        }

        if (filters.databaseSource) {
            and.push({
                database_ids: {
                    some: {
                        source: filters.databaseSource,
                    },
                },
            });
        }

        if (filters.authors) {
            and.push({
                authors: {
                    some: {
                        name: { contains: filters.authors, mode: 'insensitive' },
                    },
                },
            });
        }

        if (filters.journal) {
            and.push({
                journal: {
                    name: { contains: filters.journal, mode: 'insensitive' },
                },
            });
        }

        if (filters.keywords) {
            and.push({
                keywords: { hasSome: filters.keywords },
            });
        }

        if (filters.meshTerms) {
            and.push({
                mesh_terms: { hasSome: filters.meshTerms },
            });
        }

        if (filters.publicationDateRange) {
            and.push({
                publication_date: {
                    gte: filters.publicationDateRange.start,
                    lte: filters.publicationDateRange.end,
                },
            });
        }

        if (filters.title) {
            and.push({
                title: { contains: filters.title, mode: 'insensitive' },
            });
        }

        if (filters.abstract) {
            and.push({
                abstract: { contains: filters.abstract, mode: 'insensitive' },
            });
        }

        if (and.length > 0) {
            where['AND'] = and;
        }

        return where;
    }

    private buildOrderBy(sort?: ReviewSortOptions): Record<string, 'asc' | 'desc'> | undefined {
        if (!sort) return { created_at: 'desc' };

        const fieldMap: Record<string, 'title' | 'publication_date' | 'created_at' | 'updated_at' | 'included_studies_count'> = {
            title: 'title',
            publicationDate: 'publication_date',
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            includedStudiesCount: 'included_studies_count',
        };

        const field = fieldMap[sort.field] ?? 'created_at';
        return { [field]: sort.direction === 'ASC' ? 'asc' : 'desc' };
    }

    private getPagination(pagination?: PaginationOptions): { skip?: number; take?: number } {
        if (!pagination) return {};

        const skip = pagination.page && pagination.pageSize ? (pagination.page - 1) * pagination.pageSize : 0;
        const take = pagination.pageSize;

        return { skip, take };
    }

    private generateContentHash(review: Partial<Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'>>): string {
        const keyData = JSON.stringify({
            title: review.title,
            doi: review.doi,
            pmid: review.pmid,
            cochraneId: review.cochraneId,
            publicationDate: review.publicationDate,
            abstract: review.abstract,
        });

        let hash = 0;
        for (let i = 0; i < keyData.length; i++) {
            const char = keyData.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const words1 = new Set(str1.toLowerCase().split(/\s+/));
        const words2 = new Set(str2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter((x) => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }
}
