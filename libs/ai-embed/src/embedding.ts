import type { EmbeddingConfig, IEmbeddingProvider, EmbedResult, BatchEmbedResult } from './types.js';
import { defaultEmbeddingConfig, EmbeddingProvider } from './types.js';
import { AlibabaEmbeddingProvider } from './providers/alibaba.js';
import { OpenAIEmbeddingProvider } from './providers/openai.js';

export class Embedding {
  private providers: Map<EmbeddingProvider, IEmbeddingProvider> = new Map();
  private defaultProvider: EmbeddingProvider;

  constructor(defaultProvider: EmbeddingProvider = EmbeddingProvider.ALIBABA) {
    // Initialize providers
    this.providers.set(EmbeddingProvider.ALIBABA, new AlibabaEmbeddingProvider());
    this.providers.set(EmbeddingProvider.OPENAI, new OpenAIEmbeddingProvider());

    this.defaultProvider = defaultProvider;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string, config?: Partial<EmbeddingConfig>): Promise<EmbedResult> {
    const fullConfig = { ...defaultEmbeddingConfig, ...config };
    const provider = this.providers.get(fullConfig.provider);

    if (!provider) {
      return { success: false, error: `Provider ${fullConfig.provider} not found` };
    }

    try {
      const embedding = await provider.embed(text, fullConfig);
      if (!embedding) {
        return { success: false, error: 'Embedding generation failed' };
      }
      return { success: true, embedding };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[], config?: Partial<EmbeddingConfig>): Promise<BatchEmbedResult> {
    const fullConfig = { ...defaultEmbeddingConfig, ...config };
    const provider = this.providers.get(fullConfig.provider);

    if (!provider) {
      return {
        results: texts.map(() => ({ success: false, error: `Provider ${fullConfig.provider} not found` })),
        successCount: 0,
        errorCount: texts.length,
      };
    }

    try {
      const embeddings = await provider.embedBatch(texts, fullConfig);

      const results = embeddings.map((embedding, index) => {
        if (embedding) {
          return { success: true, embedding };
        }
        return { success: false, error: 'Embedding generation failed', index };
      });

      return {
        results,
        successCount: embeddings.filter(Boolean).length,
        errorCount: embeddings.filter(e => !e).length,
      };
    } catch (error) {
      return {
        results: texts.map(() => ({ success: false, error: (error as Error).message })),
        successCount: 0,
        errorCount: texts.length,
      };
    }
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: EmbeddingProvider): void {
    this.defaultProvider = provider;
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): EmbeddingProvider {
    return this.defaultProvider;
  }
}

// Export singleton instance
export const embedding = new Embedding();
