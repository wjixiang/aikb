import createLoggerWithPrefix from 'lib/logManagement/logger';
import {
  EmbeddingProviderBase,
  OpenAIEmbeddingProvider,
  AlibabaEmbeddingProvider,
  ONNXEmbeddingProvider,
} from './embedding-providers';
import { EmbeddingProvider } from './embedding';

const logger = createLoggerWithPrefix('EmbeddingManager');

// Configuration
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_API_BASE = process.env.EMBEDDING_API_BASE;
const ALIBABA_API_KEY = process.env.ALIBABA_API_KEY;

/**
 * Manager class for embedding providers initialization and collection
 */
export class EmbeddingManager {
  private static instance: EmbeddingManager;
  private providers: Map<EmbeddingProvider, EmbeddingProviderBase> = new Map();
  private isInitialized = false;

  private constructor() {}

  /**
   * Get the singleton instance of EmbeddingManager
   */
  public static getInstance(): EmbeddingManager {
    if (!EmbeddingManager.instance) {
      EmbeddingManager.instance = new EmbeddingManager();
    }
    return EmbeddingManager.instance;
  }

  /**
   * Initialize all available embedding providers
   * This should be called after project initialization
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('EmbeddingManager is already initialized');
      return;
    }

    logger.info('Initializing embedding providers...');

    // Initialize OpenAI provider if credentials are available
    if (EMBEDDING_API_KEY && EMBEDDING_API_BASE) {
      try {
        const openaiProvider = new OpenAIEmbeddingProvider(
          EMBEDDING_API_KEY,
          EMBEDDING_API_BASE,
        );
        this.providers.set(EmbeddingProvider.OPENAI, openaiProvider);
        logger.info('OpenAI embedding provider initialized');
      } catch (error) {
        logger.error('Failed to initialize OpenAI embedding provider:', error);
      }
    } else {
      logger.warn(
        'OpenAI API credentials not configured, skipping OpenAI provider initialization',
      );
    }

    // Initialize Alibaba provider if credentials are available
    if (ALIBABA_API_KEY) {
      try {
        const alibabaProvider = new AlibabaEmbeddingProvider(ALIBABA_API_KEY);
        this.providers.set(EmbeddingProvider.ALIBABA, alibabaProvider);
        logger.info('Alibaba embedding provider initialized');
      } catch (error) {
        logger.error('Failed to initialize Alibaba embedding provider:', error);
      }
    } else {
      logger.warn(
        'Alibaba API key not configured, skipping Alibaba provider initialization',
      );
    }

    // Initialize ONNX provider (always available as a fallback)
    try {
      const onnxProvider = new ONNXEmbeddingProvider();
      this.providers.set(EmbeddingProvider.ONNX, onnxProvider);
      logger.info('ONNX embedding provider initialized');
    } catch (error) {
      logger.error('Failed to initialize ONNX embedding provider:', error);
    }

    this.isInitialized = true;
    logger.info(
      `Embedding providers initialization completed. Available providers: ${Array.from(this.providers.keys()).join(', ')}`,
    );
  }

  /**
   * Get the collection of all initialized providers
   * @returns Map of provider type to provider instance
   */
  public getProviders(): Map<EmbeddingProvider, EmbeddingProviderBase> {
    if (!this.isInitialized) {
      logger.warn(
        'EmbeddingManager is not initialized. Call initialize() first.',
      );
      return new Map();
    }
    return new Map(this.providers); // Return a copy to prevent external modifications
  }

  /**
   * Get a specific provider instance
   * @param provider The provider type to get
   * @returns The provider instance or undefined if not available
   */
  public getProvider(
    provider: EmbeddingProvider,
  ): EmbeddingProviderBase | undefined {
    if (!this.isInitialized) {
      logger.warn(
        'EmbeddingManager is not initialized. Call initialize() first.',
      );
      return undefined;
    }
    return this.providers.get(provider);
  }

  /**
   * Check if a provider is available
   * @param provider The provider type to check
   * @returns True if the provider is available, false otherwise
   */
  public hasProvider(provider: EmbeddingProvider): boolean {
    if (!this.isInitialized) {
      logger.warn(
        'EmbeddingManager is not initialized. Call initialize() first.',
      );
      return false;
    }
    return this.providers.has(provider);
  }

  /**
   * Get all available provider types
   * @returns Array of available provider types
   */
  public getAvailableProviders(): EmbeddingProvider[] {
    if (!this.isInitialized) {
      logger.warn(
        'EmbeddingManager is not initialized. Call initialize() first.',
      );
      return [];
    }
    return Array.from(this.providers.keys());
  }

  /**
   * Check if the manager has been initialized
   * @returns True if initialized, false otherwise
   */
  public isManagerInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export the singleton instance for convenience
export const embeddingManager = EmbeddingManager.getInstance();
