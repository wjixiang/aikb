import { chunkingManager } from './chunking-manager.js';
import {
  ChunkingConfig as BaseChunkingConfig,
  ChunkResult as BaseChunkResult,
  ChunkingStrategyType,
  ChunkingStrategy,
  ChunkingStrategyCategory,
  IChunkingStrategy,
  ChunkingStrategyUtils,
  ChunkingStrategyCompatibility,
} from './chunking-strategy.js';

/**
 * 统一的文本切片工具 V2
 * 提供向后兼容的API，同时支持新的策略系统
 */

// 重新导出类型以保持向后兼容
export interface ChunkResult {
  title?: string; // 可选标题，用于向后兼容
  content: string;
  index: number;
}

// 内部使用的配置类型
export type ChunkingConfig = BaseChunkingConfig;

/**
 * 基于H1标题将文本切分为多个块（向后兼容函数）
 * @param text markdown格式的文本，所有大纲均为H1
 * @returns 切分后的文本块数组
 */
export function h1Chunking(text: string): ChunkResult[] {
  const results = chunkingManager.chunkWithStrategy(text, 'h1');
  return results.map((result) => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index,
  }));
}

/**
 * 基于段落的文本切片功能（向后兼容函数）
 * @param text 输入文本
 * @returns 切分后的段落数组
 */
export function paragraphChunking(text: string): string[] {
  const results = chunkingManager.chunkWithStrategy(text, 'paragraph');
  return results.map((result) => result.content);
}

/**
 * 通用文本切片函数（向后兼容函数）
 * @param text 输入文本
 * @param strategy 切片策略：'h1' 或 'paragraph'
 * @param config 可选的切片配置
 * @returns 切分结果
 */
export function chunkText(
  text: string,
  strategy: ChunkingStrategyType = ChunkingStrategyType.H1,
  config?: ChunkingConfig,
): ChunkResult[] | string[] {
  // 转换为新的枚举系统
  const newStrategy = ChunkingStrategyCompatibility.fromLegacy(strategy);
  const results = chunkingManager.chunkWithStrategyEnum(
    text,
    newStrategy,
    config,
  );

  if (strategy === ChunkingStrategyType.PARAGRAPH) {
    // 对于段落策略，返回字符串数组以保持向后兼容
    return results.map((result) => result.content);
  } else {
    // 对于H1策略，返回ChunkResult数组
    return results.map((result) => ({
      title: 'title' in result ? result.title : undefined,
      content: result.content,
      index: result.index,
    }));
  }
}

/**
 * 增强的文本切片函数，支持新的枚举和旧枚举
 * @param text 输入文本
 * @param strategy 切片策略（支持新枚举、旧枚举或字符串）
 * @param config 可选的切片配置
 * @returns 切分结果
 */
export function chunkTextEnhanced(
  text: string,
  strategy?: ChunkingStrategy | ChunkingStrategyType | string,
  config?: ChunkingConfig,
): ChunkResult[] {
  let normalizedStrategy: ChunkingStrategy;

  if (!strategy) {
    // 自动选择策略
    const selectedStrategy = chunkingManager.autoSelectStrategy(text);
    normalizedStrategy = ChunkingStrategyUtils.fromString(
      selectedStrategy.name,
    );
  } else if (typeof strategy === 'string') {
    // 处理字符串
    normalizedStrategy = ChunkingStrategyCompatibility.fromString(strategy);
  } else if (
    Object.values(ChunkingStrategyType).includes(
      strategy as ChunkingStrategyType,
    )
  ) {
    // 处理旧枚举
    normalizedStrategy = ChunkingStrategyCompatibility.fromLegacy(
      strategy as ChunkingStrategyType,
    );
  } else {
    // 处理新枚举
    normalizedStrategy = strategy as ChunkingStrategy;
  }

  const results = chunkingManager.chunkWithStrategyEnum(
    text,
    normalizedStrategy,
    config,
  );

  // 统一返回ChunkResult数组
  return results.map((result) => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index,
  }));
}

/**
 * 新的统一切片函数，推荐使用
 * @param text 输入文本
 * @param strategyName 策略名称，如果不指定则自动选择
 * @param config 切片配置
 * @returns 切分结果
 */
export function chunkTextAdvanced(
  text: string,
  strategyName?: string,
  config?: ChunkingConfig,
): ChunkResult[] {
  const results = chunkingManager.chunkWithStrategy(text, strategyName, config);
  return results.map((result) => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index,
  }));
}

/**
 * 使用新枚举的切片函数（推荐）
 * @param text 输入文本
 * @param strategy 策略枚举，如果不指定则自动选择
 * @param config 切片配置
 * @returns 切分结果
 */
export function chunkTextWithEnum(
  text: string,
  strategy?: ChunkingStrategy,
  config?: ChunkingConfig,
): ChunkResult[] {
  const results = chunkingManager.chunkWithStrategyEnum(text, strategy, config);
  return results.map((result) => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index,
  }));
}

/**
 * 使用回退策略的切片函数
 * @param text 输入文本
 * @param preferredStrategy 首选策略
 * @param config 切片配置
 * @returns 切分结果
 */
export function chunkTextWithFallback(
  text: string,
  preferredStrategy?: ChunkingStrategy,
  config?: ChunkingConfig,
): ChunkResult[] {
  const strategy = chunkingManager.autoSelectStrategyWithFallback(
    text,
    preferredStrategy,
  );
  const results = strategy.chunk(text, {
    ...strategy.getDefaultConfig(),
    ...config,
  });
  return results.map((result) => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index,
  }));
}

/**
 * 获取可用的切片策略列表
 * @deprecated
 */
export function getAvailableStrategies(): Array<{
  name: string;
  description: string;
  version: string;
}> {
  return chunkingManager.getAvailableStrategies().map((strategy) => ({
    name: strategy.name,
    description: strategy.description,
    version: strategy.version,
  }));
}

/**
 * 获取可用的策略枚举列表
 */
export function getAvailableStrategyEnums(): ChunkingStrategy[] {
  return ChunkingStrategyUtils.getImplementedStrategies();
}

/**
 * 获取指定类别的策略
 */
export function getStrategiesByCategory(
  category: ChunkingStrategyCategory,
): ChunkingStrategy[] {
  return ChunkingStrategyUtils.getStrategiesByCategory(category);
}

/**
 * 自动选择最适合的切片策略
 * @param text 输入文本
 * @returns 选择的策略名称
 */
export function autoSelectStrategy(text: string): string {
  const strategy = chunkingManager.autoSelectStrategy(text);
  return strategy.name;
}

/**
 * 自动选择最适合的切片策略（返回枚举）
 * @param text 输入文本
 * @returns 选择的策略枚举
 */
export function autoSelectStrategyEnum(text: string): ChunkingStrategy {
  const strategy = chunkingManager.autoSelectStrategy(text);
  return ChunkingStrategyUtils.fromString(strategy.name);
}

/**
 * 检查指定策略是否可以处理文本
 * @param strategyName 策略名称
 * @param text 输入文本
 * @returns 是否可以处理
 */
export function canStrategyHandle(strategyName: string, text: string): boolean {
  return chunkingManager.canStrategyHandle(strategyName, text);
}

/**
 * 检查指定枚举策略是否可以处理文本
 */
export function canStrategyEnumHandle(
  strategyEnum: ChunkingStrategy,
  text: string,
): boolean {
  const strategy = chunkingManager.getStrategyByEnum(strategyEnum);
  return strategy ? strategy.canHandle(text) : false;
}

/**
 * 获取策略的默认配置
 * @param strategyName 策略名称
 * @returns 默认配置
 */
export function getStrategyDefaultConfig(strategyName: string): ChunkingConfig {
  return chunkingManager.getStrategyDefaultConfig(strategyName);
}

/**
 * 获取枚举策略的默认配置
 */
export function getStrategyEnumDefaultConfig(
  strategyEnum: ChunkingStrategy,
): ChunkingConfig {
  return ChunkingStrategyUtils.getDefaultConfig(strategyEnum);
}

/**
 * 验证策略配置
 * @param strategyName 策略名称
 * @param config 配置对象
 * @returns 验证结果
 */
export function validateStrategyConfig(
  strategyName: string,
  config: ChunkingConfig,
): { valid: boolean; errors: string[] } {
  return chunkingManager.validateStrategyConfig(strategyName, config);
}

/**
 * 验证枚举策略配置
 */
export function validateStrategyEnumConfig(
  strategyEnum: ChunkingStrategy,
  config: ChunkingConfig,
): { valid: boolean; errors: string[] } {
  const strategy = chunkingManager.getStrategyByEnum(strategyEnum);
  if (!strategy) {
    return {
      valid: false,
      errors: [`Strategy '${strategyEnum}' is not registered`],
    };
  }
  return strategy.validateConfig(config);
}

/**
 * 获取可以处理指定文本的所有策略
 * @param text 输入文本
 * @returns 策略名称列表
 */
export function getStrategiesForText(text: string): string[] {
  return chunkingManager
    .getStrategiesForText(text)
    .map((strategy) => strategy.name);
}

/**
 * 获取可以处理指定文本的所有策略枚举
 */
export function getStrategyEnumsForText(text: string): ChunkingStrategy[] {
  return chunkingManager.getStrategyEnumsForText(text);
}

/**
 * 获取策略元数据
 */
export function getStrategyMetadata(strategyEnum: ChunkingStrategy): any {
  return chunkingManager.getStrategyMetadata(strategyEnum);
}

/**
 * 检查策略是否已实现
 */
export function isStrategyImplemented(strategyEnum: ChunkingStrategy): boolean {
  return chunkingManager.isStrategyImplemented(strategyEnum);
}

/**
 * 获取策略的回退策略
 */
export function getFallbackStrategies(
  strategyEnum: ChunkingStrategy,
): ChunkingStrategy[] {
  return ChunkingStrategyUtils.getFallbackStrategies(strategyEnum);
}

/**
 * 检查策略是否需要标题
 */
export function requiresTitle(strategyEnum: ChunkingStrategy): boolean {
  return ChunkingStrategyUtils.requiresTitle(strategyEnum);
}

// 导出chunkingManager实例，供高级用户使用
export { chunkingManager };

// 导出类型定义
export type {
  BaseChunkingStrategy,
  TitledChunkResult,
  IChunkingStrategy,
} from './chunking-strategy.js';

// 导出新的枚举和工具类
export {
  ChunkingStrategy,
  ChunkingStrategyCategory,
  ChunkingStrategyType,
  ChunkingStrategyUtils,
  ChunkingStrategyCompatibility,
  CHUNKING_STRATEGY_REGISTRY,
} from './chunking-strategy.js';

// 向后兼容的适配器类
export class ChunkingAdapter {
  /**
   * 适配旧版chunkText函数到新系统
   */
  static chunkText(
    text: string,
    strategy: ChunkingStrategy | ChunkingStrategyType = ChunkingStrategy.H1,
    config?: ChunkingConfig,
  ): ChunkResult[] | string[] {
    // 如果是旧枚举，先转换
    const normalizedStrategy = Object.values(ChunkingStrategyType).includes(
      strategy as ChunkingStrategyType,
    )
      ? ChunkingStrategyCompatibility.fromLegacy(
          strategy as ChunkingStrategyType,
        )
      : (strategy as ChunkingStrategy);

    const results = chunkingManager.chunkWithStrategyEnum(
      text,
      normalizedStrategy,
      config,
    );

    // 保持旧版返回格式
    if (strategy === ChunkingStrategyType.PARAGRAPH) {
      return results.map((result) => result.content);
    } else {
      return results.map((result) => ({
        title: 'title' in result ? result.title : undefined,
        content: result.content,
        index: result.index,
      }));
    }
  }

  /**
   * 适配策略验证
   */
  static validateStrategyConfig(
    strategy: ChunkingStrategy | ChunkingStrategyType,
    config: ChunkingConfig,
  ): { valid: boolean; errors: string[] } {
    const normalizedStrategy = Object.values(ChunkingStrategyType).includes(
      strategy as ChunkingStrategyType,
    )
      ? ChunkingStrategyCompatibility.fromLegacy(
          strategy as ChunkingStrategyType,
        )
      : (strategy as ChunkingStrategy);

    return validateStrategyEnumConfig(normalizedStrategy, config);
  }
}

/**
 * @deprecated 使用 chunkTextEnhanced 或 chunkTextWithEnum 替代
 * 保留此函数仅用于向后兼容
 */
export function chunkTextLegacy(
  text: string,
  strategy: ChunkingStrategyType = ChunkingStrategyType.H1,
  config?: ChunkingConfig,
): ChunkResult[] | string[] {
  console.warn(
    'chunkTextLegacy is deprecated. Please use chunkTextEnhanced or chunkTextWithEnum instead.',
  );
  return chunkText(text, strategy, config);
}
