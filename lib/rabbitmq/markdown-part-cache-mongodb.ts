import { Collection, Db, ObjectId } from 'mongodb';
import { connectToDatabase } from '../mongodb';
import {
  MarkdownPartCache,
  MarkdownPartCacheError,
  MarkdownPartInfo,
} from './markdown-part-cache';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('MongoDBMarkdownPartCache');

/**
 * MongoDB版本的Markdown部分缓存实现
 */
export class MongoDBMarkdownPartCache extends MarkdownPartCache {
  private db: Db | null = null;
  private partsCollection: Collection | null = null;
  private metadataCollection: Collection | null = null;
  private isInitialized = false;

  /**
   * 集合名称
   */
  private static readonly PARTS_COLLECTION = 'pdf_markdown_parts';
  private static readonly METADATA_COLLECTION = 'pdf_markdown_metadata';

  /**
   * 初始化缓存
   */
  async initialize(): Promise<void> {
    try {
      this.logOperationStart('initialize', 'system');

      if (this.isInitialized) {
        this.logOperationSuccess('initialize', 'system');
        return;
      }

      // 连接到数据库
      const { db } = await connectToDatabase();
      this.db = db;

      // 获取集合引用
      this.partsCollection = db.collection(
        MongoDBMarkdownPartCache.PARTS_COLLECTION,
      );
      this.metadataCollection = db.collection(
        MongoDBMarkdownPartCache.METADATA_COLLECTION,
      );

      // 创建索引
      await this.createIndexes();

      this.isInitialized = true;

      this.logOperationSuccess('initialize', 'system');
      logger.info('MongoDB Markdown Part Cache 初始化完成');
    } catch (error) {
      this.logOperationError('initialize', error as Error, 'system');
      throw new MarkdownPartCacheError(
        `初始化MongoDB缓存失败: ${error.message}`,
        'INITIALIZATION_FAILED',
        { originalError: error },
      );
    }
  }

  /**
   * 创建必要的索引
   */
  private async createIndexes(): Promise<void> {
    if (!this.partsCollection || !this.metadataCollection) {
      throw new MarkdownPartCacheError(
        '数据库集合未初始化',
        'COLLECTIONS_NOT_INITIALIZED',
      );
    }

    try {
      // 在parts集合上创建复合索引
      await this.partsCollection.createIndex(
        { itemId: 1, partIndex: 1 },
        { unique: true },
      );

      // 在metadata集合上创建唯一索引
      await this.metadataCollection.createIndex(
        { itemId: 1 },
        { unique: true },
      );

      logger.debug('MongoDB索引创建完成');
    } catch (error) {
      throw new MarkdownPartCacheError(
        `创建索引失败: ${error.message}`,
        'INDEX_CREATION_FAILED',
        { originalError: error },
      );
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (
      !this.isInitialized ||
      !this.db ||
      !this.partsCollection ||
      !this.metadataCollection
    ) {
      throw new MarkdownPartCacheError(
        '缓存未初始化，请先调用initialize()',
        'CACHE_NOT_INITIALIZED',
      );
    }
  }

  /**
   * 存储部分markdown内容
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @param markdownContent markdown内容
   */
  async storePartMarkdown(
    itemId: string,
    partIndex: number,
    markdownContent: string,
  ): Promise<void> {
    try {
      logger.debug(
        `[DEBUG] storePartMarkdown called: itemId=${itemId}, partIndex=${partIndex}, contentLength=${markdownContent.length}`,
      );
      this.logOperationStart('storePartMarkdown', itemId, partIndex);

      // 验证输入
      this.validateItemId(itemId);
      this.validatePartIndex(partIndex);
      this.validateMarkdownContent(markdownContent);
      this.ensureInitialized();

      const now = new Date();

      logger.debug(
        `[DEBUG] About to upsert part for itemId=${itemId}, partIndex=${partIndex}`,
      );
      // 使用upsert操作存储或更新部分内容
      const result = await this.partsCollection!.updateOne(
        { itemId, partIndex },
        {
          $set: {
            content: markdownContent,
            status: 'completed',
            updatedAt: now,
          },
          $setOnInsert: {
            itemId,
            partIndex,
            createdAt: now,
          },
        },
        { upsert: true },
      );
      logger.debug(
        `[DEBUG] Upsert result for itemId=${itemId}, partIndex=${partIndex}:`,
        {
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount,
        },
      );

      // 验证存储是否成功
      logger.debug(
        `[DEBUG] Verifying stored part for itemId=${itemId}, partIndex=${partIndex}`,
      );
      const storedPart = await this.partsCollection!.findOne(
        { itemId, partIndex },
        { projection: { content: 1, status: 1 } },
      );
      logger.debug(
        `[DEBUG] Stored part verification:`,
        storedPart ? 'found' : 'not found',
      );

      // 更新元数据
      logger.debug(
        `[DEBUG] About to update metadata for itemId=${itemId}, partIndex=${partIndex}`,
      );
      await this.updateMetadata(itemId, partIndex, 'completed');
      logger.debug(
        `[DEBUG] Metadata updated for itemId=${itemId}, partIndex=${partIndex}`,
      );

      this.logOperationSuccess('storePartMarkdown', itemId, partIndex, {
        contentLength: markdownContent.length,
      });
    } catch (error) {
      logger.debug(
        `[DEBUG] storePartMarkdown failed for itemId=${itemId}, partIndex=${partIndex}:`,
        error,
      );
      this.logOperationError(
        'storePartMarkdown',
        error as Error,
        itemId,
        partIndex,
      );

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `存储markdown部分失败: ${error.message}`,
        'STORE_PART_FAILED',
        { itemId, partIndex, originalError: error },
      );
    }
  }

  /**
   * 获取特定部分的markdown内容
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @returns markdown内容或null（如果不存在）
   */
  async getPartMarkdown(
    itemId: string,
    partIndex: number,
  ): Promise<string | null> {
    try {
      this.logOperationStart('getPartMarkdown', itemId, partIndex);

      // 验证输入
      this.validateItemId(itemId);
      this.validatePartIndex(partIndex);
      this.ensureInitialized();

      const result = await this.partsCollection!.findOne(
        { itemId, partIndex },
        { projection: { content: 1 } },
      );

      const content = result ? result.content : null;

      this.logOperationSuccess('getPartMarkdown', itemId, partIndex, {
        found: !!content,
        contentLength: content ? content.length : 0,
      });

      return content;
    } catch (error) {
      this.logOperationError(
        'getPartMarkdown',
        error as Error,
        itemId,
        partIndex,
      );

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `获取markdown部分失败: ${error.message}`,
        'GET_PART_FAILED',
        { itemId, partIndex, originalError: error },
      );
    }
  }

  /**
   * 获取项目的所有部分
   * @param itemId 项目ID
   * @returns 部分信息数组
   */
  async getAllParts(
    itemId: string,
  ): Promise<Array<{ partIndex: number; content: string; status?: string }>> {
    try {
      logger.debug(`[DEBUG] getAllParts called for itemId=${itemId}`);
      this.logOperationStart('getAllParts', itemId);

      // 验证输入
      this.validateItemId(itemId);
      this.ensureInitialized();

      logger.debug(
        `[DEBUG] About to query database for parts of itemId=${itemId}`,
      );
      const parts = await this.partsCollection!.find({ itemId })
        .project({ partIndex: 1, content: 1, status: 1 })
        .sort({ partIndex: 1 })
        .toArray();
      logger.debug(
        `[DEBUG] Database query returned ${parts.length} parts for itemId=${itemId}`,
      );

      const result = parts.map((part) => ({
        partIndex: part.partIndex,
        content: part.content,
        status: part.status,
      }));

      logger.debug(
        `[DEBUG] getAllParts returning result with ${result.length} parts for itemId=${itemId}`,
      );

      // 如果没有找到部分，运行诊断以帮助调试
      if (result.length === 0) {
        logger.debug(
          `[DEBUG] No parts found, running diagnosis for itemId=${itemId}`,
        );
        try {
          await this.diagnoseItem(itemId);
        } catch (diagError) {
          logger.debug(
            `[DEBUG] Diagnosis failed for itemId=${itemId}:`,
            diagError,
          );
        }
      }

      this.logOperationSuccess('getAllParts', itemId, undefined, {
        partsCount: result.length,
      });

      return result;
    } catch (error) {
      logger.debug(`[DEBUG] getAllParts failed for itemId=${itemId}:`, error);
      this.logOperationError('getAllParts', error as Error, itemId);

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `获取所有部分失败: ${error.message}`,
        'GET_ALL_PARTS_FAILED',
        { itemId, originalError: error },
      );
    }
  }

  /**
   * 更新部分状态
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @param status 新状态
   */
  async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: string,
  ): Promise<void> {
    try {
      logger.debug(
        `[DEBUG] updatePartStatus called: itemId=${itemId}, partIndex=${partIndex}, status=${status}`,
      );
      this.logOperationStart('updatePartStatus', itemId, partIndex);

      // 验证输入
      this.validateItemId(itemId);
      this.validatePartIndex(partIndex);
      this.validateStatus(status);
      this.ensureInitialized();

      const now = new Date();

      // 更新部分状态
      const result = await this.partsCollection!.updateOne(
        { itemId, partIndex },
        {
          $set: {
            status,
            updatedAt: now,
          },
        },
      );

      if (result.matchedCount === 0) {
        // If part doesn't exist and status is 'failed', create a placeholder part for tracking
        if (status === 'failed') {
          logger.debug(
            `[DEBUG] Part not found, creating placeholder for failed part: itemId=${itemId}, partIndex=${partIndex}`,
          );
          await this.partsCollection!.insertOne({
            itemId,
            partIndex,
            content: '', // Empty content for failed parts - fixed field name
            status: 'failed',
            createdAt: now,
            updatedAt: now,
          });

          // Update metadata for failed part
          await this.updateMetadata(itemId, partIndex, status);

          this.logOperationSuccess('updatePartStatus', itemId, partIndex, {
            status,
          });
          return;
        }

        throw new MarkdownPartCacheError(
          `未找到指定的部分: itemId=${itemId}, partIndex=${partIndex}`,
          'PART_NOT_FOUND',
          { itemId, partIndex },
        );
      }

      // 更新元数据
      await this.updateMetadata(itemId, partIndex, status);

      this.logOperationSuccess('updatePartStatus', itemId, partIndex, {
        status,
      });
    } catch (error) {
      this.logOperationError(
        'updatePartStatus',
        error as Error,
        itemId,
        partIndex,
      );

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `更新部分状态失败: ${error.message}`,
        'UPDATE_STATUS_FAILED',
        { itemId, partIndex, status, originalError: error },
      );
    }
  }

  /**
   * 获取部分状态
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @returns 状态或null（如果不存在）
   */
  async getPartStatus(
    itemId: string,
    partIndex: number,
  ): Promise<string | null> {
    try {
      logger.debug(
        `[DEBUG] getPartStatus called: itemId=${itemId}, partIndex=${partIndex}`,
      );
      this.logOperationStart('getPartStatus', itemId, partIndex);

      // 验证输入
      this.validateItemId(itemId);
      this.validatePartIndex(partIndex);
      this.ensureInitialized();

      logger.debug(
        `[DEBUG] About to query database for status of itemId=${itemId}, partIndex=${partIndex}`,
      );
      const result = await this.partsCollection!.findOne(
        { itemId, partIndex },
        { projection: { status: 1 } },
      );

      const status = result ? result.status : null;
      logger.debug(
        `[DEBUG] getPartStatus result: ${status} for itemId=${itemId}, partIndex=${partIndex}`,
      );

      this.logOperationSuccess('getPartStatus', itemId, partIndex, {
        found: !!status,
        status,
      });

      return status;
    } catch (error) {
      logger.debug(
        `[DEBUG] getPartStatus failed for itemId=${itemId}, partIndex=${partIndex}:`,
        error,
      );
      this.logOperationError(
        'getPartStatus',
        error as Error,
        itemId,
        partIndex,
      );

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `获取部分状态失败: ${error.message}`,
        'GET_STATUS_FAILED',
        { itemId, partIndex, originalError: error },
      );
    }
  }

  /**
   * 清理特定项目的缓存
   * @param itemId 项目ID
   */
  async cleanup(itemId: string): Promise<void> {
    try {
      this.logOperationStart('cleanup', itemId);

      // 验证输入
      this.validateItemId(itemId);
      this.ensureInitialized();

      // 删除所有部分
      const partsResult = await this.partsCollection!.deleteMany({ itemId });

      // 删除元数据
      const metadataResult = await this.metadataCollection!.deleteOne({
        itemId,
      });

      this.logOperationSuccess('cleanup', itemId, undefined, {
        deletedParts: partsResult.deletedCount,
        deletedMetadata: metadataResult.deletedCount,
      });

      logger.info(`清理项目 ${itemId} 的缓存完成`, {
        itemId,
        deletedParts: partsResult.deletedCount,
        deletedMetadata: metadataResult.deletedCount,
      });
    } catch (error) {
      this.logOperationError('cleanup', error as Error, itemId);

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `清理缓存失败: ${error.message}`,
        'CLEANUP_FAILED',
        { itemId, originalError: error },
      );
    }
  }

  /**
   * 更新元数据
   * @param itemId 项目ID
   * @param partIndex 部分索引
   * @param status 状态
   */
  private async updateMetadata(
    itemId: string,
    partIndex: number,
    status: string,
  ): Promise<void> {
    try {
      logger.debug(
        `[DEBUG] updateMetadata called: itemId=${itemId}, partIndex=${partIndex}, status=${status}`,
      );
      const now = new Date();

      // 获取当前元数据
      const existingMetadata = await this.metadataCollection!.findOne({
        itemId,
      });
      logger.debug(`[DEBUG] Existing metadata:`, existingMetadata);

      if (existingMetadata) {
        // 更新现有元数据
        const updateData: any = {
          $set: { updatedAt: now },
        };

        if (status === 'completed') {
          updateData.$addToSet = { completedParts: partIndex };
          updateData.$pull = { failedParts: partIndex };
        } else if (status === 'failed') {
          updateData.$addToSet = { failedParts: partIndex };
          updateData.$pull = { completedParts: partIndex };
        }

        logger.debug(`[DEBUG] Update data:`, updateData);
        await this.metadataCollection!.updateOne({ itemId }, updateData);
        logger.debug(`[DEBUG] Metadata updated successfully`);

        // 检查是否所有部分都已完成
        await this.checkAndUpdateOverallStatus(itemId);
      } else {
        // 创建新元数据
        const completedParts = status === 'completed' ? [partIndex] : [];
        const failedParts = status === 'failed' ? [partIndex] : [];

        // For new metadata, we need to count the actual parts
        const allParts = await this.partsCollection!.find({ itemId }).toArray();

        await this.metadataCollection!.insertOne({
          itemId,
          totalParts: allParts.length, // Set to actual count of parts
          completedParts,
          failedParts,
          status: status === 'completed' ? 'completed' : 'processing',
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      throw new MarkdownPartCacheError(
        `更新元数据失败: ${error.message}`,
        'UPDATE_METADATA_FAILED',
        { itemId, partIndex, status, originalError: error },
      );
    }
  }

  /**
   * 检查并更新整体状态
   * @param itemId 项目ID
   */
  private async checkAndUpdateOverallStatus(itemId: string): Promise<void> {
    try {
      // 获取所有部分
      const allParts = await this.partsCollection!.find({ itemId }).toArray();

      if (allParts.length === 0) {
        return;
      }

      // 获取元数据
      const metadata = await this.metadataCollection!.findOne({ itemId });

      if (!metadata) {
        return;
      }

      // 更新总部分数
      await this.metadataCollection!.updateOne(
        { itemId },
        {
          $set: {
            totalParts: allParts.length,
            updatedAt: new Date(),
          },
        },
      );

      // 检查是否所有部分都已完成
      const completedCount = allParts.filter(
        (part) => part.status === 'completed',
      ).length;
      const failedCount = allParts.filter(
        (part) => part.status === 'failed',
      ).length;

      let newStatus = 'processing';
      if (completedCount === allParts.length) {
        newStatus = 'completed';
      } else if (
        failedCount > 0 &&
        completedCount + failedCount === allParts.length
      ) {
        newStatus = 'failed';
      }

      if (newStatus !== metadata.status) {
        await this.metadataCollection!.updateOne(
          { itemId },
          {
            $set: {
              status: newStatus,
              updatedAt: new Date(),
            },
          },
        );
      }
    } catch (error) {
      throw new MarkdownPartCacheError(
        `检查和更新整体状态失败: ${error.message}`,
        'CHECK_UPDATE_STATUS_FAILED',
        { itemId, originalError: error },
      );
    }
  }

  /**
   * 获取项目元数据
   * @param itemId 项目ID
   * @returns 元数据或null（如果不存在）
   */
  async getMetadata(itemId: string): Promise<any | null> {
    try {
      this.logOperationStart('getMetadata', itemId);

      // 验证输入
      this.validateItemId(itemId);
      this.ensureInitialized();

      const metadata = await this.metadataCollection!.findOne({ itemId });

      this.logOperationSuccess('getMetadata', itemId, undefined, {
        found: !!metadata,
      });

      return metadata;
    } catch (error) {
      this.logOperationError('getMetadata', error as Error, itemId);

      if (error instanceof MarkdownPartCacheError) {
        throw error;
      }

      throw new MarkdownPartCacheError(
        `获取元数据失败: ${error.message}`,
        'GET_METADATA_FAILED',
        { itemId, originalError: error },
      );
    }
  }

  /**
   * 诊断方法：检查项目的所有数据状态
   * @param itemId 项目ID
   * @returns 诊断信息
   */
  async diagnoseItem(itemId: string): Promise<any> {
    try {
      logger.debug(`[DEBUG] diagnoseItem called for itemId=${itemId}`);
      this.validateItemId(itemId);
      this.ensureInitialized();

      // 获取所有部分
      const allParts = await this.partsCollection!.find({ itemId }).toArray();
      logger.debug(
        `[DEBUG] Found ${allParts.length} parts in database for itemId=${itemId}`,
      );

      // 获取元数据
      const metadata = await this.metadataCollection!.findOne({ itemId });
      logger.debug(`[DEBUG] Metadata for itemId=${itemId}:`, metadata);

      // 按状态分组统计
      const statusStats = allParts.reduce(
        (acc, part) => {
          acc[part.status] = (acc[part.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const diagnosis = {
        itemId,
        totalParts: allParts.length,
        statusStats,
        parts: allParts.map((part) => ({
          partIndex: part.partIndex,
          status: part.status,
          hasContent: !!part.content,
          contentLength: part.content ? part.content.length : 0,
          createdAt: part.createdAt,
          updatedAt: part.updatedAt,
        })),
        metadata,
      };

      logger.debug(
        `[DEBUG] Diagnosis for itemId=${itemId}:`,
        JSON.stringify(diagnosis, null, 2),
      );
      return diagnosis;
    } catch (error) {
      logger.debug(`[DEBUG] diagnoseItem failed for itemId=${itemId}:`, error);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    try {
      this.logOperationStart('close', 'system');

      if (this.db) {
        // 注意：由于使用了连接池和缓存，我们不应该在这里关闭连接
        // 这可能会影响其他使用同一连接的代码
        this.db = null;
        this.partsCollection = null;
        this.metadataCollection = null;
        this.isInitialized = false;
      }

      this.logOperationSuccess('close', 'system');
    } catch (error) {
      this.logOperationError('close', error as Error, 'system');

      throw new MarkdownPartCacheError(
        `关闭数据库连接失败: ${error.message}`,
        'CLOSE_FAILED',
        { originalError: error },
      );
    }
  }
}
