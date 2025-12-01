import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Embedding,
  EmbeddingProvider,
  embeddingManager,
  embeddingService as baseEmbeddingService,
  EmbeddingModel,
} from 'embedding';
import { createLoggerWithPrefix } from 'log-management';
import {
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
  ProviderInfo,
  HealthCheckResponse,
  EmbeddingStats,
  EmbeddingModuleConfig,
  defaultEmbeddingModuleConfig,
} from '../interfaces/embedding.interfaces';

const logger = createLoggerWithPrefix('EmbeddingService');

@Injectable()
export class EmbeddingService implements OnModuleInit, OnModuleDestroy {
  private embedding: Embedding;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private stats: EmbeddingStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    providerStats: {
      [EmbeddingProvider.OPENAI]: {
        requests: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
      },
      [EmbeddingProvider.ALIBABA]: {
        requests: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
      },
      [EmbeddingProvider.ONNX]: {
        requests: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
      },
    },
  };

  constructor(private readonly configService: ConfigService) {
    this.embedding = baseEmbeddingService;
  }

  /**
   * Get default configuration from environment variables
   */
  public getDefaultConfig(): EmbeddingModuleConfig {
    const config = this.configService.get<EmbeddingModuleConfig>('embedding');

    if (config) {
      return config;
    }

    // Fallback to environment variables if config is not available
    return {
      defaultProvider:
        (this.configService.get(
          'EMBEDDING_DEFAULT_PROVIDER',
        ) as EmbeddingProvider) || defaultEmbeddingModuleConfig.defaultProvider,
      defaultModel:
        (this.configService.get('EMBEDDING_DEFAULT_MODEL') as EmbeddingModel) ||
        defaultEmbeddingModuleConfig.defaultModel,
      defaultConcurrencyLimit: parseInt(
        this.configService.get('EMBEDDING_DEFAULT_CONCURRENCY_LIMIT') || '5',
        10,
      ),
      enableHealthCheck:
        this.configService.get('EMBEDDING_ENABLE_HEALTH_CHECK') === 'true' ||
        defaultEmbeddingModuleConfig.enableHealthCheck,
      healthCheckInterval: parseInt(
        this.configService.get('EMBEDDING_HEALTH_CHECK_INTERVAL') || '30000',
        10,
      ),
    };
  }

  async onModuleInit() {
    logger.info('Initializing EmbeddingService...');

    // Get configuration from environment variables
    const config = this.getDefaultConfig();
    logger.info('Using configuration:', config);

    // Initialize the embedding manager if not already initialized
    if (!embeddingManager.isManagerInitialized()) {
      logger.info('Initializing embedding manager...');
      embeddingManager.initialize();
    }

    // Set default provider from configuration
    this.embedding.setProvider(config.defaultProvider);
    logger.info(`Set default provider to: ${config.defaultProvider}`);

    // Start health check if enabled
    if (config.enableHealthCheck) {
      this.startHealthCheck(config.healthCheckInterval);
    }

    logger.info('EmbeddingService initialized successfully');
  }

  async onModuleDestroy() {
    logger.info('Shutting down EmbeddingService...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('EmbeddingService shut down successfully');
  }

  /**
   * Generate embedding for a single text or array of texts
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    const provider = request.provider || this.embedding.getProvider();

    try {
      this.stats.totalRequests++;
      this.stats.providerStats[provider].requests++;

      const embedding = await this.embedding.embed(request.text, provider);
      const responseTime = Date.now() - startTime;

      if (embedding) {
        this.stats.successfulRequests++;
        this.stats.providerStats[provider].successes++;
        this.updateAverageResponseTime(responseTime, provider);

        logger.debug(
          `Successfully generated embedding using ${provider} provider`,
        );
        return {
          success: true,
          embedding,
          provider,
        };
      } else {
        this.stats.failedRequests++;
        this.stats.providerStats[provider].failures++;

        logger.error(`Failed to generate embedding using ${provider} provider`);
        return {
          success: false,
          error: `Failed to generate embedding using ${provider} provider`,
          provider,
        };
      }
    } catch (error) {
      this.stats.failedRequests++;
      this.stats.providerStats[provider].failures++;
      const responseTime = Date.now() - startTime;

      logger.error(`Error generating embedding:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        provider,
      };
    }
  }

  /**
   * Generate embeddings for multiple texts with concurrency control
   */
  async embedBatch(
    request: BatchEmbeddingRequest,
  ): Promise<BatchEmbeddingResponse> {
    const startTime = Date.now();
    const provider = request.provider || this.embedding.getProvider();
    const concurrencyLimit =
      request.concurrencyLimit ||
      this.configService.get<EmbeddingModuleConfig>('embedding')
        ?.defaultConcurrencyLimit ||
      5;

    try {
      this.stats.totalRequests += request.texts.length;
      this.stats.providerStats[provider].requests += request.texts.length;

      const embeddings = await this.embedding.embedBatch(
        request.texts,
        provider,
        concurrencyLimit,
      );
      const responseTime = Date.now() - startTime;

      const successCount = embeddings.filter((e) => e !== null).length;
      const failureCount = embeddings.length - successCount;

      this.stats.successfulRequests += successCount;
      this.stats.failedRequests += failureCount;
      this.stats.providerStats[provider].successes += successCount;
      this.stats.providerStats[provider].failures += failureCount;
      this.updateAverageResponseTime(responseTime, provider);

      logger.debug(
        `Batch embedding completed: ${successCount}/${embeddings.length} successful using ${provider} provider`,
      );

      return {
        success: successCount > 0,
        embeddings,
        provider,
        totalCount: embeddings.length,
        successCount,
        failureCount,
      };
    } catch (error) {
      this.stats.failedRequests += request.texts.length;
      this.stats.providerStats[provider].failures += request.texts.length;

      logger.error(`Error in batch embedding:`, error);
      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown error occurred',
        ],
        provider,
        totalCount: request.texts.length,
        successCount: 0,
        failureCount: request.texts.length,
      };
    }
  }

  /**
   * Set the active embedding provider
   */
  setProvider(provider: EmbeddingProvider): boolean {
    try {
      this.embedding.setProvider(provider);
      logger.info(`Provider set to: ${provider}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set provider to ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get the current active embedding provider
   */
  getProvider(): EmbeddingProvider {
    return this.embedding.getProvider();
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): EmbeddingProvider[] {
    if (!embeddingManager.isManagerInitialized()) {
      return [];
    }
    return embeddingManager.getAvailableProviders();
  }

  /**
   * Get provider information
   */
  getProviderInfo(): ProviderInfo[] {
    const availableProviders = this.getAvailableProviders();
    const allProviders = Object.values(EmbeddingProvider);

    return allProviders.map((provider) => ({
      provider,
      available: availableProviders.includes(provider),
      initialized: embeddingManager.hasProvider(provider),
    }));
  }

  /**
   * Perform health check on all providers
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const providers = this.getProviderInfo();
    const timestamp = new Date().toISOString();

    // Simple health check - if at least one provider is available, consider it healthy
    const isHealthy = providers.some((p) => p.available && p.initialized);

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      providers,
      timestamp,
    };
  }

  /**
   * Get embedding statistics
   */
  getStats(): EmbeddingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      providerStats: {
        [EmbeddingProvider.OPENAI]: {
          requests: 0,
          successes: 0,
          failures: 0,
          averageResponseTime: 0,
        },
        [EmbeddingProvider.ALIBABA]: {
          requests: 0,
          successes: 0,
          failures: 0,
          averageResponseTime: 0,
        },
        [EmbeddingProvider.ONNX]: {
          requests: 0,
          successes: 0,
          failures: 0,
          averageResponseTime: 0,
        },
      },
    };
    logger.info('Statistics reset');
  }

  private startHealthCheck(interval: number): void {
    logger.info(`Starting health check with interval: ${interval}ms`);

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (health.status === 'unhealthy') {
          logger.warn('Embedding service health check failed', health);
        }
      } catch (error) {
        logger.error('Health check error:', error);
      }
    }, interval);
  }

  private updateAverageResponseTime(
    responseTime: number,
    provider: EmbeddingProvider,
  ): void {
    const providerStats = this.stats.providerStats[provider];
    const totalRequests = providerStats.requests;

    if (totalRequests === 1) {
      providerStats.averageResponseTime = responseTime;
    } else {
      providerStats.averageResponseTime =
        (providerStats.averageResponseTime * (totalRequests - 1) +
          responseTime) /
        totalRequests;
    }

    // Update overall average response time
    if (this.stats.totalRequests === 1) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime =
        (this.stats.averageResponseTime * (this.stats.totalRequests - 1) +
          responseTime) /
        this.stats.totalRequests;
    }
  }
}
