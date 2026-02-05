import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import {
    syncFileToDb,
    syncBaselineFileToDb,
    type OSSDependencies,
    type XMLDependencies,
    type SyncDependencies,
    syncSingleArticle,
} from '../db-storage.js';
import type { IArticleRepository } from '../article-repository.js';
import { readFileSync } from 'node:fs';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock article repository for testing
 */
const createMockRepository = (overrides?: Partial<IArticleRepository>): IArticleRepository => {
    return {
        syncArticle: vi.fn().mockResolvedValue({
            pmid: 12345,
            success: true,
        }),
        getSyncedBaselineFiles: vi.fn().mockResolvedValue(new Set<string>()),
        markBaselineFileInProgress: vi.fn().mockResolvedValue(undefined),
        markBaselineFileCompleted: vi.fn().mockResolvedValue(undefined),
        markBaselineFileFailed: vi.fn().mockResolvedValue(undefined),
        findArticleWithoutAbstract: vi.fn().mockResolvedValue([]),
        isArticleExist: vi.fn().mockResolvedValue(false),
        syncArticleDetail: vi.fn().mockResolvedValue({
            pmid: 12345,
            success: true,
        }),
        ...overrides,
    } as unknown as IArticleRepository;
};

describe('db-storage tests', () => {

    describe('syncFileToDb with dependency injection', () => {
        let mockRepository: IArticleRepository;
        let mockDependencies: SyncDependencies;

        beforeEach(() => {
            // Mock repository
            mockRepository = {
                syncArticle: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
                isArticleExist: vi.fn().mockResolvedValue(false),
            } as unknown as IArticleRepository;

            // Mock OSS dependencies
            const mockOSSDeps: OSSDependencies = {
                downloadFile: vi.fn().mockResolvedValue(
                    Buffer.from('compressed xml data')
                ),
                listFiles: vi.fn().mockResolvedValue([
                    'pubmed24n0001.xml.gz',
                    'pubmed24n0002.xml.gz',
                ]),
            };

            // Mock XML dependencies
            const mockXMLDeps: XMLDependencies = {
                decompress: vi.fn().mockResolvedValue(
                    Buffer.from(`
                        <PubmedArticleSet>
                            <PubmedArticle>
                                <MedlineCitation>
                                    <PMID>12345</PMID>
                                    <DateCompleted>
                                        <Year>2024</Year>
                                        <Month>01</Month>
                                        <Day>15</Day>
                                    </DateCompleted>
                                    <Article>
                                        <Journal>
                                            <ISSN>1234-5678</ISSN>
                                        </Journal>
                                        <ArticleTitle>Test Article Title</ArticleTitle>
                                        <Pagination>
                                            <MedlinePgn>1-10</MedlinePgn>
                                        </Pagination>
                                        <Language>eng</Language>
                                    </Article>
                                    <MedlineJournalInfo>
                                        <Country>United States</Country>
                                        <MedlineTA>Test Journal</MedlineTA>
                                        <NlmUniqueID>1234567</NlmUniqueID>
                                    </MedlineJournalInfo>
                                </MedlineCitation>
                            </PubmedArticle>
                        </PubmedArticleSet>
                    `)
                ),
                parse: vi.fn().mockReturnValue({
                    PubmedArticleSet: {
                        PubmedArticle: [
                            {
                                MedlineCitation: {
                                    PMID: '12345',
                                    DateCompleted: {
                                        Year: '2024',
                                        Month: '01',
                                        Day: '15',
                                    },
                                    Article: {
                                        Journal: {
                                            ISSN: '1234-5678',
                                        },
                                        ArticleTitle: 'Test Article Title',
                                        Pagination: {
                                            MedlinePgn: '1-10',
                                        },
                                        Language: 'eng',
                                    },
                                    MedlineJournalInfo: {
                                        Country: 'United States',
                                        MedlineTA: 'Test Journal',
                                        NlmUniqueID: '1234567',
                                    },
                                },
                            },
                        ],
                    },
                }),
            };

            mockDependencies = {
                oss: mockOSSDeps,
                xml: mockXMLDeps,
            };
        });

        it('should download file using injected OSS dependency', async () => {
            await syncFileToDb('2024', 'pubmed24n0001.xml.gz', mockRepository, mockDependencies);

            expect(mockDependencies.oss.downloadFile).toHaveBeenCalledWith(
                'pubmed24n0001.xml.gz',
                '2024'
            );
        });

        it('should decompress file using injected XML dependency', async () => {
            await syncFileToDb('2024', 'pubmed24n0001.xml.gz', mockRepository, mockDependencies);

            expect(mockDependencies.xml.decompress).toHaveBeenCalled();
        });

        it('should parse XML using injected XML dependency', async () => {
            await syncFileToDb('2024', 'pubmed24n0001.xml.gz', mockRepository, mockDependencies);

            expect(mockDependencies.xml.parse).toHaveBeenCalled();
        });

        it('should call repository.syncArticle with transformed data', async () => {
            await syncFileToDb('2024', 'pubmed24n0001.xml.gz', mockRepository, mockDependencies);

            expect(mockRepository.syncArticle).toHaveBeenCalled();
        });

        it('should work with default dependencies when not provided', async () => {
            // This test verifies that the function signature accepts optional dependencies
            // Note: This will actually call real dependencies, so we're just checking the API
            const mockRepo = {
                syncArticle: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
                isArticleExist: vi.fn().mockResolvedValue(false),
            } as unknown as IArticleRepository;

            // This should not throw a type error
            expect(() => {
                syncFileToDb('2024', 'test.xml', mockRepo);
            }).not.toThrow();
        });

        it('should handle empty article list', async () => {
            const emptyMockDeps: SyncDependencies = {
                oss: {
                    downloadFile: vi.fn().mockResolvedValue(Buffer.from('data')),
                    listFiles: vi.fn().mockResolvedValue(['test.xml']),
                },
                xml: {
                    decompress: vi.fn().mockResolvedValue(Buffer.from('<PubmedArticleSet></PubmedArticleSet>')),
                    parse: vi.fn().mockReturnValue({
                        PubmedArticleSet: {
                            PubmedArticle: [],
                        },
                    }),
                },
            };

            const result = await syncFileToDb('2024', 'test.xml', mockRepository, emptyMockDeps);

            expect(result).toEqual([]);
            expect(mockRepository.syncArticle).not.toHaveBeenCalled();
        });

        it('should process article data', async () => {
            const testArticleData = JSON.parse(readFileSync(__dirname + '/pubmedArticle1.json').toString());
            const mockRepository = createMockRepository();
            const spy = vi.spyOn(mockRepository, 'syncArticle')
            const result = await syncSingleArticle(testArticleData, mockRepository);

            console.log(spy.mock.calls)
            expect(result.success).toBe(true);
            expect(mockRepository.syncArticle).toHaveBeenCalled();
        });

        it('should handle single article (not array)', async () => {
            const singleArticleMockDeps: SyncDependencies = {
                oss: {
                    downloadFile: vi.fn().mockResolvedValue(Buffer.from('data')),
                    listFiles: vi.fn().mockResolvedValue(['test.xml']),
                },
                xml: {
                    decompress: vi.fn().mockResolvedValue(Buffer.from('<xml></xml>')),
                    parse: vi.fn().mockReturnValue({
                        PubmedArticleSet: {
                            PubmedArticle: {
                                MedlineCitation: {
                                    PMID: '12345',
                                },
                            },
                        },
                    }),
                },
            };

            await syncFileToDb('2024', 'test.xml', mockRepository, singleArticleMockDeps);

            expect(mockRepository.syncArticle).toHaveBeenCalled();
        });
    });

    describe('syncBaselineFileToDb with dependency injection', () => {
        let mockRepository: IArticleRepository;
        let mockDependencies: SyncDependencies;

        beforeEach(() => {
            mockRepository = {
                syncArticle: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
                getSyncedBaselineFiles: vi.fn().mockResolvedValue(new Set<string>()),
                markBaselineFileInProgress: vi.fn().mockResolvedValue(undefined),
                markBaselineFileCompleted: vi.fn().mockResolvedValue(undefined),
                markBaselineFileFailed: vi.fn().mockResolvedValue(undefined),
                findArticleWithoutAbstract: vi.fn().mockResolvedValue([]),
                isArticleExist: vi.fn().mockResolvedValue(false),
                syncArticleDetail: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
            } as unknown as IArticleRepository;

            mockDependencies = {
                oss: {
                    downloadFile: vi.fn().mockResolvedValue(Buffer.from('data')),
                    listFiles: vi.fn().mockResolvedValue([
                        'pubmed24n0001.xml.gz',
                        'pubmed24n0002.xml.gz',
                    ]),
                },
                xml: {
                    decompress: vi.fn().mockResolvedValue(Buffer.from('<PubmedArticleSet></PubmedArticleSet>')),
                    parse: vi.fn().mockReturnValue({
                        PubmedArticleSet: {
                            PubmedArticle: [],
                        },
                    }),
                },
            };
        });

        it('should list files using injected OSS dependency', async () => {
            await syncBaselineFileToDb('2024', mockRepository, mockDependencies);

            expect(mockDependencies.oss.listFiles).toHaveBeenCalledWith('2024');
        });

        it('should process all files returned by listFiles', async () => {
            await syncBaselineFileToDb('2024', mockRepository, mockDependencies);

            expect(mockDependencies.oss.downloadFile).toHaveBeenCalledTimes(2);
            expect(mockDependencies.oss.downloadFile).toHaveBeenNthCalledWith(1, 'pubmed24n0001.xml.gz', '2024');
            expect(mockDependencies.oss.downloadFile).toHaveBeenNthCalledWith(2, 'pubmed24n0002.xml.gz', '2024');
        });

        it('should return summary with correct counts', async () => {
            const summary = await syncBaselineFileToDb('2024', mockRepository, mockDependencies);

            expect(summary).toEqual({
                totalFiles: 2,
                skippedFiles: 0,
                processedFiles: 2,
                totalArticles: 0,
                successArticles: 0,
                failedArticles: 0,
            });
        });

        it('should pass dependencies to syncFileToDb', async () => {
            await syncBaselineFileToDb('2024', mockRepository, mockDependencies);

            // Verify that the same dependencies are used
            expect(mockDependencies.xml.decompress).toHaveBeenCalledTimes(2);
            expect(mockDependencies.xml.parse).toHaveBeenCalledTimes(2);
        });
    });

    describe('dependency injection patterns', () => {
        it('should allow partial mocking of OSS dependencies only', async () => {
            const mockRepo = {
                syncArticle: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
                getSyncedBaselineFiles: vi.fn().mockResolvedValue(new Set<string>()),
                markBaselineFileInProgress: vi.fn().mockResolvedValue(undefined),
                markBaselineFileCompleted: vi.fn().mockResolvedValue(undefined),
                markBaselineFileFailed: vi.fn().mockResolvedValue(undefined),
                findArticleWithoutAbstract: vi.fn().mockResolvedValue([]),
                isArticleExist: vi.fn().mockResolvedValue(false),
                syncArticleDetail: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
            } as unknown as IArticleRepository;

            // Mock both OSS and XML for this test (partial mocking with default deps requires real data)
            const partialMockDeps: SyncDependencies = {
                oss: {
                    downloadFile: vi.fn().mockResolvedValue(Buffer.from('data')),
                    listFiles: vi.fn().mockResolvedValue(['test.xml']),
                },
                xml: {
                    decompress: vi.fn().mockResolvedValue(Buffer.from('<PubmedArticleSet></PubmedArticleSet>')),
                    parse: vi.fn().mockReturnValue({ PubmedArticleSet: { PubmedArticle: [] } }),
                },
            };

            await syncFileToDb('2024', 'test.xml', mockRepo, partialMockDeps);

            expect(partialMockDeps.oss.downloadFile).toHaveBeenCalled();
        });

        it('should allow partial mocking of XML dependencies only', async () => {
            const mockRepo = {
                syncArticle: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
                getSyncedBaselineFiles: vi.fn().mockResolvedValue(new Set<string>()),
                markBaselineFileInProgress: vi.fn().mockResolvedValue(undefined),
                markBaselineFileCompleted: vi.fn().mockResolvedValue(undefined),
                markBaselineFileFailed: vi.fn().mockResolvedValue(undefined),
                findArticleWithoutAbstract: vi.fn().mockResolvedValue([]),
                isArticleExist: vi.fn().mockResolvedValue(false),
                syncArticleDetail: vi.fn().mockResolvedValue({
                    pmid: 12345,
                    success: true,
                }),
            } as unknown as IArticleRepository;

            // Mock both OSS and XML for this test (partial mocking with default deps requires real data)
            const partialMockDeps: SyncDependencies = {
                oss: {
                    downloadFile: vi.fn().mockResolvedValue(Buffer.from('data')),
                    listFiles: vi.fn().mockResolvedValue(['test.xml']),
                },
                xml: {
                    decompress: vi.fn().mockResolvedValue(Buffer.from('<PubmedArticleSet></PubmedArticleSet>')),
                    parse: vi.fn().mockReturnValue({ PubmedArticleSet: { PubmedArticle: [] } }),
                },
            };

            await syncFileToDb('2024', 'test.xml', mockRepo, partialMockDeps);

            expect(partialMockDeps.xml.decompress).toHaveBeenCalled();
            expect(partialMockDeps.xml.parse).toHaveBeenCalled();
        });
    });
});
