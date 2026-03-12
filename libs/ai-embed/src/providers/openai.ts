import type { EmbeddingConfig, IEmbeddingProvider } from './types.js';

export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = baseUrl || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  }

  async embed(text: string | string[], config: EmbeddingConfig): Promise<number[] | null> {
    const texts = Array.isArray(text) ? text : [text];
    const results = await this.embedBatch(texts, config);
    return results[0] || null;
  }

  async embedBatch(texts: string[], config: EmbeddingConfig): Promise<(number[] | null)[]> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const results: (number[] | null)[] = new Array(texts.length).fill(null);

    // Process in batches
    for (let i = 0; i < texts.length; i += config.batchSize) {
      const batch = texts.slice(i, i + config.batchSize);
      const batchResults = await this.embedBatchInternal(batch, config);

      for (let j = 0; j < batchResults.length; j++) {
        results[i + j] = batchResults[j];
      }
    }

    return results;
  }

  private async embedBatchInternal(texts: string[], config: EmbeddingConfig): Promise<(number[] | null)[]> {
    const url = `${this.baseUrl}/embeddings`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            input: texts,
            model: config.model,
            dimensions: config.dimension,
          }),
          signal: AbortSignal.timeout(config.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Map results back to input order
        const results = new Array(texts.length).fill(null);
        for (const embedding of data.data) {
          results[embedding.index] = embedding.embedding;
        }

        return results;
      } catch (error) {
        lastError = error as Error;
        console.error(`Embedding attempt ${attempt + 1} failed:`, error);

        if (attempt < config.maxRetries - 1) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    console.error(`All ${config.maxRetries} attempts failed:`, lastError);
    return new Array(texts.length).fill(null);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
