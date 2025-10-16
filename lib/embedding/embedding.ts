import createLoggerWithPrefix from '../logger';
import { embeddingManager } from './embedding-manager';
import { EmbeddingProviderBase } from './embedding-providers';

const logger = createLoggerWithPrefix('Embedding');

// Configuration
const CONCURRENCY_LIMIT = parseInt(
  process.env.EMBEDDING_CONCURRENCY_LIMIT || '5',
);

// Embedding provider types
/**
 * - 'openai'
 * - 'alibaba':
 * - 'onnx': Local embedding
 */
export type EmbeddingProvider = 'openai' | 'alibaba' | 'onnx';

// Re-export the provider base class and implementations for convenience
export { EmbeddingProviderBase } from './embedding-providers';

export { embeddingManager, EmbeddingManager } from './embedding-manager';

export class Embedding {
  private activeProvider: EmbeddingProvider = 'alibaba'; // Default to alibaba

  constructor() {
    // Check if manager is initialized, if not, initialize it
    if (!embeddingManager.isManagerInitialized()) {
      logger.warn('EmbeddingManager is not initialized. Initializing now...');
      embeddingManager.initialize();
    }
  }

  /**
   * Set the active embedding provider
   * @param provider One of: 'openai', 'alibaba', 'onnx'
   */
  public setProvider(provider: EmbeddingProvider): void {
    if (!embeddingManager.hasProvider(provider)) {
      logger.error(`Provider ${provider} is not available`);
      return;
    }
    this.activeProvider = provider;
  }

  /**
   * Get the current active embedding provider
   * @returns The active embedding provider
   */
  public getProvider(): EmbeddingProvider {
    return this.activeProvider;
  }

  /**
   * Get a specific provider instance
   * @param provider The provider type to get
   * @returns The provider instance or undefined if not available
   */
  public getProviderInstance(
    provider: EmbeddingProvider,
  ): EmbeddingProviderBase | undefined {
    return embeddingManager.getProvider(provider);
  }

  /**
   * Generate embedding for the given text using the active provider
   * @param text Input text or array of texts to embed
   * @param provider Optional provider to use for this specific call (overrides active provider)
   * @returns Embedding vector as number array or null if failed
   */
  public async embed(
    text: string | string[],
    provider?: EmbeddingProvider,
  ): Promise<number[] | null> {
    const targetProvider = provider || this.activeProvider;
    const providerInstance = embeddingManager.getProvider(targetProvider);

    if (!providerInstance) {
      logger.error(`Provider ${targetProvider} is not available`);
      return null;
    }

    return providerInstance.embed(text);
  }

  /**
   * Generate embeddings for multiple texts with concurrency control
   * @param texts Array of texts to embed
   * @param provider Optional provider to use for this specific call
   * @param concurrencyLimit Maximum number of concurrent requests
   * @returns Array of embedding vectors or null for failed requests
   */
  public async embedBatch(
    texts: string[],
    provider?: EmbeddingProvider,
    concurrencyLimit: number = CONCURRENCY_LIMIT,
  ): Promise<(number[] | null)[]> {
    const targetProvider = provider || this.activeProvider;
    const providerInstance = embeddingManager.getProvider(targetProvider);

    if (!providerInstance) {
      logger.error(`Provider ${targetProvider} is not available`);
      return new Array(texts.length).fill(null);
    }

    return providerInstance.embedBatch(texts, concurrencyLimit);
  }
}

// Export a singleton instance for convenience
export const embeddingService = new Embedding();
