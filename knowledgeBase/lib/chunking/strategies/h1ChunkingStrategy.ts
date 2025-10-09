import { BaseChunkingStrategy, ChunkingConfig, TitledChunkResult } from '../chunkingStrategy';

/**
 * 基于H1标题的文本切片策略
 * 将markdown文本按照H1标题进行切分
 */
export class H1ChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'h1';
  readonly description = '基于H1标题的markdown文本切片策略';
  readonly version = '1.0.0';

  /**
   * 检查文本是否包含H1标题
   */
  canHandle(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }
    const h1Regex = /^# .+$/gm;
    return h1Regex.test(text);
  }

  /**
   * 基于H1标题将文本切分为多个块
   */
  chunk(text: string, config?: ChunkingConfig): TitledChunkResult[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // 使用正则表达式匹配所有的H1标题
    const h1Regex = /^# (.+)$/gm;
    const matches = [...text.matchAll(h1Regex)];
    
    if (matches.length === 0) {
      // 如果没有找到H1标题，返回整个文本作为一个块
      return [{
        title: 'Untitled',
        content: text.trim(),
        index: 0
      }];
    }

    const chunks: TitledChunkResult[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const title = match[1].trim();
      const startIndex = match.index || 0;
      
      // 确定内容结束位置：下一个H1标题的开始位置或文本末尾
      let endIndex = text.length;
      if (i < matches.length - 1) {
        endIndex = matches[i + 1].index || text.length;
      }
      
      // 提取内容（包括H1标题）
      let content = text.substring(startIndex, endIndex).trim();
      
      // 如果配置了最大块大小，检查是否需要进一步分割
      if (config?.maxChunkSize && content.length > config.maxChunkSize) {
        const subChunks = this.splitLargeContent(content, title, i, config);
        chunks.push(...subChunks);
      } else {
        chunks.push({
          title,
          content,
          index: i
        });
      }
    }
    
    return chunks;
  }

  /**
   * 分割过大的内容块
   */
  private splitLargeContent(
    content: string, 
    baseTitle: string, 
    baseIndex: number, 
    config: ChunkingConfig
  ): TitledChunkResult[] {
    const chunks: TitledChunkResult[] = [];
    const maxChunkSize = config.maxChunkSize!;
    const overlap = config.overlap || 50;
    
    // 移除H1标题，因为我们会重新添加
    const titleMatch = content.match(/^# .+$/m);
    const titleLine = titleMatch ? titleMatch[0] : '';
    const contentWithoutTitle = titleMatch ? content.replace(titleLine, '').trim() : content;
    
    let startIndex = 0;
    let chunkIndex = 0;
    
    while (startIndex < contentWithoutTitle.length) {
      let endIndex = startIndex + maxChunkSize;
      
      // 如果不是最后一块，尝试在句号、换行符或空格处分割
      if (endIndex < contentWithoutTitle.length) {
        // 优先在句号处分割
        let splitIndex = contentWithoutTitle.lastIndexOf('.', endIndex);
        if (splitIndex === -1 || splitIndex < startIndex + maxChunkSize * 0.5) {
          // 如果没有合适的句号，尝试在换行符处分割
          splitIndex = contentWithoutTitle.lastIndexOf('\n', endIndex);
        }
        if (splitIndex === -1 || splitIndex < startIndex + maxChunkSize * 0.5) {
          // 如果没有合适的换行符，在空格处分割
          splitIndex = contentWithoutTitle.lastIndexOf(' ', endIndex);
        }
        
        if (splitIndex > startIndex + maxChunkSize * 0.5) {
          endIndex = splitIndex + 1;
        }
      }
      
      const chunkContent = contentWithoutTitle.substring(startIndex, endIndex).trim();
      const chunkTitle = chunkIndex === 0 ? baseTitle : `${baseTitle} (Part ${chunkIndex + 1})`;
      
      chunks.push({
        title: chunkTitle,
        content: titleLine ? `${titleLine}\n\n${chunkContent}` : chunkContent,
        index: baseIndex + chunkIndex * 0.1 // 使用小数确保排序正确
      });
      
      // 设置下一个块的开始位置，考虑重叠
      startIndex = Math.max(startIndex + 1, endIndex - overlap);
      chunkIndex++;
    }
    
    return chunks;
  }
}