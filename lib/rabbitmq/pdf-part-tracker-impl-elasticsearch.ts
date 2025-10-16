import {
  IPdfPartTracker,
  PdfPartStatusInfo,
  PdfProcessingStatusInfo,
} from './pdf-part-tracker';
import { PdfPartStatus } from './message.types';
import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('PdfPartTrackerElasticsearchImpl');

/**
 * ElasticSearch实现的PDF部分状态跟踪器
 */
export class PdfPartTrackerElasticsearchImpl implements IPdfPartTracker {
  private readonly processingIndexName = 'pdf_processing_status';
  private readonly partIndexName = 'pdf_part_status';
  private client: Client;
  private isInitialized = false;

  constructor(elasticsearchUrl: string = 'http://elasticsearch:9200') {
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
  }

  /**
   * 初始化索引
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 初始化PDF处理状态索引
      await this.initializeProcessingIndex();

      // 初始化PDF部分状态索引
      await this.initializePartIndex();

      this.isInitialized = true;
      logger.info('PDF part tracker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF part tracker:', error);
      throw error;
    }
  }

  /**
   * 初始化PDF处理状态索引
   */
  private async initializeProcessingIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.processingIndexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.processingIndexName,
          body: {
            mappings: {
              properties: {
                itemId: {
                  type: 'keyword',
                },
                totalParts: {
                  type: 'integer',
                },
                completedParts: {
                  type: 'integer',
                },
                failedParts: {
                  type: 'integer',
                },
                processingParts: {
                  type: 'integer',
                },
                pendingParts: {
                  type: 'integer',
                },
                startTime: {
                  type: 'date',
                },
                endTime: {
                  type: 'date',
                },
                status: {
                  type: 'keyword',
                },
                error: {
                  type: 'text',
                },
              },
            },
          } as any,
        });

        // 创建索引以提高查询性能
        await this.client.indices.putMapping({
          index: this.processingIndexName,
          body: {
            properties: {
              itemId: {
                type: 'keyword',
              },
            },
          },
        } as any);

        logger.info(`Created index: ${this.processingIndexName}`);
      }
    } catch (error) {
      if (
        error?.meta?.body?.error?.type ===
          'resource_already_exists_exception' ||
        error?.meta?.statusCode === 400
      ) {
        logger.info(
          `Index ${this.processingIndexName} already exists, continuing`,
        );
        return;
      }
      logger.error('Failed to initialize processing index:', error);
      throw error;
    }
  }

  /**
   * 初始化PDF部分状态索引
   */
  private async initializePartIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.partIndexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.partIndexName,
          body: {
            mappings: {
              properties: {
                itemId: {
                  type: 'keyword',
                },
                partIndex: {
                  type: 'integer',
                },
                totalParts: {
                  type: 'integer',
                },
                status: {
                  type: 'keyword',
                },
                startTime: {
                  type: 'date',
                },
                endTime: {
                  type: 'date',
                },
                error: {
                  type: 'text',
                },
                retryCount: {
                  type: 'integer',
                },
                maxRetries: {
                  type: 'integer',
                },
              },
            },
          } as any,
        });

        // 创建索引以提高查询性能
        await this.client.indices.putMapping({
          index: this.partIndexName,
          body: {
            properties: {
              itemId: {
                type: 'keyword',
              },
              partIndex: {
                type: 'integer',
              },
              status: {
                type: 'keyword',
              },
            },
          },
        } as any);

        logger.info(`Created index: ${this.partIndexName}`);
      }
    } catch (error) {
      if (
        error?.meta?.body?.error?.type ===
          'resource_already_exists_exception' ||
        error?.meta?.statusCode === 400
      ) {
        logger.info(`Index ${this.partIndexName} already exists, continuing`);
        return;
      }
      logger.error('Failed to initialize part index:', error);
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
      const now = new Date().toISOString();

      // 检查是否已存在
      const existingStatus = await this.getPdfProcessingStatus(itemId);
      if (existingStatus) {
        logger.warn(
          `PDF processing status already exists for item ${itemId}, resetting...`,
        );
        await this.cleanupPdfProcessing(itemId);
      }

      // 创建PDF处理状态记录
      const processingStatus: Omit<
        PdfProcessingStatusInfo,
        'completedParts' | 'failedParts' | 'processingParts' | 'pendingParts'
      > = {
        itemId,
        totalParts,
        startTime: new Date(now).getTime(),
        status: 'pending',
      };

      await this.client.index({
        index: this.processingIndexName,
        id: itemId,
        body: {
          ...processingStatus,
          completedParts: [],
          failedParts: [],
          processingParts: [],
          pendingParts: Array.from({ length: totalParts }, (_, i) => i),
        },
      });

      // 创建所有部分的状态记录
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
        const body = partStatuses.flatMap((partStatus) => [
          {
            index: {
              _index: this.partIndexName,
              _id: `${itemId}_${partStatus.partIndex}`,
            },
          },
          partStatus,
        ]);

        await this.client.bulk({
          body,
        });
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
      const now = new Date().toISOString();
      const updateData: any = {
        status,
        ...(status === PdfPartStatus.PROCESSING && { startTime: now }),
        ...(status === PdfPartStatus.COMPLETED && { endTime: now }),
        ...(status === PdfPartStatus.FAILED && { endTime: now, error }),
      };

      // 更新部分状态
      try {
        await this.client.update({
          index: this.partIndexName,
          id: `${itemId}_${partIndex}`,
          body: {
            doc: updateData,
          } as any,
        });
      } catch (updateError: any) {
        if (updateError?.meta?.statusCode === 404) {
          logger.warn(`No part found for item ${itemId}, part ${partIndex}`);
          return;
        }
        throw updateError;
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
      const result = await this.client.search({
        index: this.partIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
          size: 10000, // 假设不会超过10000个部分
        } as any,
      });

      const allParts = result.hits.hits.map((hit: any) => hit._source);

      const completedParts = allParts
        .filter((part: any) => part.status === PdfPartStatus.COMPLETED)
        .map((part: any) => part.partIndex);

      const failedParts = allParts
        .filter((part: any) => part.status === PdfPartStatus.FAILED)
        .map((part: any) => part.partIndex);

      const processingParts = allParts
        .filter((part: any) => part.status === PdfPartStatus.PROCESSING)
        .map((part: any) => part.partIndex);

      const pendingParts = allParts
        .filter((part: any) => part.status === PdfPartStatus.PENDING)
        .map((part: any) => part.partIndex);

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
        updateData.endTime = new Date().toISOString();
      }

      await this.client.update({
        index: this.processingIndexName,
        id: itemId,
        body: {
          doc: updateData,
        } as any,
      });

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
      const result = await this.client.get({
        index: this.processingIndexName,
        id: itemId,
      });

      if (result.found) {
        const { _source } = result as any;
        return _source as PdfProcessingStatusInfo;
      }

      return null;
    } catch (error: any) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
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
      const result = await this.client.search({
        index: this.partIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
          sort: [
            {
              partIndex: {
                order: 'asc',
              },
            },
          ],
          size: 10000, // 假设不会超过10000个部分
        } as any,
      });

      const hits = result.hits.hits;
      return hits.map((hit: any) => hit._source as PdfPartStatusInfo);
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
      // 删除处理状态
      await this.client.deleteByQuery({
        index: this.processingIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        } as any,
      });

      // 删除所有部分状态
      await this.client.deleteByQuery({
        index: this.partIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        } as any,
      });

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
      const result = await this.client.search({
        index: this.processingIndexName,
        body: {
          query: {
            terms: {
              status: ['pending', 'processing'],
            },
          },
          _source: ['itemId'],
          size: 10000, // 假设不会超过10000个正在处理的PDF
        } as any,
      });

      const hits = result.hits.hits;
      return hits.map((hit: any) => hit._source.itemId);
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
      const result = await this.client.search({
        index: this.partIndexName,
        body: {
          query: {
            bool: {
              must: [
                { term: { itemId: itemId } },
                { term: { status: PdfPartStatus.FAILED } },
              ],
            },
          },
          sort: [
            {
              partIndex: {
                order: 'asc',
              },
            },
          ],
          size: 10000, // 假设不会超过10000个部分
        } as any,
      });

      const hits = result.hits.hits;
      return hits.map((hit: any) => hit._source as PdfPartStatusInfo);
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
        await this.client.update({
          index: this.partIndexName,
          id: `${itemId}_${part.partIndex}`,
          body: {
            doc: {
              status: PdfPartStatus.PENDING,
              startTime: null,
              endTime: null,
              error: null,
              retryCount: (part.retryCount || 0) + 1,
            },
          } as any,
        });
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
