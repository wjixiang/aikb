// ============ Chunking Types ============

export interface ChunkResult {
  content: string;
  index: number;
}

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
  separators?: string[];
}

// Default separators for text splitting
const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '。', '！', '？', '; ', '； ', ', ', '， '];

// ============ Chunking Functions ============

/**
 * Split text by paragraphs
 */
export function chunkByParagraph(text: string, options: ChunkOptions = {}): ChunkResult[] {
  const { maxChunkSize = 1000, overlap = 100 } = options;
  const separators = options.separators || DEFAULT_SEPARATORS;

  // First split by double newlines (paragraphs)
  let chunks = text.split(/\n\n+/);

  // If chunks are too large, split further
  const results: ChunkResult[] = [];
  let index = 0;

  for (const chunk of chunks) {
    if (chunk.length <= maxChunkSize) {
      if (chunk.trim()) {
        results.push({ content: chunk.trim(), index: index++ });
      }
    } else {
      // Split large chunks
      const subChunks = splitBySeparators(chunk, separators, maxChunkSize, overlap);
      for (const subChunk of subChunks) {
        if (subChunk.trim()) {
          results.push({ content: subChunk.trim(), index: index++ });
        }
      }
    }
  }

  return results;
}

/**
 * Split text by sentences
 */
export function chunkBySentence(text: string, options: ChunkOptions = {}): ChunkResult[] {
  const { maxChunkSize = 500, overlap = 50 } = options;
  const separators = options.separators || ['. ', '。', '！', '？', '? ', '! '];

  const subChunks = splitBySeparators(text, separators, maxChunkSize, overlap);

  return subChunks
    .filter(c => c.trim())
    .map((content, index) => ({ content: content.trim(), index }));
}

/**
 * Split text by fixed size (for cases where semantic chunking is not needed)
 */
export function chunkBySize(text: string, options: ChunkOptions = {}): ChunkResult[] {
  const { maxChunkSize = 500, overlap = 50 } = options;

  const results: ChunkResult[] = [];
  let index = 0;

  for (let i = 0; i < text.length; i += maxChunkSize - overlap) {
    const chunk = text.slice(i, i + maxChunkSize);
    if (chunk.trim()) {
      results.push({ content: chunk.trim(), index: index++ });
    }
  }

  return results;
}

// ============ Helper Functions ============

function splitBySeparators(
  text: string,
  separators: string[],
  maxChunkSize: number,
  overlap: number
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const results: string[] = [];
  let currentChunk = '';

  for (const separator of separators) {
    if (text.includes(separator)) {
      const parts = text.split(separator);

      for (const part of parts) {
        if (currentChunk.length + part.length + separator.length > maxChunkSize && currentChunk) {
          results.push(currentChunk);
          currentChunk = part;
        } else {
          currentChunk += (currentChunk ? separator : '') + part;
        }
      }

      if (currentChunk) {
        results.push(currentChunk);
      }

      return results;
    }
  }

  // If no separators found, use fixed size split
  for (let i = 0; i < text.length; i += maxChunkSize - overlap) {
    results.push(text.slice(i, i + maxChunkSize));
  }

  return results;
}

// ============ Main Export ============

export interface TextChunker {
  (text: string, options?: ChunkOptions): ChunkResult[];
}

export const chunkers: Record<string, TextChunker> = {
  paragraph: chunkByParagraph,
  sentence: chunkBySentence,
  size: chunkBySize,
};

/**
 * Main chunking function with configurable strategy
 */
export function chunkText(text: string, strategy: string = 'paragraph', options?: ChunkOptions): ChunkResult[] {
  const chunker = chunkers[strategy];
  if (!chunker) {
    throw new Error(`Unknown chunking strategy: ${strategy}. Available: ${Object.keys(chunkers).join(', ')}`);
  }
  return chunker(text, options);
}
