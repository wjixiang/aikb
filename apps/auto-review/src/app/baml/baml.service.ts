import config from '../../config.js';

export interface SearchStrategy {
  term: string;
  filters: string[];
  sort: string;
  reasoning: string;
}

export interface SearchStrategyAdjustment {
  adjusted_term: string;
  filters_to_add: string[];
  filters_to_remove: string[];
  sort: string;
  reasoning: string;
}

export interface ArticleResult {
  pmid: string;
  title: string;
  snippet: string;
  journal_citation: string;
}

export interface SearchResultEvaluation {
  target_reached: boolean;
  relevance_score: number;
  relevant_article_count: number;
  reasoning: string;
  improvement_suggestions?: string;
}

/**
 * BamlService wrapper for BAML client operations
 * Uses dynamic import for CJS BAML client
 */
export class BamlService {
  private bamlClient: any;

  constructor() {
    // Client will be initialized in init()
  }

  /**
   * Initialize BAML client
   */
  async init() {
    try {
      // Load BAML client dynamically (CJS)
      // @ts-ignore - BAML client is CJS without types
      const bamlModule = await import('../../../baml_client/index.js');
      this.bamlClient = bamlModule.b;
      console.log('BAML client initialized');
    } catch (error) {
      console.error('Failed to initialize BAML client:', error);
      throw error;
    }
  }

  /**
   * Generate initial search strategy for a disease
   * @param disease - The disease/topic to search for
   * @param searchFocus - Optional focus area (epidemiology, pathophysiology, clinical, treatment)
   */
  async generateSearchStrategy(disease: string, searchFocus?: string): Promise<SearchStrategy> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }

      const result = await this.bamlClient.GenerateSearchStrategy(disease, searchFocus);
      return {
        term: result.term,
        filters: result.filters || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      console.error(`Failed to generate search strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Analyze search results and suggest adjustments
   * @param topArticles - Top 10 articles with pmid, title, snippet, journal_citation
   * @param searchFocus - Optional focus area for the search
   */
  async adjustSearchStrategy(
    disease: string,
    previousTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
    currentSort: string,
    searchFocus?: string,
  ): Promise<SearchStrategyAdjustment> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }

      const result = await this.bamlClient.AdjustSearchStrategy(
        disease,
        previousTerm,
        resultCount,
        topArticles,
        currentFilters,
        currentSort,
        searchFocus,
      );

      return {
        adjusted_term: result.adjusted_term,
        filters_to_add: result.filters_to_add || [],
        filters_to_remove: result.filters_to_remove || [],
        sort: result.sort || currentSort,
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error(`Failed to adjust search strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate search results to determine if target is reached
   * @param searchFocus - Optional focus area for the search
   */
  async evaluateSearchResults(
    disease: string,
    currentTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
    targetCountMin: number = 80,
    targetCountMax: number = 150,
    searchFocus?: string,
  ): Promise<SearchResultEvaluation> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }

      const result = await this.bamlClient.EvaluateSearchResults(
        disease,
        currentTerm,
        resultCount,
        topArticles,
        currentFilters,
        targetCountMin,
        targetCountMax,
        searchFocus,
      );

      return {
        target_reached: result.target_reached,
        relevance_score: result.relevance_score,
        relevant_article_count: result.relevant_article_count,
        reasoning: result.reasoning,
        improvement_suggestions: result.improvement_suggestions,
      };
    } catch (error) {
      console.error(`Failed to evaluate search results: ${error}`);
      throw error;
    }
  }

  // =========================================================================
  // Specialized methods for each review section
  // =========================================================================

  /**
   * Generate epidemiology-focused search strategy
   */
  async generateEpidemiologyStrategy(disease: string): Promise<SearchStrategy> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.GenerateEpidemiologyStrategy(disease);
      return {
        term: result.term,
        filters: result.filters || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      console.error(`Failed to generate epidemiology strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Adjust epidemiology search strategy
   */
  async adjustEpidemiologyStrategy(
    disease: string,
    previousTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
  ): Promise<SearchStrategyAdjustment> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.AdjustEpidemiologyStrategy(
        disease,
        previousTerm,
        resultCount,
        topArticles,
        currentFilters,
      );
      return {
        adjusted_term: result.adjusted_term,
        filters_to_add: result.filters_to_add || [],
        filters_to_remove: result.filters_to_remove || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error(`Failed to adjust epidemiology strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate epidemiology search results
   */
  async evaluateEpidemiologyResults(
    disease: string,
    currentTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
    targetCountMin: number = 80,
    targetCountMax: number = 150,
  ): Promise<SearchResultEvaluation> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.EvaluateEpidemiologyResults(
        disease,
        currentTerm,
        resultCount,
        topArticles,
        currentFilters,
        targetCountMin,
        targetCountMax,
      );
      return {
        target_reached: result.target_reached,
        relevance_score: result.relevance_score,
        relevant_article_count: result.relevant_article_count,
        reasoning: result.reasoning,
        improvement_suggestions: result.improvement_suggestions,
      };
    } catch (error) {
      console.error(`Failed to evaluate epidemiology results: ${error}`);
      throw error;
    }
  }

  /**
   * Generate pathophysiology-focused search strategy
   */
  async generatePathophysiologyStrategy(disease: string): Promise<SearchStrategy> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.GeneratePathophysiologyStrategy(disease);
      return {
        term: result.term,
        filters: result.filters || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      console.error(`Failed to generate pathophysiology strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Adjust pathophysiology search strategy
   */
  async adjustPathophysiologyStrategy(
    disease: string,
    previousTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
  ): Promise<SearchStrategyAdjustment> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.AdjustPathophysiologyStrategy(
        disease,
        previousTerm,
        resultCount,
        topArticles,
        currentFilters,
      );
      return {
        adjusted_term: result.adjusted_term,
        filters_to_add: result.filters_to_add || [],
        filters_to_remove: result.filters_to_remove || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error(`Failed to adjust pathophysiology strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate pathophysiology search results
   */
  async evaluatePathophysiologyResults(
    disease: string,
    currentTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
    targetCountMin: number = 80,
    targetCountMax: number = 150,
  ): Promise<SearchResultEvaluation> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.EvaluatePathophysiologyResults(
        disease,
        currentTerm,
        resultCount,
        topArticles,
        currentFilters,
        targetCountMin,
        targetCountMax,
      );
      return {
        target_reached: result.target_reached,
        relevance_score: result.relevance_score,
        relevant_article_count: result.relevant_article_count,
        reasoning: result.reasoning,
        improvement_suggestions: result.improvement_suggestions,
      };
    } catch (error) {
      console.error(`Failed to evaluate pathophysiology results: ${error}`);
      throw error;
    }
  }

  /**
   * Generate clinical-focused search strategy
   */
  async generateClinicalStrategy(disease: string): Promise<SearchStrategy> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.GenerateClinicalStrategy(disease);
      return {
        term: result.term,
        filters: result.filters || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      console.error(`Failed to generate clinical strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Adjust clinical search strategy
   */
  async adjustClinicalStrategy(
    disease: string,
    previousTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
  ): Promise<SearchStrategyAdjustment> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.AdjustClinicalStrategy(
        disease,
        previousTerm,
        resultCount,
        topArticles,
        currentFilters,
      );
      return {
        adjusted_term: result.adjusted_term,
        filters_to_add: result.filters_to_add || [],
        filters_to_remove: result.filters_to_remove || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error(`Failed to adjust clinical strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate clinical search results
   */
  async evaluateClinicalResults(
    disease: string,
    currentTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
    targetCountMin: number = 80,
    targetCountMax: number = 150,
  ): Promise<SearchResultEvaluation> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.EvaluateClinicalResults(
        disease,
        currentTerm,
        resultCount,
        topArticles,
        currentFilters,
        targetCountMin,
        targetCountMax,
      );
      return {
        target_reached: result.target_reached,
        relevance_score: result.relevance_score,
        relevant_article_count: result.relevant_article_count,
        reasoning: result.reasoning,
        improvement_suggestions: result.improvement_suggestions,
      };
    } catch (error) {
      console.error(`Failed to evaluate clinical results: ${error}`);
      throw error;
    }
  }

  /**
   * Generate treatment-focused search strategy
   */
  async generateTreatmentStrategy(disease: string): Promise<SearchStrategy> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.GenerateTreatmentStrategy(disease);
      return {
        term: result.term,
        filters: result.filters || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning || '',
      };
    } catch (error) {
      console.error(`Failed to generate treatment strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Adjust treatment search strategy
   */
  async adjustTreatmentStrategy(
    disease: string,
    previousTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
  ): Promise<SearchStrategyAdjustment> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.AdjustTreatmentStrategy(
        disease,
        previousTerm,
        resultCount,
        topArticles,
        currentFilters,
      );
      return {
        adjusted_term: result.adjusted_term,
        filters_to_add: result.filters_to_add || [],
        filters_to_remove: result.filters_to_remove || [],
        sort: result.sort || 'pubdate',
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error(`Failed to adjust treatment strategy: ${error}`);
      throw error;
    }
  }

  /**
   * Evaluate treatment search results
   */
  async evaluateTreatmentResults(
    disease: string,
    currentTerm: string,
    resultCount: number,
    topArticles: ArticleResult[],
    currentFilters: string[],
    targetCountMin: number = 80,
    targetCountMax: number = 150,
  ): Promise<SearchResultEvaluation> {
    try {
      if (!this.bamlClient) {
        throw new Error('BAML client not initialized. Call init() first.');
      }
      const result = await this.bamlClient.EvaluateTreatmentResults(
        disease,
        currentTerm,
        resultCount,
        topArticles,
        currentFilters,
        targetCountMin,
        targetCountMax,
      );
      return {
        target_reached: result.target_reached,
        relevance_score: result.relevance_score,
        relevant_article_count: result.relevant_article_count,
        reasoning: result.reasoning,
        improvement_suggestions: result.improvement_suggestions,
      };
    } catch (error) {
      console.error(`Failed to evaluate treatment results: ${error}`);
      throw error;
    }
  }
}
