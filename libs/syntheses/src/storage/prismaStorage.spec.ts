import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from 'syntheses-db';
import { PrismaReviewStorage } from './prismaStorage';
import type {
    ReviewIndex,
    ReviewType,
    PublicationStatus,
    EvidenceQuality,
    QualityRating,
    DatabaseSource,
    AuthorRole,
    UrlType,
    AccessLevel,
    SyncStatus,
    ReviewRelationship,
    SortField,
    SortDirection,
} from '../types';

/**
 * Integration tests for PrismaReviewStorage
 * These tests use the actual Prisma client without mocking
 */
describe('PrismaReviewStorage Integration Tests', () => {
    let storage: PrismaReviewStorage;

    // Test data fixtures
    const createTestReview = (overrides?: Partial<ReviewIndex>): Omit<ReviewIndex, 'id' | 'createdAt' | 'updatedAt'> => ({
        title: 'Test Systematic Review',
        alternativeTitles: ['Alternative Title'],
        reviewType: 'SYSTEMATIC_REVIEW' as ReviewType,
        publicationStatus: 'PUBLISHED' as PublicationStatus,
        doi: '10.1234/test.doi.' + Date.now(),
        pmid: `PMID-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        cochraneId: `CDR-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        publicationDate: new Date('2023-01-15'),
        lastUpdatedDate: new Date('2023-06-01'),
        authors: [
            {
                name: 'John Doe',
                initials: 'J',
                affiliation: 'Test University',
                orcid: '0000-0001-2345-6789',
                role: 'PRIMARY' as AuthorRole,
            },
            {
                name: 'Jane Smith',
                initials: 'J',
                affiliation: 'Test University',
                role: 'CORRESPONDING' as AuthorRole,
            },
        ],
        databaseIds: [
            { source: 'PUBMED' as DatabaseSource, id: `pmid-${Date.now()}-${Math.random().toString(36).substring(7)}` },
            { source: 'COCHRANE' as DatabaseSource, id: `cochrane-${Date.now()}-${Math.random().toString(36).substring(7)}` },
        ],
        journal: {
            name: 'Test Medical Journal',
            abbreviation: 'Test Med J',
            issn: '1234-5678',
            eissn: '1234-5679',
            publisher: 'Test Publisher',
            volume: '10',
            issue: '2',
            pages: '123-145',
        },
        abstract: 'This is a test abstract for the systematic review.',
        meshTerms: ['Cardiovascular Diseases', 'Hypertension'],
        keywords: ['systematic review', 'meta-analysis', 'cardiology'],
        researchQuestions: ['What is the efficacy of the treatment?'],
        eligibilityCriteria: {
            inclusionCriteria: ['Randomized controlled trials', 'Adults 18+'],
            exclusionCriteria: ['Animal studies', 'Case reports'],
            studyDesigns: ['RCT', 'Cohort study'],
            population: 'Adults with hypertension',
            intervention: 'ACE inhibitors',
            comparison: 'Placebo',
            outcomes: ['Blood pressure reduction', 'Mortality'],
        },
        includedStudiesCount: 25,
        totalParticipantsCount: 5000,
        pico: {
            population: 'Adults with hypertension',
            intervention: 'ACE inhibitors',
            comparison: 'Placebo or other antihypertensives',
            outcome: 'Blood pressure reduction',
            studyDesign: 'Randomized controlled trials',
            timeframe: 'January 2000 - December 2022',
        },
        conclusions: 'ACE inhibitors are effective in reducing blood pressure in adults with hypertension.',
        evidenceQuality: 'HIGH' as EvidenceQuality,
        funding: ['National Institutes of Health', 'Test Foundation'],
        conflictsOfInterest: 'None declared',
        urls: [
            {
                type: 'FULL_TEXT' as UrlType,
                url: 'https://example.com/full-text',
                description: 'Full text article',
                access: 'OPEN' as AccessLevel,
            },
            {
                type: 'ABSTRACT' as UrlType,
                url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
                description: 'PubMed entry',
                access: 'OPEN' as AccessLevel,
            },
        ],
        syncMetadata: {
            status: 'SYNCED' as SyncStatus,
            syncedDatabases: ['PUBMED' as DatabaseSource, 'COCHRANE' as DatabaseSource],
            syncVersion: 1,
            primarySource: 'PUBMED' as DatabaseSource,
            firstSyncedAt: new Date('2023-01-01'),
            lastSyncedAt: new Date('2023-06-01'),
        },
        qualityAssessment: {
            tool: 'AMSTAR 2',
            overallScore: 8,
            maxScore: 10,
            rating: 'HIGH' as QualityRating,
            assessedAt: new Date('2023-02-01'),
            comments: 'High quality systematic review',
            domainScores: [
                { domain: 'Study design', score: 2, maxScore: 2 },
                { domain: 'Risk of bias', score: 1, maxScore: 2 },
            ],
        },
        relatedReviews: [
            {
                reviewId: 'related-review-id',
                relationship: 'UPDATE' as ReviewRelationship,
                description: 'Updated version of previous review',
            },
        ],
        customMetadata: {
            reviewer: 'Test Reviewer',
            tags: ['cardiology', 'hypertension'],
        },
        ...overrides,
    });

    beforeAll(async () => {
        storage = new PrismaReviewStorage();
        await storage.initialize();
    });

    afterAll(async () => {
        await storage.close();
    });

    beforeEach(async () => {
        // Clean up database before each test - must be in reverse dependency order
        await prisma.duplicate_review_pair.deleteMany({});
        await prisma.review_related_review.deleteMany({});
        await prisma.review_url.deleteMany({});
        await prisma.review_domain_score.deleteMany({});
        await prisma.review_quality_assessment.deleteMany({});
        await prisma.review_sync_metadata.deleteMany({});
        await prisma.review_pico.deleteMany({});
        await prisma.review_eligibility_criteria.deleteMany({});
        await prisma.review_journal.deleteMany({});
        await prisma.review_database_id.deleteMany({});
        await prisma.review_author.deleteMany({});
        await prisma.review_version.deleteMany({});
        await prisma.review_index.deleteMany({});
    });

    describe('CRUD Operations', () => {
        it('should create a new review', async () => {
            const reviewData = createTestReview();
            const created = await storage.create(reviewData);

            expect(created).toBeDefined();
            expect(created.id).toBeDefined();
            expect(created.title).toBe(reviewData.title);
            expect(created.doi).toBe(reviewData.doi);
            expect(created.authors).toHaveLength(2);
            expect(created.databaseIds).toHaveLength(2);
            expect(created.journal).toBeDefined();
            expect(created.eligibilityCriteria).toBeDefined();
            expect(created.pico).toBeDefined();
            expect(created.qualityAssessment).toBeDefined();
        });

        it('should find a review by id', async () => {
            const reviewData = createTestReview();
            const created = await storage.create(reviewData);
            const found = await storage.findById(created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.title).toBe(reviewData.title);
        });

        it('should return null when finding non-existent review', async () => {
            const found = await storage.findById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeNull();
        });

        it('should find multiple reviews by ids', async () => {
            const review1 = await storage.create(createTestReview({ doi: `10.1234/test.1.${Date.now()}` }));
            const review2 = await storage.create(createTestReview({ doi: `10.1234/test.2.${Date.now()}` }));
            const review3 = await storage.create(createTestReview({ doi: `10.1234/test.3.${Date.now()}` }));

            const found = await storage.findByIds([review1.id, review2.id, '00000000-0000-0000-0000-000000000000', review3.id]);

            expect(found).toHaveLength(4);
            expect(found[0]?.id).toBe(review1.id);
            expect(found[1]?.id).toBe(review2.id);
            expect(found[2]).toBeNull();
            expect(found[3]?.id).toBe(review3.id);
        }, 10000);

        it('should update a review', async () => {
            const created = await storage.create(createTestReview());
            const updated = await storage.update(created.id, {
                title: 'Updated Title',
                conclusions: 'Updated conclusions',
            });

            expect(updated).toBeDefined();
            expect(updated?.title).toBe('Updated Title');
            expect(updated?.conclusions).toBe('Updated conclusions');
            expect(updated?.doi).toBe(created.doi); // Other fields unchanged
        });

        it('should return null when updating non-existent review', async () => {
            const updated = await storage.update('00000000-0000-0000-0000-000000000000', { title: 'New Title' });
            expect(updated).toBeNull();
        });

        it('should delete a review', async () => {
            const created = await storage.create(createTestReview());
            const deleted = await storage.delete(created.id);

            expect(deleted).toBe(true);

            const found = await storage.findById(created.id);
            expect(found).toBeNull();
        });

        it('should return false when deleting non-existent review', async () => {
            const deleted = await storage.delete('00000000-0000-0000-0000-000000000000');
            expect(deleted).toBe(false);
        });

        it('should soft delete a review', async () => {
            const created = await storage.create(createTestReview());
            const softDeleted = await storage.delete(created.id, { soft: true });

            expect(softDeleted).toBe(true);

            const found = await storage.findById(created.id);
            expect(found).toBeDefined();
            expect(found?.publicationStatus).toBe('WITHDRAWN');
        });
    });

    describe('Upsert Operations', () => {
        it('should create a new review on upsert when no match found', async () => {
            const reviewData = createTestReview();
            const result = await storage.upsert(reviewData, { matchByDatabaseIds: true });

            expect(result.created).toBe(true);
            expect(result.id).toBeDefined();
            expect(result.review.title).toBe(reviewData.title);
        });

        it('should update existing review on upsert when match found by DOI', async () => {
            const reviewData = createTestReview();
            const created = await storage.create(reviewData);

            const updatedData = { ...reviewData, title: 'Updated Title', conclusions: 'New conclusions' };
            const result = await storage.upsert(updatedData, { matchByDatabaseIds: false });

            expect(result.created).toBe(false);
            expect(result.id).toBe(created.id);
            expect(result.review.title).toBe('Updated Title');
        });

        it('should match by database IDs when matchByDatabaseIds is true', async () => {
            const reviewData = createTestReview();
            const created = await storage.create(reviewData);

            const updatedData = {
                ...reviewData,
                doi: '10.1234/different.doi',
                title: 'Updated by DB ID',
            };
            const result = await storage.upsert(updatedData, { matchByDatabaseIds: true });

            expect(result.created).toBe(false);
            expect(result.id).toBe(created.id);
            expect(result.review.title).toBe('Updated by DB ID');
        });

        it('should force update when forceUpdate option is true', async () => {
            const reviewData = createTestReview();
            const created = await storage.create(reviewData);

            const result = await storage.upsert(reviewData, { forceUpdate: true });

            expect(result.created).toBe(false);
            expect(result.id).toBe(created.id);
        });

        it('should handle bulk upsert operations', async () => {
            const reviews = [
                createTestReview({ doi: '10.1234/bulk.1', pmid: 'bulk-pmid-1', title: 'Bulk Review 1' }),
                createTestReview({ doi: '10.1234/bulk.2', pmid: 'bulk-pmid-2', title: 'Bulk Review 2' }),
                createTestReview({ doi: '10.1234/bulk.3', pmid: 'bulk-pmid-3', title: 'Bulk Review 3' }),
            ];

            const result = await storage.bulkUpsert(reviews, { batchSize: 2 });

            expect(result.successCount).toBe(3);
            expect(result.failureCount).toBe(0);
            expect(result.successIds).toHaveLength(3);
        }, 30000);
    });

    describe('Query Operations', () => {
        let queryReview1: ReviewIndex;
        let queryReview2: ReviewIndex;
        let queryReview3: ReviewIndex;

        beforeEach(async () => {
            // Create test data for queries with unique IDs
            queryReview1 = await storage.create(createTestReview({
                doi: `10.1234/query.1.${Date.now()}`,
                title: 'Cardiovascular Systematic Review',
                reviewType: 'SYSTEMATIC_REVIEW' as ReviewType,
                publicationStatus: 'PUBLISHED' as PublicationStatus,
                evidenceQuality: 'HIGH' as EvidenceQuality,
            }));
            queryReview2 = await storage.create(createTestReview({
                doi: `10.1234/query.2.${Date.now()}`,
                title: 'Diabetes Meta-Analysis',
                reviewType: 'META_ANALYSIS' as ReviewType,
                publicationStatus: 'PREPRINT' as PublicationStatus,
                evidenceQuality: 'MODERATE' as EvidenceQuality,
            }));
            queryReview3 = await storage.create(createTestReview({
                doi: `10.1234/query.3.${Date.now()}`,
                title: 'Cancer Treatment Overview',
                reviewType: 'OVERVIEW_OF_REVIEWS' as ReviewType,
                publicationStatus: 'PUBLISHED' as PublicationStatus,
                evidenceQuality: 'LOW' as EvidenceQuality,
            }));
        });

        it('should search reviews with filters', async () => {
            const result = await storage.search(
                { reviewType: ['SYSTEMATIC_REVIEW' as ReviewType] },
                { field: 'TITLE' as SortField, direction: 'ASC' as SortDirection },
                { page: 1, pageSize: 10 }
            );

            expect(result.reviews).toHaveLength(1);
            expect(result.reviews[0].id).toBe(queryReview1.id);
            expect(result.total).toBe(1);
        });

        it('should perform full text search', async () => {
            const result = await storage.fullTextSearch('Cardiovascular', {
                filters: { publicationStatus: ['PUBLISHED' as PublicationStatus] },
            });

            expect(result.reviews.length).toBeGreaterThan(0);
            expect(result.reviews.some(r => r.id === queryReview1.id)).toBe(true);
        });

        it('should find by database ID', async () => {
            const reviews = await storage.findByDatabaseId(queryReview1.databaseIds[0]);

            expect(reviews.length).toBeGreaterThan(0);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        });

        it('should find by DOI', async () => {
            if (!queryReview1.doi) {
                throw new Error('Test review must have a DOI');
            }
            const reviews = await storage.findByDoi(queryReview1.doi);
            expect(reviews).toHaveLength(1);
            expect(reviews[0].id).toBe(queryReview1.id);
        }, 10000);

        it('should find by PMID', async () => {
            if (!queryReview1.pmid) {
                throw new Error('Test review must have a PMID');
            }
            const reviews = await storage.findByPmid(queryReview1.pmid);
            expect(reviews.length).toBeGreaterThan(0);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        });

        it('should find by Cochrane ID', async () => {
            if (!queryReview1.cochraneId) {
                throw new Error('Test review must have a Cochrane ID');
            }
            const reviews = await storage.findByCochraneId(queryReview1.cochraneId);
            expect(reviews.length).toBeGreaterThan(0);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        });

        it('should find by database source', async () => {
            const reviews = await storage.findByDatabaseSource('PUBMED' as DatabaseSource);
            expect(reviews.length).toBeGreaterThanOrEqual(3);
        });

        it('should find by review type', async () => {
            const reviews = await storage.findByReviewType('META_ANALYSIS' as ReviewType);
            expect(reviews).toHaveLength(1);
            expect(reviews[0].id).toBe(queryReview2.id);
        }, 10000);

        it('should find by publication status', async () => {
            const reviews = await storage.findByPublicationStatus('PREPRINT' as PublicationStatus);
            expect(reviews).toHaveLength(1);
            expect(reviews[0].id).toBe(queryReview2.id);
        }, 10000);

        it('should find by evidence quality', async () => {
            const reviews = await storage.findByEvidenceQuality('HIGH' as EvidenceQuality);
            expect(reviews.length).toBeGreaterThanOrEqual(1);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        }, 10000);

        it('should find by author name', async () => {
            const reviews = await storage.findByAuthor(queryReview1.authors[0].name);
            expect(reviews.length).toBeGreaterThanOrEqual(1);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        }, 10000);

        it('should find by journal name', async () => {
            const reviews = await storage.findByJournal(queryReview1.journal!.name);
            expect(reviews.length).toBeGreaterThanOrEqual(1);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        }, 10000);

        it('should find by MeSH term', async () => {
            if (!queryReview1.meshTerms || queryReview1.meshTerms.length === 0) {
                throw new Error('Test review must have meshTerms');
            }
            const meshTerm = queryReview1.meshTerms[0];
            const reviews = await storage.findByMeshTerm(meshTerm);
            expect(reviews.length).toBeGreaterThanOrEqual(1);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        }, 10000);

        it('should find by keyword', async () => {
            if (!queryReview1.keywords || queryReview1.keywords.length === 0) {
                throw new Error('Test review must have keywords');
            }
            const keyword = queryReview1.keywords[0];
            const reviews = await storage.findByKeyword(keyword);
            expect(reviews.length).toBeGreaterThanOrEqual(1);
            expect(reviews.some(r => r.id === queryReview1.id)).toBe(true);
        }, 10000);

        it('should find all with pagination', async () => {
            const result = await storage.findAll({ page: 1, pageSize: 2 });

            expect(result.reviews).toHaveLength(2);
            expect(result.total).toBeGreaterThanOrEqual(3);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(2);
        }, 10000);

        it('should count reviews with filters', async () => {
            const count = await storage.count({ reviewType: ['SYSTEMATIC_REVIEW' as ReviewType] });
            expect(count).toBeGreaterThanOrEqual(1);
        }, 10000);

        it('should check if review exists', async () => {
            const review = await storage.create(createTestReview({ doi: '10.1234/exists.1', pmid: 'exists-pmid-1' }));
            const exists = await storage.exists(review.id);
            expect(exists).toBe(true);

            const notExists = await storage.exists('00000000-0000-0000-0000-000000000000');
            expect(notExists).toBe(false);
        });
    });

    describe('Duplicate Detection', () => {
        it('should detect potential duplicates', async () => {
            await storage.create(createTestReview({
                doi: '10.1234/duplicate.1',
                pmid: 'dup-pmid-1',
                title: 'Systematic Review of Hypertension Treatment',
            }));

            const result = await storage.detectDuplicates(
                createTestReview({
                    pmid: 'dup-pmid-2',
                    title: 'Systematic Review of Hypertension Treatment',
                }),
                { threshold: 0.5, maxResults: 5 }
            );

            expect(result.hasDuplicates).toBe(true);
            expect(result.potentialDuplicates.length).toBeGreaterThan(0);
        });

        it('should mark reviews as duplicates', async () => {
            const review1 = await storage.create(createTestReview({
                doi: '10.1234/dup.1',
                pmid: 'dup-mark-1',
                title: 'Duplicate Review 1',
            }));
            const review2 = await storage.create(createTestReview({
                doi: '10.1234/dup.2',
                pmid: 'dup-mark-2',
                title: 'Duplicate Review 2',
            }));

            const marked = await storage.markAsDuplicates(review1.id, review2.id);
            expect(marked).toBe(true);

            // Check related reviews were created
            const updated1 = await storage.findById(review1.id);
            expect(updated1?.relatedReviews).toBeDefined();
        });

        it('should unmark reviews as duplicates', async () => {
            const review1 = await storage.create(createTestReview({
                doi: '10.1234/unmark.1',
                pmid: 'unmark-1',
            }));
            const review2 = await storage.create(createTestReview({
                doi: '10.1234/unmark.2',
                pmid: 'unmark-2',
            }));

            await storage.markAsDuplicates(review1.id, review2.id);
            const unmarked = await storage.unmarkAsDuplicates(review1.id, review2.id);

            expect(unmarked).toBe(true);
        });
    });

    describe('Statistics and Analytics', () => {
        beforeEach(async () => {
            await storage.create(createTestReview({
                doi: `10.1234/stats.1.${Date.now()}`,
                reviewType: 'SYSTEMATIC_REVIEW' as ReviewType,
                publicationStatus: 'PUBLISHED' as PublicationStatus,
                evidenceQuality: 'HIGH' as EvidenceQuality,
                publicationDate: new Date('2023-01-01'),
            }));
            await storage.create(createTestReview({
                doi: `10.1234/stats.2.${Date.now()}`,
                reviewType: 'META_ANALYSIS' as ReviewType,
                publicationStatus: 'PUBLISHED' as PublicationStatus,
                evidenceQuality: 'MODERATE' as EvidenceQuality,
                publicationDate: new Date('2023-06-01'),
            }));
        });

        it('should get overall statistics', async () => {
            const stats = await storage.getStats();

            expect(stats.totalReviews).toBeGreaterThan(0);
            expect(stats.reviewsByType).toBeDefined();
            expect(stats.reviewsByStatus).toBeDefined();
            expect(stats.reviewsByEvidenceQuality).toBeDefined();
            expect(stats.dateRange).toBeDefined();
        });

        it('should get aggregated stats by field', async () => {
            const stats = await storage.getAggregatedStats('reviewType');
            expect(stats).toBeDefined();
            expect(Object.keys(stats).length).toBeGreaterThan(0);
        });

        it('should get time series data', async () => {
            const data = await storage.getTimeSeriesData({
                start: new Date('2023-01-01'),
                end: new Date('2023-12-31'),
                interval: 'month',
                field: 'createdAt',
            });

            expect(Array.isArray(data)).toBe(true);
        });
    });

    describe('Health and Maintenance', () => {
        it('should get health status', async () => {
            const health = await storage.getHealthStatus();

            expect(health).toBeDefined();
            expect(health.connected).toBeDefined();
            expect(typeof health.latency).toBe('number');
        });

        it('should validate data integrity', async () => {
            const validation = await storage.validateDataIntegrity();

            expect(validation).toBeDefined();
            expect(typeof validation.valid).toBe('boolean');
            expect(typeof validation.recordsChecked).toBe('number');
            expect(Array.isArray(validation.issues)).toBe(true);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle review with minimal required fields', async () => {
            const minimalReview = createTestReview({
                journal: undefined,
                eligibilityCriteria: undefined,
                pico: undefined,
                qualityAssessment: undefined,
                relatedReviews: undefined,
                urls: undefined,
            });

            const created = await storage.create(minimalReview);
            expect(created).toBeDefined();
            expect(created.id).toBeDefined();
        });

        it('should handle empty arrays correctly', async () => {
            const reviewWithEmptyArrays = createTestReview({
                authors: [],
                databaseIds: [],
                keywords: [],
                meshTerms: [],
                funding: [],
                urls: [],
                relatedReviews: [],
            });

            const created = await storage.create(reviewWithEmptyArrays);
            expect(created.authors).toHaveLength(0);
            expect(created.databaseIds).toHaveLength(0);
        });

        it('should handle special characters in text fields', async () => {
            const reviewWithSpecialChars = createTestReview({
                title: 'Review with "quotes" and \'apostrophes\' and <html> tags',
                abstract: 'Text with emojis 🎉 and unicode characters 中文',
            });

            const created = await storage.create(reviewWithSpecialChars);
            expect(created.title).toContain('quotes');
        });

        it('should handle very long titles and abstracts', async () => {
            const longText = 'A'.repeat(1000);
            const reviewWithLongText = createTestReview({
                title: longText,
                abstract: 'B'.repeat(5000),
            });

            const created = await storage.create(reviewWithLongText);
            expect(created.title).toHaveLength(1000);
        });

        it('should handle concurrent creates', async () => {
            const promises = Array.from({ length: 10 }, (_, i) =>
                storage.create(createTestReview({
                    doi: `10.1234/concurrent.${i}`,
                    pmid: `concurrent-pmid-${i}`,
                    cochraneId: `concurrent-cochrane-${i}`,
                }))
            );

            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            expect(new Set(results.map(r => r.id)).size).toBe(10); // All unique IDs
        }, 30000);
    });
});
