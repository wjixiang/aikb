import { PdfPartStatus } from './message.types';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('PdfPartTracker');

/**
 * PDF部分状态信息
 */
export interface PdfPartStatusInfo {
  itemId: string;
  partIndex: number;
  totalParts: number;
  status: PdfPartStatus;
  startTime?: number;
  endTime?: number;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * PDF整体状态信息
 */
export interface PdfProcessingStatusInfo {
  itemId: string;
  totalParts: number;
  completedParts: number[];
  failedParts: number[];
  processingParts: number[];
  pendingParts: number[];
  startTime: number;
  endTime?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

/**
 * PDF部分状态跟踪器接口
 */
export interface IPdfPartTracker {
  /**
   * 初始化PDF处理状态
   */
  initializePdfProcessing(itemId: string, totalParts: number): Promise<void>;
  
  /**
   * 更新部分状态
   */
  updatePartStatus(itemId: string, partIndex: number, status: PdfPartStatus, error?: string): Promise<void>;
  
  /**
   * 获取PDF处理状态
   */
  getPdfProcessingStatus(itemId: string): Promise<PdfProcessingStatusInfo | null>;
  
  /**
   * 获取所有部分状态
   */
  getAllPartStatuses(itemId: string): Promise<PdfPartStatusInfo[]>;
  
  /**
   * 检查是否所有部分都已完成
   */
  areAllPartsCompleted(itemId: string): Promise<boolean>;
  
  /**
   * 检查是否有任何部分失败
   */
  hasAnyPartFailed(itemId: string): Promise<boolean>;
  
  /**
   * 获取已完成的部分索引
   */
  getCompletedParts(itemId: string): Promise<number[]>;
  
  /**
   * 获取失败的部分索引
   */
  getFailedParts(itemId: string): Promise<number[]>;
  
  /**
   * 清理PDF处理状态
   */
  cleanupPdfProcessing(itemId: string): Promise<void>;
  
  /**
   * 获取所有正在处理的PDF
   */
  getAllProcessingPdfs(): Promise<string[]>;
  
  /**
   * 获取失败部分的详细信息
   */
  getFailedPartsDetails(itemId: string): Promise<PdfPartStatusInfo[]>;
  
  /**
   * 重试失败的部分
   */
  retryFailedParts(itemId: string): Promise<number[]>;
}