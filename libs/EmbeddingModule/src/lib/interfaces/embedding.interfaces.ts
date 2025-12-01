import { EmbeddingProvider, OpenAIModel, AlibabaModel, OnnxModel } from 'embedding';

/**
 * Embedding request DTO
 */
export interface EmbeddingRequest {
  text: string | string[];
  provider?: EmbeddingProvider;
}

/**
 * Batch embedding request DTO
 */
export interface BatchEmbeddingRequest {
  texts: string[];
  provider?: EmbeddingProvider;
  concurrencyLimit?: number;
}

/**
 * Embedding response DTO
 */
export interface EmbeddingResponse {
  success: boolean;
  embedding?: number[];
  error?: string;
  provider?: EmbeddingProvider;
}

/**
 * Batch embedding response DTO
 */
export interface BatchEmbeddingResponse {
  success: boolean;
  embeddings?: (number[] | null)[];
  errors?: string[];
  provider?: EmbeddingProvider;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * Provider information DTO
 */
export interface ProviderInfo {
  provider: EmbeddingProvider;
  available: boolean;
  initialized: boolean;
}

/**
 * Embedding module configuration interface
 */
export interface EmbeddingModuleConfig {
  defaultProvider: EmbeddingProvider;
  defaultConcurrencyLimit: number;
  enableHealthCheck: boolean;
  healthCheckInterval: number;
}

/**
 * Default configuration for the embedding module
 */
export const defaultEmbeddingModuleConfig: EmbeddingModuleConfig = {
  defaultProvider: EmbeddingProvider.ALIBABA,
  defaultConcurrencyLimit: 5,
  enableHealthCheck: true,
  healthCheckInterval: 30000, // 30 seconds
};

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  providers: ProviderInfo[];
  timestamp: string;
}

/**
 * Embedding statistics interface
 */
export interface EmbeddingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  providerStats: Record<EmbeddingProvider, {
    requests: number;
    successes: number;
    failures: number;
    averageResponseTime: number;
  }>;
}