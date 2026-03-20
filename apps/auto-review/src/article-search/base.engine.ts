import { PubmedService } from 'bibliography-search';
import type { ArticleProfile, PubmedSearchParams } from 'bibliography-search';
import {
  BamlService,
  SearchStrategyAdjustment,
  ArticleResult,
  SearchResultEvaluation,
  SearchStrategy,
} from '../app/baml/baml.service.js';
import {
  SearchResultService,
  type ArticleSearchData,
} from '../search/search-result.service.js';
import { ArticleEmbeddingService } from '../search/article-embedding.service.js';
import { Logger } from '../utils/logger.js';

export interface SearchResult {
  term: string;
  totalResults: number | null;
  articleProfiles: ArticleProfile[];
  filters: string[];
  sort: string;
  dateRange: string;
  iteration: number;
  searchId?: string;
}

export type {
  SearchStrategy,
  SearchStrategyAdjustment,
  SearchResultEvaluation,
};

export interface IterationState {
  iteration: number;
  strategy: SearchStrategy;
  result: SearchResult | null;
  adjustment: SearchStrategyAdjustment | null;
  evaluation?: SearchResultEvaluation;
}

export type ProgressCallback = (state: IterationState) => void | Promise<void>;

export type ReviewSection =
  | 'epidemiology'
  | 'pathophysiology'
  | 'clinical'
  | 'treatment';

const TARGET_COUNT_MIN = 80;
const TARGET_COUNT_MAX = 150;
const MAX_ITERATIONS = 5;
const TOP_ARTICLES_COUNT = 10;

export abstract class BaseSearchEngine {
  protected readonly logger: Logger;
  protected readonly pubmedService = new PubmedService();

  constructor(
    protected readonly bamlService: BamlService,
    protected readonly section: ReviewSection,
    protected readonly searchResultService?: SearchResultService,
    protected readonly embeddingService?: ArticleEmbeddingService,
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
  }

  protected abstract getSectionName(): string;

  async run(
    disease: string,
    onProgress?: ProgressCallback,
  ): Promise<SearchResult> {
    this.logger.log(`Starting ${this.getSectionName()} search for: ${disease}`);

    const initialStrategy = await this.generateInitialStrategy(disease);
    let currentStrategy = initialStrategy;
    let lastResult: SearchResult | null = null;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      this.logger.log(`[Iteration ${iteration}] Term: ${currentStrategy.term}`);
      this.logger.debug(
        `[Iteration ${iteration}] Filters: ${currentStrategy.filters}, Sort: ${currentStrategy.sort}`,
      );

      const result = await this.executeSearch(currentStrategy);
      lastResult = result;

      if (onProgress) {
        await onProgress({
          iteration,
          strategy: currentStrategy,
          result,
          adjustment: null,
        });
      }

      this.logger.log(
        `[Iteration ${iteration}] Found ${result.totalResults} results`,
      );

      const evaluation = await this.evaluateResults(
        disease,
        currentStrategy,
        result,
      );

      if (onProgress) {
        await onProgress({
          iteration,
          strategy: currentStrategy,
          result,
          adjustment: null,
          evaluation,
        });
      }

      this.logger.log(
        `[Iteration ${iteration}] Evaluation: ${evaluation.target_reached ? 'Target reached' : 'Continue'}, Relevance: ${evaluation.relevance_score}/10`,
      );

      if (evaluation.target_reached) {
        this.logger.log(
          `[Iteration ${iteration}] Target reached: ${evaluation.reasoning}`,
        );
        return { ...result, iteration };
      }

      if (iteration < MAX_ITERATIONS) {
        const adjustment = await this.adjustStrategy(
          disease,
          currentStrategy,
          result.totalResults ?? 0,
          result.articleProfiles,
        );

        if (adjustment) {
          currentStrategy = this.applyAdjustment(currentStrategy, adjustment);
          this.logger.log(
            `[Iteration ${iteration}] Adjusted term: ${currentStrategy.term}`,
          );

          if (onProgress) {
            await onProgress({
              iteration,
              strategy: currentStrategy,
              result,
              adjustment,
              evaluation,
            });
          }
        } else {
          this.logger.warn(
            `[Iteration ${iteration}] Failed to adjust strategy, stopping`,
          );
          break;
        }
      }
    }

    if (lastResult) {
      this.logger.log(
        `Final result: ${lastResult.totalResults} results after ${MAX_ITERATIONS} iterations`,
      );
      return { ...lastResult, iteration: MAX_ITERATIONS };
    }

    return this.emptyResult(disease);
  }

  async runWithSave(
    taskId: string,
    disease: string,
    onProgress?: ProgressCallback,
    embedResults: boolean = true,
  ): Promise<SearchResult> {
    if (!this.searchResultService) {
      throw new Error('SearchResultService not configured');
    }

    this.logger.log(
      `Starting ${this.getSectionName()} search with save for task: ${taskId}`,
    );

    const result = await this.run(disease, onProgress);

    const searchData: ArticleSearchData = {
      taskId,
      searchTerm: result.term,
      totalResults: result.totalResults,
      filters: result.filters,
      sort: result.sort,
      dateRange: result.dateRange,
      iteration: result.iteration,
      final: true,
      articleProfiles: result.articleProfiles,
    };

    const savedSearch =
      await this.searchResultService.saveSearchResult(searchData);
    this.logger.log(`Saved search results with ID: ${savedSearch.id}`);

    if (
      embedResults &&
      this.embeddingService &&
      result.articleProfiles.length > 0
    ) {
      this.logger.log(
        `Starting embedding for ${result.articleProfiles.length} articles...`,
      );
      await this.embeddingService.embedSearchResults(taskId, {}, (progress) => {
        this.logger.log(
          `Embedding progress: ${progress.embeddedArticles}/${progress.totalArticles}`,
        );
      });
    }

    return { ...result, searchId: savedSearch.id };
  }

  protected abstract generateInitialStrategy(
    disease: string,
  ): Promise<SearchStrategy>;

  protected abstract adjustStrategy(
    disease: string,
    currentStrategy: SearchStrategy,
    resultCount: number,
    articles: ArticleProfile[],
  ): Promise<SearchStrategyAdjustment | null>;

  protected abstract evaluateResults(
    disease: string,
    currentStrategy: SearchStrategy,
    result: SearchResult,
  ): Promise<SearchResultEvaluation>;

  protected async executeSearch(
    strategy: SearchStrategy,
  ): Promise<SearchResult> {
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

  protected buildTopArticles(articles: ArticleProfile[]): ArticleResult[] {
    return articles.slice(0, TOP_ARTICLES_COUNT).map((a) => ({
      pmid: a.pmid,
      title: a.title,
      snippet: a.snippet,
      journal_citation: a.journalCitation,
    }));
  }

  protected applyAdjustment(
    strategy: SearchStrategy,
    adjustment: SearchStrategyAdjustment,
  ): SearchStrategy {
    return {
      term: adjustment.adjusted_term,
      filters: this.applyFilterChanges(strategy.filters, adjustment),
      sort: adjustment.sort || strategy.sort,
      reasoning: adjustment.reasoning,
    };
  }

  protected applyFilterChanges(
    currentFilters: string[],
    adjustment: SearchStrategyAdjustment,
  ): string[] {
    return [
      ...currentFilters.filter(
        (f) => !adjustment.filters_to_remove.includes(f),
      ),
      ...adjustment.filters_to_add,
    ];
  }

  protected getFallbackAdjustment(
    currentStrategy: SearchStrategy,
    resultCount: number,
  ): SearchStrategyAdjustment {
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
        filters_to_remove: currentStrategy.filters.filter((f) =>
          [
            'systematic review',
            'meta-analysis',
            'randomized controlled trial',
          ].includes(f),
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

  protected extractDateRange(articles: ArticleProfile[]): string {
    if (articles.length === 0) return 'unknown';

    const years = articles
      .map((a) => {
        const match = a.journalCitation.match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter(
        (y): y is number =>
          y !== null && y > 1900 && y <= new Date().getFullYear(),
      );

    if (years.length === 0) return 'unknown';

    return `${Math.min(...years)}-${Math.max(...years)}`;
  }

  protected emptyResult(disease: string): SearchResult {
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
}
