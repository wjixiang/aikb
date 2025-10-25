import {
  IPdfPartTracker,
  PdfPartStatusInfo,
  PdfProcessingStatusInfo,
} from './pdf-part-tracker';
import { PdfPartStatus } from './message.types';
import { connectToDatabase } from '../../libs/bibliography/src/storage/mongodb';
import { Db, Collection } from 'mongodb';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('PdfPartTrackerImpl');

/**
 * MongoDB实现的PDF部分状态跟踪器
 */
export class PdfPartTrackerImpl implements IPdfPartTracker {
  private db: Db | null = null;
  private pdfProcessingCollection: Collection | null = null;
  private pdfPartCollection: Collection | null = null;
  private isInitialized = false;

  /**
   * 初始化数据库连接
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const { db } = await connectToDatabase();
      this.db = db;
      this.pdfProcessingCollection = this.db.collection(
        'pdf_processing_status',
      );
      this.pdfPartCollection = this.db.collection('pdf_part_status');

      // 创建索引以提高查询性能
      await this.pdfProcessingCollection.createIndex(
        { itemId: 1 },
        { unique: true },
      );
      await this.pdfPartCollection.createIndex(
        { itemId: 1, partIndex: 1 },
        { unique: true },
      );
      await this.pdfPartCollection.createIndex({ itemId: 1, status: 1 });

      this.isInitialized = true;
      logger.info('PDF part tracker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF part tracker:', error);
      throw error;
    }
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * 初始化PDF处理状态
   */
  async initializePdfProcessing(
    itemId: string,
    totalParts: number,
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const now = Date.now();

      logger.info(
        `[DEBUG] initializePdfProcessing called for itemId=${itemId}, totalParts=${totalParts}`,
      );

      // 创建PDF处理状态记录 - 使用原子操作避免竞态条件
      const processingStatus: Omit<
        PdfProcessingStatusInfo,
        'completedParts' | 'failedParts' | 'processingParts' | 'pendingParts'
      > = {
        itemId,
        totalParts,
        startTime: now,
        status: 'pending',
      };

      const fullProcessingStatus = {
        ...processingStatus,
        completedParts: [],
        failedParts: [],
        processingParts: [],
        pendingParts: Array.from({ length: totalParts }, (_, i) => i),
      };

      logger.info(`[DEBUG] Attempting atomic upsert for itemId=${itemId}`);

      // 使用 findOneAndUpdate 进行原子操作，避免竞态条件
      const result = await this.pdfProcessingCollection!.findOneAndUpdate(
        { itemId },
        { $setOnInsert: fullProcessingStatus },
        {
          upsert: true,
          returnDocument: 'after',
        },
      );

      logger.info(
        `[DEBUG] Atomic operation result for itemId=${itemId}:`,
        result ? 'success' : 'failed',
      );

      // 检查是否是现有记录，如果是且状态不正确，则重置
      if (result && result.status !== 'pending') {
        logger.warn(
          `PDF processing status exists but is not pending for item ${itemId} (status: ${result.status}), resetting...`,
        );
        await this.cleanupPdfProcessing(itemId);
        logger.info(`[DEBUG] Cleanup completed for itemId=${itemId}`);

        // 重新创建状态
        await this.pdfProcessingCollection!.insertOne(fullProcessingStatus);
        logger.info(
          `[DEBUG] Re-inserted processing status for itemId=${itemId}`,
        );
      }

      // 创建所有部分的状态记录 - 使用批量操作避免竞态条件
      const partStatuses: Omit<
        PdfPartStatusInfo,
        'startTime' | 'endTime' | 'error' | 'retryCount' | 'maxRetries'
      >[] = [];
      for (let i = 0; i < totalParts; i++) {
        partStatuses.push({
          itemId,
          partIndex: i,
          totalParts,
          status: PdfPartStatus.PENDING,
        });
      }

      if (partStatuses.length > 0) {
        logger.debug(
          `[DEBUG] Attempting to insert ${partStatuses.length} part statuses for itemId=${itemId}`,
        );

        try {
          // 使用 ordered: false 来允许部分成功，并使用 bulkWrite 进行更细粒度控制
          const bulkOps = partStatuses.map((part) => ({
            updateOne: {
              filter: { itemId: part.itemId, partIndex: part.partIndex },
              update: { $setOnInsert: part },
              upsert: true,
            },
          }));

          const bulkResult = await this.pdfPartCollection!.bulkWrite(bulkOps, {
            ordered: false,
          });
          logger.debug(`[DEBUG] Bulk insert result for itemId=${itemId}:`, {
            insertedCount: bulkResult.insertedCount,
            upsertedCount: bulkResult.upsertedCount,
            modifiedCount: bulkResult.modifiedCount,
          });
        } catch (bulkError) {
          logger.error(
            `[DEBUG] Bulk operation failed for itemId=${itemId}:`,
            bulkError,
          );
          // 如果批量操作失败，尝试逐个插入
          logger.debug(
            `[DEBUG] Falling back to individual inserts for itemId=${itemId}`,
          );
          for (const part of partStatuses) {
            try {
              await this.pdfPartCollection!.updateOne(
                { itemId: part.itemId, partIndex: part.partIndex },
                { $setOnInsert: part },
                { upsert: true },
              );
            } catch (individualError) {
              logger.error(
                `[DEBUG] Failed to insert part ${part.partIndex} for itemId=${itemId}:`,
                individualError,
              );
              // 继续处理其他部分，不因单个失败而停止
            }
          }
        }
      }

      logger.info(
        `Initialized PDF processing for item ${itemId} with ${totalParts} parts`,
      );
    } catch (error) {
      logger.error(
        `Failed to initialize PDF processing for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 更新部分状态
   */
  async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: PdfPartStatus,
    error?: string,
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const now = Date.now();
      const updateData: any = {
        status,
        ...(status === PdfPartStatus.PROCESSING && { startTime: now }),
        ...(status === PdfPartStatus.COMPLETED && { endTime: now }),
        ...(status === PdfPartStatus.FAILED && { endTime: now, error }),
      };

      // 更新部分状态
      const result = await this.pdfPartCollection!.updateOne(
        { itemId, partIndex },
        { $set: updateData },
      );

      if (result.matchedCount === 0) {
        logger.warn(`No part found for item ${itemId}, part ${partIndex}`);
        return;
      }

      // 更新整体处理状态
      await this.updateOverallStatus(itemId);

      logger.debug(
        `Updated part ${partIndex} status to ${status} for item ${itemId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to update part status for item ${itemId}, part ${partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 更新整体处理状态
   */
  private async updateOverallStatus(itemId: string): Promise<void> {
    try {
      const allParts = await this.pdfPartCollection!.find({ itemId }).toArray();

      const completedParts = allParts
        .filter((part) => part.status === PdfPartStatus.COMPLETED)
        .map((part) => part.partIndex);

      const failedParts = allParts
        .filter((part) => part.status === PdfPartStatus.FAILED)
        .map((part) => part.partIndex);

      const processingParts = allParts
        .filter((part) => part.status === PdfPartStatus.PROCESSING)
        .map((part) => part.partIndex);

      const pendingParts = allParts
        .filter((part) => part.status === PdfPartStatus.PENDING)
        .map((part) => part.partIndex);

      let overallStatus: 'pending' | 'processing' | 'completed' | 'failed';

      if (failedParts.length > 0 && completedParts.length === 0) {
        overallStatus = 'failed';
      } else if (completedParts.length === allParts.length) {
        overallStatus = 'completed';
      } else if (processingParts.length > 0 || completedParts.length > 0) {
        overallStatus = 'processing';
      } else {
        overallStatus = 'pending';
      }

      const updateData: any = {
        completedParts,
        failedParts,
        processingParts,
        pendingParts,
        status: overallStatus,
      };

      if (overallStatus === 'completed' || overallStatus === 'failed') {
        updateData.endTime = Date.now();
      }

      await this.pdfProcessingCollection!.updateOne(
        { itemId },
        { $set: updateData },
      );

      logger.debug(
        `Updated overall status to ${overallStatus} for item ${itemId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to update overall status for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 获取PDF处理状态
   */
  async getPdfProcessingStatus(
    itemId: string,
  ): Promise<PdfProcessingStatusInfo | null> {
    await this.ensureInitialized();

    try {
      const status = await this.pdfProcessingCollection!.findOne({ itemId });
      return status as PdfProcessingStatusInfo | null;
    } catch (error) {
      logger.error(
        `Failed to get PDF processing status for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 获取所有部分状态
   */
  async getAllPartStatuses(itemId: string): Promise<PdfPartStatusInfo[]> {
    await this.ensureInitialized();

    try {
      const parts = await this.pdfPartCollection!.find({ itemId }).toArray();
      return parts as unknown as PdfPartStatusInfo[];
    } catch (error) {
      logger.error(
        `Failed to get all part statuses for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 检查是否所有部分都已完成
   */
  async areAllPartsCompleted(itemId: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const status = await this.getPdfProcessingStatus(itemId);
      if (!status) {
        return false;
      }

      return status.completedParts.length === status.totalParts;
    } catch (error) {
      logger.error(
        `Failed to check if all parts are completed for item ${itemId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * 检查是否有任何部分失败
   */
  async hasAnyPartFailed(itemId: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const status = await this.getPdfProcessingStatus(itemId);
      if (!status) {
        return false;
      }

      return status.failedParts.length > 0;
    } catch (error) {
      logger.error(
        `Failed to check if any part failed for item ${itemId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * 获取已完成的部分索引
   */
  async getCompletedParts(itemId: string): Promise<number[]> {
    await this.ensureInitialized();

    try {
      const status = await this.getPdfProcessingStatus(itemId);
      return status?.completedParts || [];
    } catch (error) {
      logger.error(`Failed to get completed parts for item ${itemId}:`, error);
      return [];
    }
  }

  /**
   * 获取失败的部分索引
   */
  async getFailedParts(itemId: string): Promise<number[]> {
    await this.ensureInitialized();

    try {
      const status = await this.getPdfProcessingStatus(itemId);
      return status?.failedParts || [];
    } catch (error) {
      logger.error(`Failed to get failed parts for item ${itemId}:`, error);
      return [];
    }
  }

  /**
   * 清理PDF处理状态
   */
  async cleanupPdfProcessing(itemId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.pdfProcessingCollection!.deleteMany({ itemId });
      await this.pdfPartCollection!.deleteMany({ itemId });

      logger.info(`Cleaned up PDF processing status for item ${itemId}`);
    } catch (error) {
      logger.error(
        `Failed to cleanup PDF processing status for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 获取所有正在处理的PDF
   */
  async getAllProcessingPdfs(): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const processingPdfs = await this.pdfProcessingCollection!.find({
        status: { $in: ['pending', 'processing'] },
      })
        .project({ itemId: 1 })
        .toArray();

      return processingPdfs.map((pdf) => pdf.itemId);
    } catch (error) {
      logger.error('Failed to get all processing PDFs:', error);
      return [];
    }
  }

  /**
   * 获取失败部分的详细信息
   */
  async getFailedPartsDetails(itemId: string): Promise<PdfPartStatusInfo[]> {
    await this.ensureInitialized();

    try {
      const failedParts = await this.pdfPartCollection!.find({
        itemId,
        status: PdfPartStatus.FAILED,
      }).toArray();

      return failedParts as unknown as PdfPartStatusInfo[];
    } catch (error) {
      logger.error(
        `Failed to get failed parts details for item ${itemId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * 重试失败的部分
   */
  async retryFailedParts(itemId: string): Promise<number[]> {
    await this.ensureInitialized();

    try {
      const failedParts = await this.getFailedPartsDetails(itemId);
      const retriedParts: number[] = [];

      for (const part of failedParts) {
        // 重置部分状态为pending
        await this.pdfPartCollection!.updateOne(
          { itemId, partIndex: part.partIndex },
          {
            $set: {
              status: PdfPartStatus.PENDING,
              startTime: undefined,
              endTime: undefined,
              error: undefined,
              retryCount: (part.retryCount || 0) + 1,
            },
          },
        );
        retriedParts.push(part.partIndex);
      }

      if (retriedParts.length > 0) {
        await this.updateOverallStatus(itemId);
        logger.info(
          `Retried ${retriedParts.length} failed parts for item ${itemId}`,
        );
      }

      return retriedParts;
    } catch (error) {
      logger.error(`Failed to retry failed parts for item ${itemId}:`, error);
      return [];
    }
  }
}
