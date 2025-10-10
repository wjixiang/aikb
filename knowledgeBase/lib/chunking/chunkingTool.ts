/**
 * 基于H1大纲的文本切片功能
 * 将markdown文本按照H1标题进行切分
 */

export interface ChunkResult {
  title: string;
  content: string;
  index: number;
}

/**
 * 基于H1标题将文本切分为多个块
 * @param text markdown格式的文本，所有大纲均为H1
 * @returns 切分后的文本块数组
 */
export function h1Chunking(text: string): ChunkResult[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 使用正则表达式匹配所有的H1标题
  const h1Regex = /^# (.+)$/gm;
  const matches = [...text.matchAll(h1Regex)];

  if (matches.length === 0) {
    // 如果没有找到H1标题，返回整个文本作为一个块
    return [
      {
        title: 'Untitled',
        content: text.trim(),
        index: 0,
      },
    ];
  }

  const chunks: ChunkResult[] = [];

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
    const content = text.substring(startIndex, endIndex).trim();

    chunks.push({
      title,
      content,
      index: i,
    });
  }

  return chunks;
}

/**
 * 基于段落的文本切片功能
 * @param text 输入文本
 * @returns 切分后的段落数组
 */
export function paragraphChunking(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // 将文本按段落分割（考虑多种换行情况）
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paragraphs;
}

/**
 * 通用文本切片函数
 * @param text 输入文本
 * @param strategy 切片策略：'h1' 或 'paragraph'
 * @returns 切片结果
 */
export function chunkText(
  text: string,
  strategy: 'h1' | 'paragraph' = 'h1',
): ChunkResult[] | string[] {
  switch (strategy) {
    case 'h1':
      return h1Chunking(text);
    case 'paragraph':
      return paragraphChunking(text);
    default:
      throw new Error(`Unsupported chunking strategy: ${strategy}`);
  }
}
