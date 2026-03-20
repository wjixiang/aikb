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
 * TreatmentSearchEngine - Specialized search for treatment literature
 *
 * Searches for studies including:
 * - Therapeutic interventions
 * - Drug treatments
 * - Surgical procedures
 * - Rehabilitation
 * - Treatment outcomes and efficacy
 */
export class TreatmentSearchEngine extends BaseSearchEngine {
  constructor(bamlService: BamlService) {
    super(bamlService, 'treatment');
  }

  protected getSectionName(): string {
    return 'Treatment Research';
  }

  protected async generateInitialStrategy(disease: string): Promise<SearchStrategy> {
    const strategy = await this.bamlService.generateTreatmentStrategy(disease);
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
      return await this.bamlService.adjustTreatmentStrategy(
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
    return await this.bamlService.evaluateTreatmentResults(
      disease,
      currentStrategy.term,
      result.totalResults ?? 0,
      topArticles,
      currentStrategy.filters,
    );
  }
}
