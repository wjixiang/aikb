import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '../src/lib/services/embedding.service';
import { EmbeddingProvider } from 'embedding';

/**
 * Example service demonstrating how to use EmbeddingModule
 */
@Injectable()
export class UsageExampleService {
  private readonly logger = new Logger(UsageExampleService.name);

  constructor(private readonly embeddingService: EmbeddingService) {}

  /**
   * Example: Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    this.logger.log(`Generating embedding for text: "${text.substring(0, 50)}..."`);
    
    const result = await this.embeddingService.embed({
      text,
      provider: EmbeddingProvider.ALIBABA,
    });

    if (result.success && result.embedding) {
      this.logger.log(`Successfully generated embedding with ${result.embedding.length} dimensions`);
      return result.embedding;
    } else {
      this.logger.error(`Failed to generate embedding: ${result.error}`);
      return null;
    }
  }

  /**
   * Example: Generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    this.logger.log(`Generating batch embeddings for ${texts.length} texts`);
    
    const result = await this.embeddingService.embedBatch({
      texts,
      provider: EmbeddingProvider.ALIBABA,
      concurrencyLimit: 3,
    });

    this.logger.log(`Batch embedding completed: ${result.successCount}/${result.totalCount} successful`);
    return result.embeddings || [];
  }

  /**
   * Example: Switch between providers based on availability
   */
  async getEmbeddingWithFallback(text: string): Promise<number[] | null> {
    // Try Alibaba first
    let result = await this.embeddingService.embed({
      text,
      provider: EmbeddingProvider.ALIBABA,
    });

    // Fallback to ONNX if Alibaba fails
    if (!result.success) {
      this.logger.warn('Alibaba provider failed, trying ONNX fallback');
      result = await this.embeddingService.embed({
        text,
        provider: EmbeddingProvider.ONNX,
      });
    }

    return result.success && result.embedding ? result.embedding : null;
  }

  /**
   * Example: Monitor service health and statistics
   */
  async getServiceStatus(): Promise<{
    health: any;
    stats: any;
    providers: any[];
  }> {
    const [health, stats, providers] = await Promise.all([
      this.embeddingService.healthCheck(),
      Promise.resolve(this.embeddingService.getStats()),
      Promise.resolve(this.embeddingService.getProviderInfo()),
    ]);

    return {
      health,
      stats,
      providers,
    };
  }

  /**
   * Example: Dynamic provider switching based on text length
   */
  async generateOptimizedEmbedding(text: string): Promise<number[] | null> {
    // Use different providers based on text characteristics
    let provider: EmbeddingProvider;
    
    if (text.length < 100) {
      // Short texts: Use fast provider
      provider = EmbeddingProvider.ALIBABA;
    } else if (text.length < 1000) {
      // Medium texts: Use balanced provider
      provider = EmbeddingProvider.OPENAI;
    } else {
      // Long texts: Use local provider for better control
      provider = EmbeddingProvider.ONNX;
    }

    this.logger.log(`Using provider ${provider} for text of length ${text.length}`);

    const result = await this.embeddingService.embed({
      text,
      provider,
    });

    return result.success && result.embedding ? result.embedding : null;
  }

  /**
   * Example: Reset statistics periodically
   */
  resetServiceStats(): void {
    this.logger.log('Resetting embedding service statistics');
    this.embeddingService.resetStats();
  }
}