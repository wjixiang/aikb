/**
 * Meta-Analysis Agent Service
 *
 * Automated literature retrieval and analysis for systematic reviews and meta-analyses.
 * Integrates BAML LLM functions with PubMed service for end-to-end workflow.
 */

import { b } from '../baml_client/index.js';

// ============================================================================
// Types
// ============================================================================

export interface ArticleProfile {
    doi: string | null;
    pmid: string;
    title: string;
    authors: string;
    journalCitation: string;
    snippet: string;
    position?: number;
}

export interface MetaAnalysisRequest {
    question: string;
    context?: string;
    population: string;
    intervention: string;
    comparison: string;
    outcome: string;
    maxArticles?: number;
    dateFrom?: string;
    dateTo?: string;
}

export interface MetaAnalysisProgress {
    step: string;
    message: string;
    details?: any;
}

export type ProgressCallback = (progress: MetaAnalysisProgress) => void;

// ============================================================================
// PubMed Service Interface
// ============================================================================

interface IPubmedService {
    searchByPattern(params: {
        term: string;
        sort?: 'match' | 'date' | 'pubdate' | 'fauth' | 'jour';
        sortOrder?: 'asc' | 'dsc';
        filter?: string[];
        page?: number | null;
    }): Promise<{
        totalResults: number | null;
        totalPages: number | null;
        articleProfiles: ArticleProfile[];
        html: string;
    }>;

    getArticleDetail(pmid: string): Promise<{
        title: string;
        authors: Array<{ name: string }>;
        journalInfo: { title?: string; pubDate?: string };
        abstract: string;
        doi: string;
        publicationTypes: string[];
    }>;
}

// ============================================================================
// Meta-Analysis Agent Service
// ============================================================================

export class MetaAnalysisAgent {
    private pubmedService: IPubmedService;

    constructor(pubmedService: IPubmedService) {
        this.pubmedService = pubmedService;
    }

    /**
     * Run complete meta-analysis workflow
     */
    async runMetaAnalysis(
        request: MetaAnalysisRequest,
        onProgress?: ProgressCallback
    ): Promise<string> {
        try {
            // Step 1: Generate search query
            onProgress?.({ step: '1/6', message: 'Generating search strategy...' });
            const searchQuery = await this.generateSearchQuery(request);

            // Step 2: Search PubMed
            onProgress?.({ step: '2/6', message: 'Searching PubMed...', details: { query: searchQuery } });
            const articles = await this.searchPubMed(searchQuery, request.maxArticles || 100);

            // Step 3: Get article details
            onProgress?.({ step: '3/6', message: `Retrieving details for ${articles.length} articles...` });
            const detailedArticles = await this.getArticleDetails(articles, onProgress);

            // Step 4: Screen articles
            onProgress?.({ step: '4/6', message: 'Screening articles for relevance...' });
            const screenedArticles = await this.screenArticles(request.question, detailedArticles);

            // Step 5: Extract study data
            onProgress?.({ step: '5/6', message: `Extracting data from ${screenedArticles.length} studies...` });
            const studyExtractions = await this.extractStudyData(request.question, screenedArticles);

            // Step 6: Synthesize and generate report
            onProgress?.({ step: '6/6', message: 'Synthesizing findings and generating report...' });
            const report = await this.generateReport(request.question, studyExtractions);

            return report;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Meta-analysis failed: ${errorMessage}`);
        }
    }

    /**
     * Step 1: Generate search query using LLM
     */
    private async generateSearchQuery(request: MetaAnalysisRequest): Promise<string> {
        const result = await b.GenerateMetaAnalysisSearchQuery({
            question: request.question,
            context: request.context || null,
            population: request.population,
            intervention: request.intervention,
            comparison: request.comparison,
            outcome: request.outcome
        });

        return result;
    }

    /**
     * Step 2: Search PubMed for articles
     */
    private async searchPubMed(query: string, maxResults: number): Promise<ArticleProfile[]> {
        const result = await this.pubmedService.searchByPattern({
            term: query,
            sort: 'date',
            sortOrder: 'dsc',
            filter: ['pubt.randomizedcontrolledtrial', 'pubt.systematicreview', 'humans'],
            page: 1
        });

        const articles = result.articleProfiles.slice(0, maxResults);
        return articles;
    }

    /**
     * Step 3: Get detailed information for articles
     */
    private async getArticleDetails(
        profiles: ArticleProfile[],
        onProgress?: ProgressCallback
    ): Promise<any[]> {
        const articles: any[] = [];
        const batchSize = 5; // Process in batches to avoid overwhelming the server

        for (let i = 0; i < profiles.length; i += batchSize) {
            const batch = profiles.slice(i, i + batchSize);
            const batchPromises = batch.map(async (profile) => {
                try {
                    const detail = await this.pubmedService.getArticleDetail(profile.pmid);
                    return {
                        pmid: profile.pmid,
                        title: detail.title,
                        authors: detail.authors.map(a => a.name).join(', '),
                        journal: detail.journalInfo.title || '',
                        pub_date: detail.journalInfo.pubDate || '',
                        abstract: detail.abstract,
                        doi: detail.doi || '',
                        study_design: detail.publicationTypes.join(', ') || '',
                        sample_size: this.extractSampleSize(detail.abstract),
                        key_findings: [],
                        relevance_score: 0
                    };
                } catch (error) {
                    console.error(`Failed to get details for PMID ${profile.pmid}:`, error);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            articles.push(...batchResults.filter(a => a !== null));

            onProgress?.({
                step: '3/6',
                message: `Retrieved ${Math.min(i + batchSize, profiles.length)}/${profiles.length} articles...`
            });
        }

        return articles;
    }

    /**
     * Extract sample size from abstract text
     */
    private extractSampleSize(abstract: string): number | null {
        // Look for patterns like "n = 500", "sample of 100", "500 patients"
        const patterns = [
            /n\s*=\s*(\d+)/i,
            /sample\s+(?:of\s+)?(\d+)/i,
            /(\d+)\s+patients/i,
            /(\d+)\s+participants/i,
            /(\d+)\s+subjects/i
        ];

        for (const pattern of patterns) {
            const match = abstract.match(pattern);
            if (match) {
                return parseInt(match[1], 10);
            }
        }

        return null;
    }

    /**
     * Step 4: Screen articles for relevance using LLM
     */
    private async screenArticles(question: string, articles: any[]): Promise<any[]> {
        const decisions = await b.ScreenArticles(question, articles);

        // Filter articles based on screening decisions
        const includedArticles = articles.filter((article, index) => {
            const decision = decisions[index];
            return decision && decision.include;
        });

        return includedArticles;
    }

    /**
     * Step 5: Extract study data using LLM
     */
    private async extractStudyData(question: string, articles: any[]): Promise<any[]> {
        const extractions = await b.ExtractStudyData(question, articles);
        return extractions;
    }

    /**
     * Step 6: Synthesize findings and generate report using LLM
     */
    private async generateReport(question: string, studies: any[]): Promise<string> {
        // First synthesize the meta-analysis
        const synthesis = await b.SynthesizeMetaAnalysis(question, studies);

        // Then generate the final report
        const report = await b.GenerateMetaAnalysisReport(synthesis);

        return report;
    }

    /**
     * Quick search only - returns articles without full analysis
     */
    async quickSearch(request: MetaAnalysisRequest): Promise<ArticleProfile[]> {
        const query = await this.generateSearchQuery(request);
        const result = await this.pubmedService.searchByPattern({
            term: query,
            sort: 'date',
            sortOrder: 'dsc',
            filter: ['humans'],
            page: 1
        });

        return result.articleProfiles;
    }
}
