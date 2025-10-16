import {
  ChunkingStrategy,
  ChunkingConfig,
  ChunkResult,
} from './chunkingStrategy';
import { H1ChunkingStrategy } from './strategies/h1ChunkingStrategy';
import { ParagraphChunkingStrategy } from './strategies/paragraphChunkingStrategy';

/**
 * Chunking策略管理器
 * 负责注册、管理和选择合适的chunking策略
 */
export class ChunkingManager {
  private strategies: Map<string, ChunkingStrategy> = new Map();
  private defaultStrategy: string = 'h1';

  constructor() {
    // 注册默认策略
    this.registerStrategy(new H1ChunkingStrategy());
    this.registerStrategy(new ParagraphChunkingStrategy());
  }

  /**
   * 注册一个新的chunking策略
   */
  registerStrategy(strategy: ChunkingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * 获取所有已注册的策略
   */
  getAvailableStrategies(): ChunkingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 根据名称获取策略
   */
  getStrategy(name: string): ChunkingStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * 设置默认策略
   */
  setDefaultStrategy(strategyName: string): void {
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' is not registered`);
    }
    this.defaultStrategy = strategyName;
  }

  /**
   * 获取默认策略名称
   */
  getDefaultStrategyName(): string {
    return this.defaultStrategy;
  }

  /**
   * 自动选择最适合的策略
   * 根据文本内容自动选择最合适的chunking策略
   */
  autoSelectStrategy(text: string): ChunkingStrategy {
    // 按优先级检查策略
    const strategyPriority = ['h1', 'paragraph'];

    for (const strategyName of strategyPriority) {
      const strategy = this.strategies.get(strategyName);
      if (strategy && strategy.canHandle(text)) {
        return strategy;
      }
    }

    // 如果没有策略能处理，返回默认策略
    const defaultStrategy = this.strategies.get(this.defaultStrategy);
    if (!defaultStrategy) {
      throw new Error(
        'No suitable chunking strategy found and no default strategy available',
      );
    }

    return defaultStrategy;
  }

  /**
   * 使用指定策略进行文本切片
   */
  chunkWithStrategy(
    text: string,
    strategyName?: string,
    config?: ChunkingConfig,
  ): ChunkResult[] {
    let strategy: ChunkingStrategy;

    if (strategyName) {
      const foundStrategy = this.getStrategy(strategyName);
      if (!foundStrategy) {
        throw new Error(`Unsupported chunking strategy: ${strategyName}`);
      }
      strategy = foundStrategy;
    } else {
      strategy = this.autoSelectStrategy(text);
    }

    // 验证配置
    const finalConfig = { ...strategy.getDefaultConfig(), ...config };
    const validation = strategy.validateConfig(finalConfig);

    if (!validation.valid) {
      throw new Error(
        `Invalid chunking configuration: ${validation.errors.join(', ')}`,
      );
    }

    return strategy.chunk(text, finalConfig);
  }

  /**
   * 获取策略的默认配置
   */
  getStrategyDefaultConfig(strategyName: string): ChunkingConfig {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) {
      throw new Error(`Chunking strategy '${strategyName}' not found`);
    }

    return strategy.getDefaultConfig();
  }

  /**
   * 验证策略配置
   */
  validateStrategyConfig(
    strategyName: string,
    config: ChunkingConfig,
  ): { valid: boolean; errors: string[] } {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) {
      return {
        valid: false,
        errors: [`Chunking strategy '${strategyName}' not found`],
      };
    }

    return strategy.validateConfig(config);
  }

  /**
   * 检查策略是否可以处理指定文本
   */
  canStrategyHandle(strategyName: string, text: string): boolean {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) {
      return false;
    }

    return strategy.canHandle(text);
  }

  /**
   * 获取策略信息
   */
  getStrategyInfo(strategyName: string): {
    name: string;
    description: string;
    version: string;
    canHandle: boolean;
    defaultConfig: ChunkingConfig;
  } | null {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) {
      return null;
    }

    return {
      name: strategy.name,
      description: strategy.description,
      version: strategy.version,
      canHandle: strategy.canHandle.bind(strategy), // 绑定this上下文
      defaultConfig: strategy.getDefaultConfig(),
    };
  }

  /**
   * 列出所有可以处理指定文本的策略
   */
  getStrategiesForText(text: string): ChunkingStrategy[] {
    return this.getAvailableStrategies().filter((strategy) =>
      strategy.canHandle(text),
    );
  }
}

// 导出单例实例
export const chunkingManager = new ChunkingManager();
