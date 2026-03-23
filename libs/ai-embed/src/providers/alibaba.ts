import type { EmbeddingConfig, IEmbeddingProvider } from '../types.js';

interface AlibabaEmbeddingRequest {
  input: string[];
  model: string;
}

interface AlibabaEmbeddingResponse {
  code: string;
  message: string;
  request_id: string;
  data: {
    embeddings: Array<{
      embedding: number[];
      index: number;
    }>;
  };
}

export class AlibabaEmbeddingProvider implements IEmbeddingProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ALIBABA_API_KEY || '';
    this.baseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  }

  async embed(text: string | string[], config: EmbeddingConfig): Promise<number[] | null> {
    const texts = Array.isArray(text) ? text : [text];
    const results = await this.embedBatch(texts, config);
    return results[0] || null;
  }

  async embedBatch(texts: string[], config: EmbeddingConfig): Promise<(number[] | null)[]> {
    if (!this.apiKey) {
      throw new Error('ALIBABA_API_KEY is not set');
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

    const request: AlibabaEmbeddingRequest = {
      input: texts,
      model: config.model,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(config.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data: any = await response.json();

        // Debug log
        console.log('Alibaba API response:', JSON.stringify(data).substring(0, 500));

        // Handle different response formats from Alibaba
        let embeddingsArray: Array<{ embedding: number[]; index: number }>;

        if (data.code && data.code !== 'Success' && data.code !== 'success') {
          throw new Error(`Alibaba API error: ${data.code} - ${data.message}`);
        }

        // Format 1: {"data":[{"embedding":[...]}]}
        if (data.data && Array.isArray(data.data)) {
          embeddingsArray = data.data.map((item: any, index: number) => ({
            embedding: item.embedding || item,
            index
          }));
        }
        // Format 2: {"data":{"embeddings":[{"embedding":[...],"index":0}]}}
        else if (data.data && Array.isArray(data.data.embeddings)) {
          embeddingsArray = data.data.embeddings;
        }
        // Format 3: {"data":{"output":{"embeddings":[...]}}}
        else if (data.data && data.data.output && Array.isArray(data.data.output.embeddings)) {
          embeddingsArray = data.data.output.embeddings;
        }
        // Format 4: {"output":{"embeddings":[...]}}
        else if (data.output && Array.isArray(data.output.embeddings)) {
          embeddingsArray = data.output.embeddings;
        }
        else {
          console.error('Unexpected response format:', JSON.stringify(data).substring(0, 500));
          throw new Error('Unexpected response format from Alibaba API');
        }

        // Map results back to input order
        const results = new Array(texts.length).fill(null);
        for (const embedding of embeddingsArray) {
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
