import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('MarkdownPartCache');

/**
 * Markdown部分信息接口
 */
export interface MarkdownPartInfo {
  itemId: string;
  partIndex: number;
  content: string;
  status: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Markdown缓存错误类
 */
export class MarkdownPartCacheError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'MarkdownPartCacheError';
  }
}

/**
 * Markdown部分缓存抽象类
 * 提供用于存储和检索PDF部分的markdown内容的接口
 */
export abstract class MarkdownPartCache {
  /**
   * 初始化缓存
   */
  abstract initialize(): Promise<void>;

  /**
   * 存储部分markdown内容
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @param markdownContent markdown内容
   */
  abstract storePartMarkdown(itemId: string, partIndex: number, markdownContent: string): Promise<void>;

  /**
   * 获取特定部分的markdown内容
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @returns markdown内容或null（如果不存在）
   */
  abstract getPartMarkdown(itemId: string, partIndex: number): Promise<string | null>;

  /**
   * Get all parts of target pdf markdown cache
   * @param itemId 项目ID
   * @returns 部分信息数组
   */
  abstract getAllParts(itemId: string): Promise<Array<{partIndex: number, content: string, status?: string}>>;

  /**
   * 合并所有部分为完整的markdown
   * @param itemId 项目ID
   * @returns 合并后的markdown内容
   */
  async mergeAllParts(itemId: string): Promise<string> {
    try {
      logger.debug(`[DEBUG] mergeAllParts called for itemId=${itemId}`);
      logger.info(`开始合并项目 ${itemId} 的所有markdown部分`, { itemId });
      
      logger.debug(`[DEBUG] About to call getAllParts in mergeAllParts for itemId=${itemId}`);
      const parts = await this.getAllParts(itemId);
      logger.debug(`[DEBUG] getAllParts in mergeAllParts returned ${parts.length} parts for itemId=${itemId}`);
      
      if (parts.length === 0) {
        logger.debug(`[DEBUG] No parts available for merging for itemId=${itemId}`);
        throw new MarkdownPartCacheError(
          `项目 ${itemId} 没有可用的markdown部分`,
          'NO_PARTS_AVAILABLE',
          { itemId }
        );
      }

      // 按部分索引排序
      parts.sort((a, b) => a.partIndex - b.partIndex);
      logger.debug(`[DEBUG] Parts sorted for itemId=${itemId}`);
      
      // 合并所有部分
      logger.debug(`[DEBUG] About to merge content for ${parts.length} parts of itemId=${itemId}`);
      const mergedContent = parts.map(part => part.content).join('\n\n');
      logger.debug(`[DEBUG] Content merged for itemId=${itemId}, length: ${mergedContent.length}`);
      
      logger.info(`成功合并项目 ${itemId} 的 ${parts.length} 个markdown部分`, {
        itemId,
        partsCount: parts.length,
        contentLength: mergedContent.length
      });
      
      return mergedContent;
    } catch (error) {
      logger.debug(`[DEBUG] mergeAllParts failed for itemId=${itemId}:`, error);
      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }
      
      logger.error(`合并项目 ${itemId} 的markdown部分时发生错误`, {
        itemId,
        error: error.message,
        stack: error.stack
      });
      
      throw new MarkdownPartCacheError(
        `合并markdown部分失败: ${error.message}`,
        'MERGE_FAILED',
        { itemId, originalError: error }
      );
    }
  }

  /**
   * 更新部分状态
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @param status 新状态
   */
  abstract updatePartStatus(itemId: string, partIndex: number, status: string): Promise<void>;

  /**
   * 获取部分状态
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @returns 状态或null（如果不存在）
   */
  abstract getPartStatus(itemId: string, partIndex: number): Promise<string | null>;

  /**
   * 清理特定项目的缓存
   * @param itemId 项目ID
   */
  abstract cleanup(itemId: string): Promise<void>;

  /**
   * 验证项目ID
   * @param itemId 项目ID
   * @throws 如果项目ID无效
   */
  protected validateItemId(itemId: string): void {
    if (!itemId || typeof itemId !== 'string' || itemId.trim().length === 0) {
      throw new MarkdownPartCacheError(
        '项目ID不能为空',
        'INVALID_ITEM_ID',
        { itemId }
      );
    }
  }

  /**
   * 验证部分索引
   * @param partIndex 部分索引
   * @throws 如果部分索引无效
   */
  protected validatePartIndex(partIndex: number): void {
    if (!Number.isInteger(partIndex) || partIndex < 0) {
      throw new MarkdownPartCacheError(
        '部分索引必须是非负整数',
        'INVALID_PART_INDEX',
        { partIndex }
      );
    }
  }

  /**
   * 验证markdown内容
   * @param content markdown内容
   * @throws 如果内容无效
   */
  protected validateMarkdownContent(content: string): void {
    if (typeof content !== 'string') {
      throw new MarkdownPartCacheError(
        'markdown内容必须是字符串',
        'INVALID_CONTENT_TYPE',
        { contentType: typeof content }
      );
    }
  }

  /**
   * 验证状态
   * @param status 状态
   * @throws 如果状态无效
   */
  protected validateStatus(status: string): void {
    if (!status || typeof status !== 'string' || status.trim().length === 0) {
      throw new MarkdownPartCacheError(
        '状态不能为空',
        'INVALID_STATUS',
        { status }
      );
    }
  }

  /**
   * 记录操作开始
   * @param operation 操作名称
   * @param itemId 项目ID
   * @param partIndex 部分索引（可选）
   */
  protected logOperationStart(operation: string, itemId: string, partIndex?: number): void {
    const logData: any = { itemId, operation };
    if (partIndex !== undefined) {
      logData.partIndex = partIndex;
    }
    logger.debug(`开始执行操作: ${operation}`, logData);
  }

  /**
   * 记录操作成功
   * @param operation 操作名称
   * @param itemId 项目ID
   * @param partIndex 部分索引（可选）
   * @param additionalData 额外数据（可选）
   */
  protected logOperationSuccess(
    operation: string, 
    itemId: string, 
    partIndex?: number, 
    additionalData?: any
  ): void {
    const logData: any = { itemId, operation };
    if (partIndex !== undefined) {
      logData.partIndex = partIndex;
    }
    if (additionalData) {
      Object.assign(logData, additionalData);
    }
    logger.debug(`操作成功: ${operation}`, logData);
  }

  /**
   * 记录操作错误
   * @param operation 操作名称
   * @param error 错误对象
   * @param itemId 项目ID
   * @param partIndex 部分索引（可选）
   */
  protected logOperationError(
    operation: string, 
    error: Error, 
    itemId: string, 
    partIndex?: number
  ): void {
    const logData: any = { 
      itemId, 
      operation, 
      error: error.message,
      stack: error.stack
    };
    if (partIndex !== undefined) {
      logData.partIndex = partIndex;
    }
    logger.error(`操作失败: ${operation}`, logData);
  }
}