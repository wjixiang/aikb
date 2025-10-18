/**
 * 统一的文本切片策略接口
 * 定义了所有chunking策略必须实现的标准接口
 */

/**
 * @deprecated Use ChunkingStrategy instead
 * Legacy enum for backward compatibility
 * Will be removed in v3.0.0
 */
export enum ChunkingStrategyType {
  H1 = 'h1',
  PARAGRAPH = 'paragraph',
}

/**
 * Comprehensive enum for all chunking strategies
 * Includes current strategies and future extensions
 */
export enum ChunkingStrategy {
  // Current implemented strategies
  H1 = 'h1',
  PARAGRAPH = 'paragraph',
  
  // Referenced but not yet implemented
  SEMANTIC = 'semantic',
  MIXED = 'mixed',
  CUSTOM = 'custom',
  
  // Future strategies (planned)
  SENTENCE = 'sentence',
  RECURSIVE = 'recursive',
  FIXED_SIZE = 'fixed_size',
  TOKEN_BASED = 'token_based',
  MARKDOWN_SECTION = 'markdown_section',
  HTML_TAG = 'html_tag',
  CODE_BLOCK = 'code_block',
  
  // Special strategies
  AUTO = 'auto',  // Automatic strategy selection
  LEGACY = 'legacy',  // For backward compatibility
}

/**
 * Strategy categories for organization
 */
export enum ChunkingStrategyCategory {
  STRUCTURE_BASED = 'structure_based',  // H1, markdown_section, html_tag
  CONTENT_BASED = 'content_based',      // paragraph, sentence, semantic
  SIZE_BASED = 'size_based',            // fixed_size, token_based, recursive
  HYBRID = 'hybrid',                    // mixed, custom
  SYSTEM = 'system'                     // auto, legacy
}

/**
 * Strategy metadata interface
 */
export interface ChunkingStrategyMetadata {
  name: ChunkingStrategy;
  category: ChunkingStrategyCategory;
  displayName: string;
  description: string;
  version: string;
  isImplemented: boolean;
  requiresTitle: boolean;
  defaultConfig: ChunkingConfig;
  fallbackStrategies: ChunkingStrategy[];
}

/**
 * 基础的chunk结果接口
 */
export interface BaseChunkResult {
  content: string; // 切片内容
  index: number; // 切片在文档中的索引位置
}

/**
 * 带标题的chunk结果接口（用于基于标题的切片）
 */
export interface TitledChunkResult extends BaseChunkResult {
  title: string; // 切片标题
}

/**
 * 统一的chunk结果类型，可以是带标题的或不带标题的
 */
export type ChunkResult = BaseChunkResult | TitledChunkResult;

/**
 * 切片策略配置接口
 */
export interface ChunkingConfig {
  maxChunkSize?: number; // 最大切片大小（字符数）
  minChunkSize?: number; // 最小切片大小（字符数）
  overlap?: number; // 切片之间的重叠字符数
  strategy?: string; // 策略特定参数
}

/**
 * 文本切片策略的基础接口
 * 所有切片策略都必须实现此接口
 */
export interface IChunkingStrategy {
  /**
   * 策略名称，用于标识和选择策略
   */
  readonly name: string;

  /**
   * 策略描述
   */
  readonly description: string;

  /**
   * 策略版本
   */
  readonly version: string;

  /**
   * 检查文本是否适合此策略
   * @param text 输入文本
   * @returns 是否适合
   */
  canHandle(text: string): boolean;

  /**
   * 对文本进行切片
   * @param text 输入文本
   * @param config 切片配置
   * @returns 切片结果数组
   */
  chunk(text: string, config?: ChunkingConfig): ChunkResult[];

  /**
   * 获取策略的默认配置
   * @returns 默认配置
   */
  getDefaultConfig(): ChunkingConfig;

  /**
   * 验证配置是否有效
   * @param config 配置对象
   * @returns 验证结果
   */
  validateConfig(config: ChunkingConfig): { valid: boolean; errors: string[] };
}

/**
 * 抽象基类，实现了通用的配置验证逻辑
 */
export abstract class BaseChunkingStrategy implements IChunkingStrategy {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;

  abstract canHandle(text: string): boolean;
  abstract chunk(text: string, config?: ChunkingConfig): ChunkResult[];

  getDefaultConfig(): ChunkingConfig {
    return {
      maxChunkSize: 1000,
      minChunkSize: 100,
      overlap: 50,
    };
  }

  validateConfig(config: ChunkingConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.maxChunkSize !== undefined) {
      if (typeof config.maxChunkSize !== 'number' || config.maxChunkSize <= 0) {
        errors.push('maxChunkSize must be a positive number');
      }
    }

    if (config.minChunkSize !== undefined) {
      if (typeof config.minChunkSize !== 'number' || config.minChunkSize <= 0) {
        errors.push('minChunkSize must be a positive number');
      }
    }

    if (config.overlap !== undefined) {
      if (typeof config.overlap !== 'number' || config.overlap < 0) {
        errors.push('overlap must be a non-negative number');
      }
    }

    if (
      config.maxChunkSize !== undefined &&
      config.minChunkSize !== undefined
    ) {
      if (config.minChunkSize > config.maxChunkSize) {
        errors.push('minChunkSize cannot be greater than maxChunkSize');
      }
    }

    if (config.maxChunkSize !== undefined && config.overlap !== undefined) {
      if (config.overlap >= config.maxChunkSize) {
        errors.push('overlap should be less than maxChunkSize');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 检查结果是否为带标题的chunk
   */
  protected isTitledChunk(chunk: ChunkResult): chunk is TitledChunkResult {
    return 'title' in chunk;
  }
}

/**
 * Registry of all chunking strategies with their metadata
 */
export const CHUNKING_STRATEGY_REGISTRY: Record<string, ChunkingStrategyMetadata> = {
  [ChunkingStrategy.H1]: {
    name: ChunkingStrategy.H1,
    category: ChunkingStrategyCategory.STRUCTURE_BASED,
    displayName: 'H1 Headers',
    description: 'Splits markdown text based on H1 headers',
    version: '1.0.0',
    isImplemented: true,
    requiresTitle: true,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.PARAGRAPH]: {
    name: ChunkingStrategy.PARAGRAPH,
    category: ChunkingStrategyCategory.CONTENT_BASED,
    displayName: 'Paragraphs',
    description: 'Splits text by paragraphs with intelligent merging',
    version: '1.0.0',
    isImplemented: true,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 500, minChunkSize: 50, overlap: 25 },
    fallbackStrategies: [ChunkingStrategy.H1],
  },
  
  [ChunkingStrategy.SEMANTIC]: {
    name: ChunkingStrategy.SEMANTIC,
    category: ChunkingStrategyCategory.CONTENT_BASED,
    displayName: 'Semantic',
    description: 'Uses semantic similarity to determine chunk boundaries',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 800, minChunkSize: 100, overlap: 100 },
    fallbackStrategies: [ChunkingStrategy.H1, ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.MIXED]: {
    name: ChunkingStrategy.MIXED,
    category: ChunkingStrategyCategory.HYBRID,
    displayName: 'Mixed',
    description: 'Combines multiple strategies for optimal chunking',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.H1, ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.SENTENCE]: {
    name: ChunkingStrategy.SENTENCE,
    category: ChunkingStrategyCategory.CONTENT_BASED,
    displayName: 'Sentences',
    description: 'Splits text by sentences with intelligent grouping',
    version: '1.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 300, minChunkSize: 50, overlap: 20 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.RECURSIVE]: {
    name: ChunkingStrategy.RECURSIVE,
    category: ChunkingStrategyCategory.SIZE_BASED,
    displayName: 'Recursive',
    description: 'Recursively splits content until size constraints are met',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.FIXED_SIZE]: {
    name: ChunkingStrategy.FIXED_SIZE,
    category: ChunkingStrategyCategory.SIZE_BASED,
    displayName: 'Fixed Size',
    description: 'Splits content into fixed-size chunks',
    version: '1.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 500, minChunkSize: 500, overlap: 0 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.TOKEN_BASED]: {
    name: ChunkingStrategy.TOKEN_BASED,
    category: ChunkingStrategyCategory.SIZE_BASED,
    displayName: 'Token-based',
    description: 'Splits content based on token count rather than characters',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 500, minChunkSize: 50, overlap: 25 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.MARKDOWN_SECTION]: {
    name: ChunkingStrategy.MARKDOWN_SECTION,
    category: ChunkingStrategyCategory.STRUCTURE_BASED,
    displayName: 'Markdown Sections',
    description: 'Splits markdown based on any header level (H1-H6)',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: true,
    defaultConfig: { maxChunkSize: 1500, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.H1, ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.HTML_TAG]: {
    name: ChunkingStrategy.HTML_TAG,
    category: ChunkingStrategyCategory.STRUCTURE_BASED,
    displayName: 'HTML Tags',
    description: 'Splits HTML content based on specified tags',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.CODE_BLOCK]: {
    name: ChunkingStrategy.CODE_BLOCK,
    category: ChunkingStrategyCategory.STRUCTURE_BASED,
    displayName: 'Code Blocks',
    description: 'Specialized strategy for code documentation',
    version: '2.0.0',
    isImplemented: false,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 800, minChunkSize: 50, overlap: 25 },
    fallbackStrategies: [ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.CUSTOM]: {
    name: ChunkingStrategy.CUSTOM,
    category: ChunkingStrategyCategory.HYBRID,
    displayName: 'Custom',
    description: 'User-defined custom chunking strategy',
    version: '2.0.0',
    isImplemented: true,  // Can be registered at runtime
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.H1, ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.AUTO]: {
    name: ChunkingStrategy.AUTO,
    category: ChunkingStrategyCategory.SYSTEM,
    displayName: 'Auto',
    description: 'Automatically selects the best strategy based on content',
    version: '2.0.0',
    isImplemented: true,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.H1, ChunkingStrategy.PARAGRAPH],
  },
  
  [ChunkingStrategy.LEGACY]: {
    name: ChunkingStrategy.LEGACY,
    category: ChunkingStrategyCategory.SYSTEM,
    displayName: 'Legacy',
    description: 'Legacy strategy for backward compatibility',
    version: '1.0.0',
    isImplemented: true,
    requiresTitle: false,
    defaultConfig: { maxChunkSize: 1000, minChunkSize: 100, overlap: 50 },
    fallbackStrategies: [ChunkingStrategy.H1],
  },
};

/**
 * Utility functions for working with chunking strategies
 */
export class ChunkingStrategyUtils {
  /**
   * Get all strategies in a category
   */
  static getStrategiesByCategory(category: ChunkingStrategyCategory): ChunkingStrategy[] {
    return (Object.values(ChunkingStrategy) as ChunkingStrategy[]).filter(
      strategy => CHUNKING_STRATEGY_REGISTRY[strategy]?.category === category
    );
  }
  
  /**
   * Get implemented strategies only
   */
  static getImplementedStrategies(): ChunkingStrategy[] {
    return (Object.values(ChunkingStrategy) as ChunkingStrategy[]).filter(
      strategy => CHUNKING_STRATEGY_REGISTRY[strategy]?.isImplemented
    );
  }
  
  /**
   * Get fallback strategies for a given strategy
   */
  static getFallbackStrategies(strategy: ChunkingStrategy): ChunkingStrategy[] {
    return CHUNKING_STRATEGY_REGISTRY[strategy]?.fallbackStrategies || [];
  }
  
  /**
   * Check if a strategy requires titles
   */
  static requiresTitle(strategy: ChunkingStrategy): boolean {
    return CHUNKING_STRATEGY_REGISTRY[strategy]?.requiresTitle || false;
  }
  
  /**
   * Get default config for a strategy
   */
  static getDefaultConfig(strategy: ChunkingStrategy): ChunkingConfig {
    return CHUNKING_STRATEGY_REGISTRY[strategy]?.defaultConfig || {};
  }
  
  /**
   * Get metadata for a strategy
   */
  static getMetadata(strategy: ChunkingStrategy): ChunkingStrategyMetadata | null {
    return CHUNKING_STRATEGY_REGISTRY[strategy] || null;
  }
  
  /**
   * Convert legacy string to enum value
   */
  static fromString(strategyName: string): ChunkingStrategy {
    // Handle legacy values
    if (strategyName === 'h1') return ChunkingStrategy.H1;
    if (strategyName === 'paragraph') return ChunkingStrategy.PARAGRAPH;
    
    // Try direct match
    const upperStrategy = strategyName.toUpperCase() as ChunkingStrategy;
    if ((Object.values(ChunkingStrategy) as ChunkingStrategy[]).includes(upperStrategy)) {
      return upperStrategy;
    }
    
    // Default to AUTO for unknown strategies
    return ChunkingStrategy.AUTO;
  }
  
  /**
   * Convert enum to string (for backward compatibility)
   */
  static toString(strategy: ChunkingStrategy): string {
    return strategy;
  }
  
  /**
   * Check if a strategy is implemented
   */
  static isImplemented(strategy: ChunkingStrategy): boolean {
    return CHUNKING_STRATEGY_REGISTRY[strategy]?.isImplemented || false;
  }
  
  /**
   * Get all available strategies (implemented only)
   */
  static getAvailableStrategies(): ChunkingStrategy[] {
    return this.getImplementedStrategies();
  }
}

/**
 * Conversion utilities for backward compatibility
 */
export class ChunkingStrategyCompatibility {
  /**
   * Convert legacy ChunkingStrategyType to new ChunkingStrategy
   */
  static fromLegacy(legacyType: ChunkingStrategyType): ChunkingStrategy {
    switch (legacyType) {
      case ChunkingStrategyType.H1:
        return ChunkingStrategy.H1;
      case ChunkingStrategyType.PARAGRAPH:
        return ChunkingStrategy.PARAGRAPH;
      default:
        return ChunkingStrategy.LEGACY;
    }
  }
  
  /**
   * Convert new ChunkingStrategy to legacy ChunkingStrategyType
   * Returns null if strategy doesn't have a legacy equivalent
   */
  static toLegacy(strategy: ChunkingStrategy): ChunkingStrategyType | null {
    switch (strategy) {
      case ChunkingStrategy.H1:
        return ChunkingStrategyType.H1;
      case ChunkingStrategy.PARAGRAPH:
        return ChunkingStrategyType.PARAGRAPH;
      default:
        return null;
    }
  }
  
  /**
   * Check if a strategy has a legacy equivalent
   */
  static hasLegacyEquivalent(strategy: ChunkingStrategy): boolean {
    return this.toLegacy(strategy) !== null;
  }
  
  /**
   * Convert string to appropriate enum (legacy or new)
   */
  static fromString(strategyName: string): ChunkingStrategy {
    // First try legacy enum
    const legacyValue = Object.values(ChunkingStrategyType).find(v => v === strategyName);
    if (legacyValue) {
      return this.fromLegacy(legacyValue as ChunkingStrategyType);
    }
    
    // Then try new enum
    return ChunkingStrategyUtils.fromString(strategyName);
  }
}
