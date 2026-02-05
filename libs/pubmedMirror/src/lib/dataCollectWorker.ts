import { PubmedService, ArticleDetail, Author, Affiliation, Keyword, SimilarArticle, Reference, FullTextSource } from 'med_database_portal';
import { IArticleRepository, ArticleDetailSyncData, ArticleDetailCreateData, ArticleDetailAuthorCreateData, ArticleDetailAffiliationCreateData, ArticleDetailKeywordCreateData, ArticleDetailSimilarArticleCreateData, ArticleDetailReferenceCreateData, ArticleDetailPublicationTypeCreateData, ArticleDetailMeshTermCreateData, ArticleDetailRelatedInformationCreateData, ArticleDetailFullTextSourceCreateData, ArticleDetailJournalInfoCreateData } from './article-repository.js';
import { EventEmitter } from 'events';
import Bottleneck from 'bottleneck';

type DataCollectTaskEvent = 'fetch_abstract';

interface DataCollectTask {
    event: DataCollectTaskEvent;
    pmid?: number;
}

interface DataCollectWorkerOptions {
    batchSize?: number;
    concurrency?: number; // Number of concurrent requests
    minTime?: number; // Minimum time between requests in milliseconds
    maxRetries?: number;
}

interface CollectProgress {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    currentPmid?: number;
}

/**
 * Worker for collecting detailed article data from PubMed
 */
export class BibliographicDataCollectWorker extends EventEmitter {
    private pubmedService: PubmedService;
    private repository: IArticleRepository;
    private options: Required<DataCollectWorkerOptions>;
    private isRunning: boolean = false;
    private shouldStop: boolean = false;
    private limiter: Bottleneck;

    constructor(
        pubmedService: PubmedService,
        repository: IArticleRepository,
        options: DataCollectWorkerOptions = {}
    ) {
        super();
        this.pubmedService = pubmedService;
        this.repository = repository;
        this.options = {
            batchSize: options.batchSize ?? 100,
            concurrency: options.concurrency ?? 5,
            minTime: options.minTime ?? 20,
            maxRetries: options.maxRetries ?? 3,
        };

        // Create Bottleneck limiter for concurrency control
        this.limiter = new Bottleneck({
            maxConcurrent: this.options.concurrency,
            minTime: this.options.minTime,
            reservoir: 20, // Number of requests that can be executed immediately
            reservoirRefreshAmount: 20,
            reservoirRefreshInterval: 60 * 1000, // Refresh every minute
        });
    }

    /**
     * Start collecting article details for articles without abstract
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('Worker is already running');
        }

        this.isRunning = true;
        this.shouldStop = false;
        this.emit('started');

        let lastPmid = 0;
        let progress: CollectProgress = {
            totalProcessed: 0,
            successCount: 0,
            failureCount: 0,
        };

        try {
            while (!this.shouldStop) {
                // Find articles without abstract
                const pmids = await this.repository.findArticleWithoutAbstract(lastPmid, this.options.batchSize);

                if (pmids.length === 0) {
                    this.emit('completed', progress);
                    break;
                }

                // Process PMIDs concurrently using Bottleneck
                const promises = pmids.map(pmid =>
                    this.limiter.schedule(async () => {
                        if (this.shouldStop) {
                            return null;
                        }

                        progress.currentPmid = pmid;
                        this.emit('progress', progress);

                        const result = await this.fetchAndStoreArticleDetail(pmid);

                        progress.totalProcessed++;
                        if (result.success) {
                            progress.successCount++;
                            this.emit('success', { pmid, result });
                        } else {
                            progress.failureCount++;
                            this.emit('error', { pmid, error: result.error });
                        }

                        return { pmid, result };
                    })
                );

                // Wait for all requests in this batch to complete
                await Promise.all(promises);

                // Update lastPmid to the highest PMID in this batch
                if (pmids.length > 0) {
                    lastPmid = Math.max(...pmids);
                }

                this.emit('batchComplete', progress);
            }
        } catch (error) {
            this.emit('workerError', error);
        } finally {
            this.isRunning = false;
            this.emit('stopped', progress);
        }
    }

    /**
     * Stop the worker
     */
    stop(): void {
        this.shouldStop = true;
        this.emit('stopRequested');
    }

    /**
     * Fetch and store article detail for a single PMID
     */
    private async fetchAndStoreArticleDetail(pmid: number): Promise<{ pmid: number; success: boolean; error?: string }> {
        let retries = 0;

        while (retries < this.options.maxRetries) {
            try {
                const articleDetail = await this.pubmedService.getArticleDetail(String(pmid));
                const syncData = this.transformToSyncData(articleDetail);
                return await this.repository.syncArticleDetail(syncData);
            } catch (error) {
                retries++;
                const errorMessage = error instanceof Error ? error.message : String(error);

                if (retries >= this.options.maxRetries) {
                    return {
                        pmid,
                        success: false,
                        error: `Failed after ${retries} retries: ${errorMessage}`,
                    };
                }

                // Exponential backoff
                await this.delay(Math.pow(2, retries) * 1000);
            }
        }

        return {
            pmid,
            success: false,
            error: 'Max retries exceeded',
        };
    }

    /**
     * Transform ArticleDetail from PubmedService to ArticleDetailSyncData
     */
    private transformToSyncData(articleDetail: ArticleDetail): ArticleDetailSyncData {
        return {
            detail: this.transformDetail(articleDetail),
            authors: articleDetail.authors.map(this.transformAuthor),
            affiliations: articleDetail.affiliations.map(this.transformAffiliation),
            keywords: articleDetail.keywords.map(this.transformKeyword),
            similarArticles: articleDetail.similarArticles.map(this.transformSimilarArticle),
            references: articleDetail.references.map(this.transformReference),
            publicationTypes: articleDetail.publicationTypes.map(type => ({ type })),
            meshTerms: articleDetail.meshTerms.map(this.transformMeshTerm),
            relatedInformation: this.transformRelatedInformation(articleDetail.relatedInformation),
            fullTextSources: articleDetail.fullTextSources.map(this.transformFullTextSource),
            journalInfo: this.transformJournalInfo(articleDetail.journalInfo),
        };
    }

    private transformDetail(articleDetail: ArticleDetail): ArticleDetailCreateData {
        return {
            pmid: parseInt(articleDetail.pmid, 10),
            doi: articleDetail.doi || undefined,
            title: articleDetail.title,
            abstract: articleDetail.abstract || undefined,
            conflictOfInterestStatement: articleDetail.conflictOfInterestStatement || undefined,
        };
    }

    private transformAuthor(author: Author): ArticleDetailAuthorCreateData {
        return {
            name: author.name,
            position: author.position,
            affiliations: author.affiliations.map(aff => this.transformAffiliation(aff)),
        };
    }

    private transformAffiliation(affiliation: Affiliation): ArticleDetailAffiliationCreateData {
        return {
            institution: affiliation.institution,
            city: affiliation.city,
            country: affiliation.country,
            email: affiliation.email,
        };
    }

    private transformKeyword(keyword: Keyword): ArticleDetailKeywordCreateData {
        return {
            text: keyword.text,
            isMeSH: keyword.isMeSH,
        };
    }

    private transformSimilarArticle(article: SimilarArticle): ArticleDetailSimilarArticleCreateData {
        return {
            pmid: article.pmid,
            title: article.title,
        };
    }

    private transformReference(reference: Reference): ArticleDetailReferenceCreateData {
        return {
            pmid: reference.pmid,
            citation: reference.citation,
        };
    }

    private transformMeshTerm(meshTerm: Keyword): ArticleDetailMeshTermCreateData {
        return {
            text: meshTerm.text,
            isMeSH: meshTerm.isMeSH ?? true,
        };
    }

    private transformRelatedInformation(relatedInfo: Record<string, string[]>): ArticleDetailRelatedInformationCreateData[] {
        const result: ArticleDetailRelatedInformationCreateData[] = [];

        for (const [category, items] of Object.entries(relatedInfo)) {
            for (const item of items) {
                // Parse "text: url" format
                const match = item.match(/^(.+?):\s*(.+)$/);
                if (match) {
                    result.push({
                        category,
                        text: match[1].trim(),
                        url: match[2].trim(),
                    });
                } else {
                    result.push({
                        category,
                        text: item,
                    });
                }
            }
        }

        return result;
    }

    private transformFullTextSource(source: FullTextSource): ArticleDetailFullTextSourceCreateData {
        return {
            name: source.name,
            url: source.url,
            type: source.type,
        };
    }

    private transformJournalInfo(journalInfo: ArticleDetail['journalInfo']): ArticleDetailJournalInfoCreateData | null {
        if (!journalInfo) return null;

        return {
            title: journalInfo.title,
            volume: journalInfo.volume,
            issue: journalInfo.issue,
            pages: journalInfo.pages,
            pubDate: journalInfo.pubDate,
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Create and start a data collect worker
 */
export async function startDataCollectWorker(
    pubmedService: PubmedService,
    repository: IArticleRepository,
    options?: DataCollectWorkerOptions
): Promise<BibliographicDataCollectWorker> {
    const worker = new BibliographicDataCollectWorker(pubmedService, repository, options);

    // Set up event handlers for logging
    worker.on('started', () => console.log('Data collect worker started'));
    worker.on('progress', (progress: CollectProgress) => {
        console.log(`Progress: ${progress.totalProcessed} processed, ${progress.successCount} success, ${progress.failureCount} failed`);
        if (progress.currentPmid) {
            console.log(`Current PMID: ${progress.currentPmid}`);
        }
    });
    worker.on('success', ({ pmid }) => console.log(`Successfully fetched and stored PMID ${pmid}`));
    worker.on('error', ({ pmid, error }) => console.error(`Failed to fetch PMID ${pmid}: ${error}`));
    worker.on('batchComplete', (progress: CollectProgress) => {
        console.log(`Batch complete: ${progress.totalProcessed} total, ${progress.successCount} success, ${progress.failureCount} failed`);
    });
    worker.on('completed', (progress: CollectProgress) => {
        console.log(`Data collection completed: ${progress.totalProcessed} total, ${progress.successCount} success, ${progress.failureCount} failed`);
    });
    worker.on('workerError', (error) => console.error('Worker error:', error));
    worker.on('stopped', (progress: CollectProgress) => {
        console.log(`Worker stopped: ${progress.totalProcessed} total, ${progress.successCount} success, ${progress.failureCount} failed`);
    });
    worker.on('stopRequested', () => console.log('Stop requested, finishing current batch...'));

    // Start the worker
    await worker.start();

    return worker;
}
