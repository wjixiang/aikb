// ============ Types ============

export enum EmbeddingProvider {
  OPENAI = 'openai',
  ALIBABA = 'alibaba',
  OLLAMA = 'ollama',
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model: string;
  dimension: number;
  batchSize: number;
  maxRetries: number;
  timeout: number;
}

export const defaultEmbeddingConfig: EmbeddingConfig = {
  provider: EmbeddingProvider.ALIBABA,
  model: 'text-embedding-v4',
  dimension: 1024,
  batchSize: 20,
  maxRetries: 3,
  timeout: 20000,
};

// ============ Embedding Interface ============

export interface IEmbeddingProvider {
  embed(text: string | string[], config: EmbeddingConfig): Promise<number[] | null>;
  embedBatch(texts: string[], config: EmbeddingConfig): Promise<(number[] | null)[]>;
}

// ============ Embedding Result ============

export interface EmbedResult {
  success: boolean;
  embedding?: number[];
  error?: string;
}

export interface BatchEmbedResult {
  results: EmbedResult[];
  successCount: number;
  errorCount: number;
}
