/**
 * 统一的文本切片策略接口
 * 定义了所有chunking策略必须实现的标准接口
 */

/**
 * 基础的chunk结果接口
 */
export interface BaseChunkResult {
  content: string;  // 切片内容
  index: number;    // 切片在文档中的索引位置
}

/**
 * 带标题的chunk结果接口（用于基于标题的切片）
 */
export interface TitledChunkResult extends BaseChunkResult {
  title: string;    // 切片标题
}

/**
 * 统一的chunk结果类型，可以是带标题的或不带标题的
 */
export type ChunkResult = BaseChunkResult | TitledChunkResult;

/**
 * 切片策略配置接口
 */
export interface ChunkingConfig {
  maxChunkSize?: number;     // 最大切片大小（字符数）
  minChunkSize?: number;     // 最小切片大小（字符数）
  overlap?: number;          // 切片之间的重叠字符数
  strategy?: string;         // 策略特定参数
}

/**
 * 文本切片策略的基础接口
 * 所有切片策略都必须实现此接口
 */
export interface ChunkingStrategy {
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
export abstract class BaseChunkingStrategy implements ChunkingStrategy {
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
    
    if (config.maxChunkSize !== undefined && config.minChunkSize !== undefined) {
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
      errors
    };
  }

  /**
   * 检查结果是否为带标题的chunk
   */
  protected isTitledChunk(chunk: ChunkResult): chunk is TitledChunkResult {
    return 'title' in chunk;
  }
}