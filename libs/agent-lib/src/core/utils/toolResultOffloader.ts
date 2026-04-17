/**
 * ToolResultOffloader - 大工具结果持久化处理器
 * 
 * 策略：
 * 1. 单工具结果超过阈值 → 持久化到数据库
 * 2. 状态按 toolUseId 冻结，确保 prompt 稳定
 */

import type { IPersistenceService } from '../persistence/types.js';
import { getLogger } from '@shared/logger';

export const PERSISTED_OUTPUT_TAG = '<persisted-output>';
export const PERSISTED_OUTPUT_CLOSING_TAG = '</persisted-output>';
export const PREVIEW_SIZE_CHARS = 2000;

export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000;

export interface OffloaderConfig {
  maxResultSizeChars: number;
}

export const defaultOffloaderConfig: OffloaderConfig = {
  maxResultSizeChars: DEFAULT_MAX_RESULT_SIZE_CHARS,
};

export interface ProcessedToolResult {
  content: string;
  wasPersisted: boolean;
  originalSize?: number;
}

type ReplacementState = {
  seenIds: Set<string>;
  replacements: Map<string, string>;
};

export class ToolResultOffloader {
  private config: OffloaderConfig;
  private logger = getLogger('ToolResultOffloader');
  private state: ReplacementState = {
    seenIds: new Set(),
    replacements: new Map(),
  };
  private blobService: IPersistenceService | undefined;
  private instanceId: string;

  constructor(
    blobService: IPersistenceService | undefined,
    instanceId: string,
    config: Partial<OffloaderConfig> = {},
  ) {
    this.blobService = blobService;
    this.instanceId = instanceId;
    this.config = { ...defaultOffloaderConfig, ...config };
  }

  /**
   * 处理单个工具结果
   */
  async processResult(
    toolUseId: string,
    toolName: string,
    content: string,
  ): Promise<ProcessedToolResult> {
    if (!this.blobService) {
      return { content, wasPersisted: false };
    }

    // 已处理过的结果，直接返回缓存的替换内容
    if (this.state.replacements.has(toolUseId)) {
      return {
        content: this.state.replacements.get(toolUseId)!,
        wasPersisted: true,
      };
    }

    // 标记为已见
    this.state.seenIds.add(toolUseId);

    const size = content.length;

    // 未超限，返回原内容
    if (size <= this.config.maxResultSizeChars) {
      return { content, wasPersisted: false };
    }

    // 超限，持久化到数据库
    try {
      const { preview, originalSize } = await this.blobService.saveToolResultBlob(
        this.instanceId,
        toolUseId,
        toolName,
        content,
      );

      const previewMessage = this.buildPreviewMessage(toolName, originalSize, preview);
      this.state.replacements.set(toolUseId, previewMessage);

      this.logger.debug(
        { toolUseId, toolName, originalSize, previewSize: previewMessage.length },
        '[ToolResultOffloader] Tool result persisted',
      );

      return { content: previewMessage, wasPersisted: true, originalSize };
    } catch (error) {
      this.logger.error({ error, toolUseId }, '[ToolResultOffloader] Failed to persist, using original');
      return { content, wasPersisted: false };
    }
  }

  /**
   * 构建预览消息
   */
  private buildPreviewMessage(
    toolName: string,
    originalSize: number,
    preview: string,
  ): string {
    const sizeStr = this.formatFileSize(originalSize);
    return [
      PERSISTED_OUTPUT_TAG,
      `Tool "${toolName}" output too large (${sizeStr}).`,
      `Preview (first ${this.formatFileSize(PREVIEW_SIZE_CHARS)}):`,
      preview,
      '...',
      PERSISTED_OUTPUT_CLOSING_TAG,
    ].join('\n');
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  /**
   * 获取替代状态（用于序列化/恢复）
   */
  getState(): { seenIds: string[]; replacements: Record<string, string> } {
    return {
      seenIds: [...this.state.seenIds],
      replacements: Object.fromEntries(this.state.replacements),
    };
  }

  /**
   * 恢复状态（用于 resume/replay）
   */
  restoreState(state: { seenIds: string[]; replacements: Record<string, string> }): void {
    this.state.seenIds = new Set(state.seenIds);
    this.state.replacements = new Map(Object.entries(state.replacements));
  }
}
