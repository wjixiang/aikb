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

/**
 * EpidemiologySearchEngine - Specialized search for epidemiology literature
 *
 * Searches for epidemiological studies including:
 * - Prevalence and incidence rates
 * - Risk factor analysis
 * - Population studies
 * - Epidemiological methods
 */
export class EpidemiologySearchEngine extends BaseSearchEngine {
  constructor(bamlService: BamlService) {
    super(bamlService, 'epidemiology');
  }

  protected getSectionName(): string {
    return 'Epidemiology Research';
  }

  protected async generateInitialStrategy(disease: string): Promise<SearchStrategy> {
    const strategy = await this.bamlService.generateEpidemiologyStrategy(disease);
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
      return await this.bamlService.adjustEpidemiologyStrategy(
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
    return await this.bamlService.evaluateEpidemiologyResults(
      disease,
      currentStrategy.term,
      result.totalResults ?? 0,
      topArticles,
      currentStrategy.filters,
    );
  }
}
