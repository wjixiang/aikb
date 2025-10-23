import {
  BaseChunkingStrategy,
  ChunkingConfig,
  BaseChunkResult,
  ChunkingStrategy,
} from '../chunkingStrategy';

/**
 * 基于段落的文本切片策略
 * 将文本按段落进行切分，支持合并短段落和分割长段落
 */
export class ParagraphChunkingStrategy extends BaseChunkingStrategy {
  readonly name = ChunkingStrategy.PARAGRAPH;
  readonly description = '基于段落的文本切片策略，支持合并短段落和分割长段落';
  readonly version = '1.0.0';

  /**
   * 段落策略可以处理任何文本
   */
  canHandle(text: string): boolean {
    return !!(text && typeof text === 'string');
  }

  /**
   * 基于段落的文本切片
   */
  chunk(text: string, config?: ChunkingConfig): BaseChunkResult[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const finalConfig = { ...this.getDefaultConfig(), ...config };
    const { maxChunkSize, minChunkSize, overlap } = finalConfig;

    // 将文本按段落分割（考虑多种换行情况）
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      return [];
    }

    // 如果没有配置最大块大小，直接返回每个段落作为一个块
    if (maxChunkSize === undefined || maxChunkSize === null) {
      return paragraphs.map((paragraph, index) => ({
        content: paragraph,
        index,
      }));
    }

    // 处理段落合并和分割
    return this.processParagraphs(paragraphs, {
      maxChunkSize: finalConfig.maxChunkSize || 500,
      minChunkSize: finalConfig.minChunkSize || 50,
      overlap: finalConfig.overlap || 25,
      strategy: finalConfig.strategy ?? ChunkingStrategy.PARAGRAPH,
    });
  }

  /**
   * 处理段落的合并和分割
   */
  private processParagraphs(
    paragraphs: string[],
    config: Required<ChunkingConfig>,
  ): BaseChunkResult[] {
    const { maxChunkSize, minChunkSize, overlap } = config;
    const chunks: BaseChunkResult[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];

      // 如果当前段落本身就很长，需要分割
      if (paragraph.length > maxChunkSize) {
        // 先保存当前累积的块
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
          });
          currentChunk = '';
        }

        // 分割长段落
        const longParagraphChunks = this.splitLongParagraph(
          paragraph,
          chunkIndex,
          maxChunkSize,
          overlap,
        );
        chunks.push(...longParagraphChunks);
        chunkIndex += longParagraphChunks.length;
      }
      // 检查添加这个段落是否会超过最大块大小
      else if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
        // 可以添加到当前块
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        // 会超过最大块大小，先保存当前块
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++,
          });
        }

        // 开始新块
        currentChunk = paragraph;
      }
    }

    // 保存最后一个块
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex,
      });
    }

    // 处理小于最小块大小的块
    return this.mergeSmallChunks(chunks, minChunkSize);
  }

  /**
   * 分割过长的段落
   */
  private splitLongParagraph(
    paragraph: string,
    startIndex: number,
    maxChunkSize: number,
    overlap: number,
  ): BaseChunkResult[] {
    const chunks: BaseChunkResult[] = [];
    let startPos = 0;

    while (startPos < paragraph.length) {
      let endPos = startPos + maxChunkSize;

      // 如果不是最后一块，尝试在句号、分号或空格处分割
      if (endPos < paragraph.length) {
        // 优先在句号处分割
        let splitPos = paragraph.lastIndexOf('.', endPos);
        if (splitPos === -1 || splitPos < startPos + maxChunkSize * 0.5) {
          // 如果没有合适的句号，尝试在分号处分割
          splitPos = paragraph.lastIndexOf(';', endPos);
        }
        if (splitPos === -1 || splitPos < startPos + maxChunkSize * 0.5) {
          // 如果没有合适的分号，尝试在空格处分割
          splitPos = paragraph.lastIndexOf(' ', endPos);
        }

        if (splitPos > startPos + maxChunkSize * 0.5) {
          endPos = splitPos + 1;
        }
      }

      const chunkContent = paragraph.substring(startPos, endPos).trim();
      chunks.push({
        content: chunkContent,
        index: startIndex++,
      });

      // 设置下一个块的开始位置，考虑重叠
      startPos = Math.max(startPos + 1, endPos - overlap);
    }

    return chunks;
  }

  /**
   * 合并小于最小块大小的块
   */
  private mergeSmallChunks(
    chunks: BaseChunkResult[],
    minChunkSize: number,
  ): BaseChunkResult[] {
    if (minChunkSize <= 0) {
      return chunks;
    }

    const mergedChunks: BaseChunkResult[] = [];
    let currentChunk: BaseChunkResult | null = null;

    for (const chunk of chunks) {
      if (!currentChunk) {
        currentChunk = { ...chunk };
        continue;
      }

      // 如果当前块小于最小大小，尝试合并
      if (currentChunk.content.length < minChunkSize) {
        // 检查合并后是否仍然合理（不超过最小大小的3倍）
        if (
          currentChunk.content.length + chunk.content.length + 2 <=
          minChunkSize * 3
        ) {
          currentChunk.content += '\n\n' + chunk.content;
          continue;
        }
      }

      // 保存当前块并开始新块
      mergedChunks.push(currentChunk);
      currentChunk = { ...chunk };
    }

    if (currentChunk) {
      mergedChunks.push(currentChunk);
    }

    return mergedChunks;
  }

  getDefaultConfig(): ChunkingConfig {
    return {
      // Don't set a default maxChunkSize to allow each paragraph to be returned as a separate chunk
      maxChunkSize: undefined,
      minChunkSize: 50,
      overlap: 25,
    };
  }
}
