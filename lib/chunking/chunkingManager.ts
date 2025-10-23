import {
  IChunkingStrategy,
  ChunkingStrategy,
  ChunkingConfig,
  ChunkResult,
  ChunkingStrategyUtils,
  ChunkingStrategyCompatibility,
  ChunkingStrategyType,
} from './chunkingStrategy';
import { H1ChunkingStrategy } from './strategies/h1ChunkingStrategy';
import { ParagraphChunkingStrategy } from './strategies/paragraphChunkingStrategy';

/**
 * Chunking策略管理器
 * 负责注册、管理和选择合适的chunking策略
 */
export class ChunkingManager {
  private strategies: Map<string, IChunkingStrategy> = new Map();
  private defaultStrategy: ChunkingStrategy = ChunkingStrategy.H1;

  constructor() {
    // 注册默认策略
    this.registerStrategy(new H1ChunkingStrategy());
    this.registerStrategy(new ParagraphChunkingStrategy());
  }

  /**
   * 注册一个新的chunking策略
   */
  registerStrategy(strategy: IChunkingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * 获取所有已注册的策略
   */
  getAvailableStrategies(): IChunkingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * 根据名称获取策略
   */
  getStrategy(name: string): IChunkingStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * 根据枚举获取策略
   */
  getStrategyByEnum(
    strategyEnum: ChunkingStrategy,
  ): IChunkingStrategy | undefined {
    return this.strategies.get(strategyEnum);
  }

  /**
   * 设置默认策略
   */
  setDefaultStrategy(strategyName: string): void {
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' is not registered`);
    }
    this.defaultStrategy = ChunkingStrategyUtils.fromString(strategyName);
  }

  /**
   * 设置默认策略（使用枚举）
   */
  setDefaultStrategyByEnum(strategyEnum: ChunkingStrategy): void {
    if (!this.strategies.has(strategyEnum)) {
      throw new Error(`Strategy '${strategyEnum}' is not registered`);
    }
    this.defaultStrategy = strategyEnum;
  }

  /**
   * 获取默认策略名称
   */
  getDefaultStrategyName(): string {
    return this.defaultStrategy;
  }

  /**
   * 获取默认策略枚举
   */
  getDefaultStrategyEnum(): ChunkingStrategy {
    return this.defaultStrategy;
  }

  /**
   * 自动选择最适合的策略
   * 根据文本内容自动选择最合适的chunking策略
   */
  autoSelectStrategy(text: string): IChunkingStrategy {
    // 使用策略注册表中的优先级
    const implementedStrategies =
      ChunkingStrategyUtils.getImplementedStrategies();

    // 按优先级检查策略
    for (const strategyEnum of implementedStrategies) {
      const strategy = this.strategies.get(strategyEnum);
      if (strategy && strategy.canHandle(text)) {
        return strategy;
      }
    }

    // 如果没有策略能处理，尝试使用回退策略
    for (const strategyEnum of implementedStrategies) {
      const strategy = this.strategies.get(strategyEnum);
      if (strategy) {
        return strategy;
      }
    }

    // 如果仍然没有找到，抛出错误
    throw new Error(
      'No suitable chunking strategy found and no default strategy available',
    );
  }

  /**
   * 使用回退策略自动选择
   */
  autoSelectStrategyWithFallback(
    text: string,
    preferredStrategy?: ChunkingStrategy,
  ): IChunkingStrategy {
    // 如果指定了首选策略，先尝试使用它
    if (preferredStrategy) {
      const strategy = this.strategies.get(preferredStrategy);
      if (strategy && strategy.canHandle(text)) {
        return strategy;
      }

      // 尝试使用回退策略
      const fallbackStrategies =
        ChunkingStrategyUtils.getFallbackStrategies(preferredStrategy);
      for (const fallbackEnum of fallbackStrategies) {
        const fallbackStrategy = this.strategies.get(fallbackEnum);
        if (fallbackStrategy && fallbackStrategy.canHandle(text)) {
          return fallbackStrategy;
        }
      }
    }

    // 使用默认自动选择
    return this.autoSelectStrategy(text);
  }

  /**
   * 使用指定策略进行文本切片
   */
  chunkWithStrategy(
    text: string,
    strategyName?: string,
    config?: ChunkingConfig,
  ): ChunkResult[] {
    let strategy: IChunkingStrategy;

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
   * 使用枚举策略进行文本切片
   */
  chunkWithStrategyEnum(
    text: string,
    strategyEnum?: ChunkingStrategy,
    config?: ChunkingConfig,
  ): ChunkResult[] {
    let strategy: IChunkingStrategy;

    if (strategyEnum) {
      const foundStrategy = this.getStrategyByEnum(strategyEnum);
      if (!foundStrategy) {
        throw new Error(`Unsupported chunking strategy: ${strategyEnum}`);
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
  getStrategiesForText(text: string): IChunkingStrategy[] {
    return this.getAvailableStrategies().filter((strategy) =>
      strategy.canHandle(text),
    );
  }

  /**
   * 获取可以处理指定文本的策略枚举列表
   */
  getStrategyEnumsForText(text: string): ChunkingStrategy[] {
    return this.getStrategiesForText(text)
      .map((strategy) => ChunkingStrategyUtils.fromString(strategy.name))
      .filter((strategy) => strategy !== ChunkingStrategy.AUTO);
  }

  /**
   * 检查策略是否已实现
   */
  isStrategyImplemented(strategyEnum: ChunkingStrategy): boolean {
    return (
      ChunkingStrategyUtils.isImplemented(strategyEnum) &&
      this.strategies.has(strategyEnum)
    );
  }

  /**
   * 获取策略元数据
   */
  getStrategyMetadata(strategyEnum: ChunkingStrategy): any {
    return ChunkingStrategyUtils.getMetadata(strategyEnum);
  }

  /**
   * 兼容性方法：处理旧版枚举
   */
  chunkWithLegacyStrategy(
    text: string,
    legacyStrategy: ChunkingStrategyType,
    config?: ChunkingConfig,
  ): ChunkResult[] {
    const newStrategy =
      ChunkingStrategyCompatibility.fromLegacy(legacyStrategy);
    return this.chunkWithStrategyEnum(text, newStrategy, config);
  }
}

// 导出单例实例
export const chunkingManager = new ChunkingManager();
