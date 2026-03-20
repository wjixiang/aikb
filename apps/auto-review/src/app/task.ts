import { PubmedService } from 'bibliography-search';
import type { ArticleProfile, PubmedSearchParams } from 'bibliography-search';
import {
  BamlService,
  SearchStrategyAdjustment,
  ArticleResult,
  SearchResultEvaluation,
} from './baml/baml.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Logger } from '../utils/logger.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SearchResult {
    term: string;
    totalResults: number | null;
    articleProfiles: ArticleProfile[];
    filters: string[];
    sort: string;
    dateRange: string;
    iteration: number;
}

export interface SearchStrategy {
    term: string;
    filters: string[];
    sort: string;
    reasoning: string;
}

export interface IterationState {
    iteration: number;
    strategy: SearchStrategy;
    result: SearchResult | null;
    adjustment: SearchStrategyAdjustment | null;
    evaluation?: SearchResultEvaluation;
}

export type ProgressCallback = (state: IterationState) => void | Promise<void>;

// ============================================================================
// Constants
// ============================================================================

const TARGET_COUNT_MIN = 80;
const TARGET_COUNT_MAX = 150;
const MAX_ITERATIONS = 5;
const TOP_ARTICLES_COUNT = 10;

// ============================================================================
// EpidemiologyResearchEngine
// ============================================================================

/**
 * Main engine for epidemiology literature research.
 * Implements an iterative search strategy with AI-powered adjustment.
 */
export class EpidemiologyResearchEngine {
    private readonly logger = new Logger(EpidemiologyResearchEngine.name);
    private readonly pubmedService = new PubmedService();

    constructor(
        private readonly bamlService: BamlService,
        private readonly prismaService: PrismaService,
    ) {}

    /**
     * Run research by task ID (fetches disease from database)
     */
    async runByTaskId(taskId: string, onProgress?: ProgressCallback): Promise<SearchResult> {
        const task = await this.prismaService.reviewTask.findUnique({ where: { id: taskId } });
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        this.logger.log(`Starting research for task: ${taskId}`);
        return this.run(task.taskInput, onProgress);
    }

    /**
     * Run research directly with disease string
     */
    async run(disease: string, onProgress?: ProgressCallback): Promise<SearchResult> {
        this.logger.log(`Starting epidemiology research for: ${disease}`);

        // Generate initial strategy
        const initialStrategy = await this.generateInitialStrategy(disease);
        let currentStrategy = initialStrategy;
        let lastResult: SearchResult | null = null;

        // Iterative search loop
        for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
            this.logger.log(`[Iteration ${iteration}] Term: ${currentStrategy.term}`);
            this.logger.debug(`[Iteration ${iteration}] Filters: ${currentStrategy.filters}, Sort: ${currentStrategy.sort}`);

            // Execute search
            const result = await this.executeSearch(currentStrategy);
            lastResult = result;

            // Report progress
            if (onProgress) {
                await onProgress({ iteration, strategy: currentStrategy, result, adjustment: null });
            }

            this.logger.log(`[Iteration ${iteration}] Found ${result.totalResults} results`);

            // Evaluate results using BAML LLM
            const evaluation = await this.evaluateResults(disease, currentStrategy, result);

            if (onProgress) {
                await onProgress({ iteration, strategy: currentStrategy, result, adjustment: null, evaluation });
            }

            this.logger.log(`[Iteration ${iteration}] Evaluation: ${evaluation.target_reached ? 'Target reached' : 'Continue'}, Relevance: ${evaluation.relevance_score}/10`);

            // Check if target reached based on LLM evaluation
            if (evaluation.target_reached) {
                this.logger.log(`[Iteration ${iteration}] Target reached: ${evaluation.reasoning}`);
                return { ...result, iteration };
            }

            // If not final iteration, try to adjust strategy
            if (iteration < MAX_ITERATIONS) {
                const adjustment = await this.adjustStrategy(disease, currentStrategy, result.totalResults ?? 0, result.articleProfiles);

                if (adjustment) {
                    currentStrategy = this.applyAdjustment(currentStrategy, adjustment);
                    this.logger.log(`[Iteration ${iteration}] Adjusted term: ${currentStrategy.term}`);

                    if (onProgress) {
                        await onProgress({ iteration, strategy: currentStrategy, result, adjustment, evaluation });
                    }
                } else {
                    this.logger.warn(`[Iteration ${iteration}] Failed to adjust strategy, stopping`);
                    break;
                }
            }
        }

        // Return final result
        if (lastResult) {
            this.logger.log(`Final result: ${lastResult.totalResults} results after ${MAX_ITERATIONS} iterations`);
            return { ...lastResult, iteration: MAX_ITERATIONS };
        }

        return this.emptyResult(disease);
    }

    /**
     * Generate initial search strategy using BAML
     */
    private async generateInitialStrategy(disease: string): Promise<SearchStrategy> {
        const strategy = await this.bamlService.generateSearchStrategy(disease);
        this.logger.log(`Generated initial strategy: ${strategy.term}`);
        this.logger.debug(`Reasoning: ${strategy.reasoning}`);
        return strategy;
    }

    /**
     * Execute PubMed search with given strategy
     */
    private async executeSearch(strategy: SearchStrategy): Promise<SearchResult> {
        const params: PubmedSearchParams = {
            term: strategy.term,
            sort: strategy.sort as 'match' | 'date' | 'pubdate' | 'fauth' | 'jour',
            sortOrder: 'dsc',
            filter: strategy.filters,
            page: 1,
        };

        const searchResult = await this.pubmedService.searchByPattern(params);

        return {
            term: strategy.term,
            totalResults: searchResult.totalResults,
            articleProfiles: searchResult.articleProfiles,
            filters: strategy.filters,
            sort: strategy.sort,
            dateRange: this.extractDateRange(searchResult.articleProfiles),
            iteration: 0,
        };
    }

    /**
     * Evaluate search results using BAML LLM
     */
    private async evaluateResults(
        disease: string,
        currentStrategy: SearchStrategy,
        result: SearchResult,
    ): Promise<SearchResultEvaluation> {
        const topArticles = this.buildTopArticles(result.articleProfiles);
        return await this.bamlService.evaluateSearchResults(
            disease,
            currentStrategy.term,
            result.totalResults ?? 0,
            topArticles,
            currentStrategy.filters,
            TARGET_COUNT_MIN,
            TARGET_COUNT_MAX,
        );
    }

    /**
     * Adjust strategy using BAML or fallback heuristics
     */
    private async adjustStrategy(
        disease: string,
        currentStrategy: SearchStrategy,
        resultCount: number,
        articles: ArticleProfile[],
    ): Promise<SearchStrategyAdjustment | null> {
        try {
            const topArticles = this.buildTopArticles(articles);
            return await this.bamlService.adjustSearchStrategy(
                disease,
                currentStrategy.term,
                resultCount,
                topArticles,
                currentStrategy.filters,
                currentStrategy.sort,
            );
        } catch (error) {
            this.logger.error(`Strategy adjustment failed: ${error}, using fallback`);
            return this.getFallbackAdjustment(currentStrategy, resultCount);
        }
    }

    /**
     * Build top articles list for BAML analysis
     */
    private buildTopArticles(articles: ArticleProfile[]): ArticleResult[] {
        return articles.slice(0, TOP_ARTICLES_COUNT).map(a => ({
            pmid: a.pmid,
            title: a.title,
            snippet: a.snippet,
            journal_citation: a.journalCitation,
        }));
    }

    /**
     * Apply adjustment to current strategy
     */
    private applyAdjustment(strategy: SearchStrategy, adjustment: SearchStrategyAdjustment): SearchStrategy {
        return {
            term: adjustment.adjusted_term,
            filters: this.applyFilterChanges(strategy.filters, adjustment),
            sort: adjustment.sort || strategy.sort,
            reasoning: adjustment.reasoning,
        };
    }

    /**
     * Apply filter changes from adjustment
     */
    private applyFilterChanges(currentFilters: string[], adjustment: SearchStrategyAdjustment): string[] {
        return [
            ...currentFilters.filter(f => !adjustment.filters_to_remove.includes(f)),
            ...adjustment.filters_to_add,
        ];
    }

    /**
     * Fallback heuristic adjustment when BAML fails
     */
    private getFallbackAdjustment(currentStrategy: SearchStrategy, resultCount: number): SearchStrategyAdjustment {
        if (resultCount === 0) {
            return {
                adjusted_term: currentStrategy.term.split(' AND ')[0].split(' OR ')[0],
                filters_to_add: [],
                filters_to_remove: [...currentStrategy.filters],
                sort: 'pubdate',
                reasoning: 'Fallback: no results, simplified search',
            };
        }

        if (resultCount < TARGET_COUNT_MIN) {
            return {
                adjusted_term: currentStrategy.term,
                filters_to_add: [],
                filters_to_remove: currentStrategy.filters.filter(f =>
                    ['systematic review', 'meta-analysis', 'randomized controlled trial'].includes(f)
                ),
                sort: 'pubdate',
                reasoning: 'Fallback: too few results, removing restrictive filters',
            };
        }

        return {
            adjusted_term: currentStrategy.term,
            filters_to_add: ['systematic review'],
            filters_to_remove: [],
            sort: 'pubdate',
            reasoning: 'Fallback: too many results, adding systematic review filter',
        };
    }

    /**
     * Extract date range from search results
     */
    private extractDateRange(articles: ArticleProfile[]): string {
        if (articles.length === 0) return 'unknown';

        const years = articles
            .map(a => {
                const match = a.journalCitation.match(/\d{4}/);
                return match ? parseInt(match[0], 10) : null;
            })
            .filter((y): y is number => y !== null && y > 1900 && y <= new Date().getFullYear());

        if (years.length === 0) return 'unknown';

        return `${Math.min(...years)}-${Math.max(...years)}`;
    }

    /**
     * Create empty result object
     */
    private emptyResult(disease: string): SearchResult {
        return {
            term: disease,
            totalResults: 0,
            articleProfiles: [],
            filters: [],
            sort: 'pubdate',
            dateRange: '',
            iteration: 0,
        };
    }

    // =========================================================================
    // Legacy alias for backward compatibility
    // =========================================================================

    /**
     * @deprecated Use run() or runByTaskId() instead
     */
    async start(taskId: string): Promise<SearchResult> {
        return this.runByTaskId(taskId);
    }

    /**
     * @deprecated Use run() instead
     */
    async ResearchEpidemiology(disease: string): Promise<SearchResult> {
        return this.run(disease);
    }
}
