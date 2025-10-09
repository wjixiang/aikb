import { chunkingManager } from './chunkingManager';
import { ChunkingConfig as BaseChunkingConfig, ChunkResult as BaseChunkResult } from './chunkingStrategy';

/**
 * 统一的文本切片工具 V2
 * 提供向后兼容的API，同时支持新的策略系统
 */

// 重新导出类型以保持向后兼容
export interface ChunkResult {
  title?: string;  // 可选标题，用于向后兼容
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
  return results.map(result => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index
  }));
}

/**
 * 基于段落的文本切片功能（向后兼容函数）
 * @param text 输入文本
 * @returns 切分后的段落数组
 */
export function paragraphChunking(text: string): string[] {
  const results = chunkingManager.chunkWithStrategy(text, 'paragraph');
  return results.map(result => result.content);
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
  strategy: 'h1' | 'paragraph' = 'h1',
  config?: ChunkingConfig
): ChunkResult[] | string[] {
  const results = chunkingManager.chunkWithStrategy(text, strategy, config);
  
  if (strategy === 'paragraph') {
    // 对于段落策略，返回字符串数组以保持向后兼容
    return results.map(result => result.content);
  } else {
    // 对于H1策略，返回ChunkResult数组
    return results.map(result => ({
      title: 'title' in result ? result.title : undefined,
      content: result.content,
      index: result.index
    }));
  }
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
  config?: ChunkingConfig
): ChunkResult[] {
  const results = chunkingManager.chunkWithStrategy(text, strategyName, config);
  return results.map(result => ({
    title: 'title' in result ? result.title : undefined,
    content: result.content,
    index: result.index
  }));
}

/**
 * 获取可用的切片策略列表
 */
export function getAvailableStrategies(): Array<{
  name: string;
  description: string;
  version: string;
}> {
  return chunkingManager.getAvailableStrategies().map(strategy => ({
    name: strategy.name,
    description: strategy.description,
    version: strategy.version
  }));
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
 * 检查指定策略是否可以处理文本
 * @param strategyName 策略名称
 * @param text 输入文本
 * @returns 是否可以处理
 */
export function canStrategyHandle(strategyName: string, text: string): boolean {
  return chunkingManager.canStrategyHandle(strategyName, text);
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
 * 验证策略配置
 * @param strategyName 策略名称
 * @param config 配置对象
 * @returns 验证结果
 */
export function validateStrategyConfig(
  strategyName: string,
  config: ChunkingConfig
): { valid: boolean; errors: string[] } {
  return chunkingManager.validateStrategyConfig(strategyName, config);
}

/**
 * 获取可以处理指定文本的所有策略
 * @param text 输入文本
 * @returns 策略名称列表
 */
export function getStrategiesForText(text: string): string[] {
  return chunkingManager.getStrategiesForText(text).map(strategy => strategy.name);
}

// 导出chunkingManager实例，供高级用户使用
export { chunkingManager };

// 导出类型定义
export type { BaseChunkingStrategy, TitledChunkResult } from './chunkingStrategy';