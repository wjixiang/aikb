import type { EmbeddingConfig, IEmbeddingProvider } from './types.js';

interface OllamaEmbeddingRequest {
  model: string;
  input: string | string[];
}

interface OllamaEmbeddingResponse {
  embeddings: number[][];
}

export class OllamaEmbeddingProvider implements IEmbeddingProvider {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async embed(text: string | string[], config: EmbeddingConfig): Promise<number[] | null> {
    const texts = Array.isArray(text) ? text : [text];
    const results = await this.embedBatch(texts, config);
    return results[0] || null;
  }

  async embedBatch(texts: string[], config: EmbeddingConfig): Promise<(number[] | null)[]> {
    const url = `${this.baseUrl}/api/embed`;

    const request: OllamaEmbeddingRequest = {
      model: config.model,
      input: texts,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(config.timeout),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data: OllamaEmbeddingResponse = await response.json();

        if (!data.embeddings || !Array.isArray(data.embeddings)) {
          throw new Error('Invalid Ollama response: missing embeddings array');
        }

        return data.embeddings;
      } catch (error) {
        lastError = error as Error;
        console.error(`Ollama embedding attempt ${attempt + 1} failed:`, error);

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
