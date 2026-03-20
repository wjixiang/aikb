import { ArticleProfile } from 'bibliography-search';
import {
  BaseSearchEngine,
  SearchResult,
  SearchStrategy,
} from './base.engine.js';
import {
  BamlService,
  SearchStrategyAdjustment,
  SearchResultEvaluation,
} from '../app/baml/baml.service.js';
import { SearchResultService } from '../search/search-result.service.js';
import { ArticleEmbeddingService } from '../search/article-embedding.service.js';

/**
 * PathophysiologySearchEngine - Specialized search for pathophysiology literature
 *
 * Searches for studies including:
 * - Disease mechanisms
 * - Cellular and molecular processes
 * - Biochemical changes
 * - Organ system dysfunction
 */
export class PathophysiologySearchEngine extends BaseSearchEngine {
  constructor(
    bamlService: BamlService,
    searchResultService?: SearchResultService,
    embeddingService?: ArticleEmbeddingService,
  ) {
    super(
      bamlService,
      'pathophysiology',
      searchResultService,
      embeddingService,
    );
  }

  protected getSectionName(): string {
    return 'Pathophysiology Research';
  }

  protected async generateInitialStrategy(
    disease: string,
  ): Promise<SearchStrategy> {
    const strategy =
      await this.bamlService.generatePathophysiologyStrategy(disease);
    this.logger.log(`Generated initial strategy: ${strategy.term}`);
    this.logger.debug(`Reasoning: ${strategy.reasoning}`);
    return strategy;
  }

  protected async adjustStrategy(
    disease: string,
    currentStrategy: SearchStrategy,
    resultCount: number,
    articles: ArticleProfile[],
  ): Promise<SearchStrategyAdjustment | null> {
    try {
      const topArticles = this.buildTopArticles(articles);
      return await this.bamlService.adjustPathophysiologyStrategy(
        disease,
        currentStrategy.term,
        resultCount,
        topArticles,
        currentStrategy.filters,
      );
    } catch (error) {
      this.logger.error(`Strategy adjustment failed: ${error}, using fallback`);
      return this.getFallbackAdjustment(currentStrategy, resultCount);
    }
  }

  protected async evaluateResults(
    disease: string,
    currentStrategy: SearchStrategy,
    result: SearchResult,
  ): Promise<SearchResultEvaluation> {
    const topArticles = this.buildTopArticles(result.articleProfiles);
    return await this.bamlService.evaluatePathophysiologyResults(
      disease,
      currentStrategy.term,
      result.totalResults ?? 0,
      topArticles,
      currentStrategy.filters,
    );
  }
}
