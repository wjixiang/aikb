// Module exports
export { EmbeddingModule } from './lib/embedding.module';

// Service exports
export { EmbeddingService } from './lib/services/embedding.service';

// Controller exports
export { EmbeddingController } from './lib/controllers/embedding.controller';

// Interface and type exports
export type {
  EmbeddingRequest,
  EmbeddingResponse,
  BatchEmbeddingRequest,
  BatchEmbeddingResponse,
  ProviderInfo,
  EmbeddingModuleConfig,
  HealthCheckResponse,
  EmbeddingStats,
} from './lib/interfaces/embedding.interfaces';

// DTO exports
export {
  EmbeddingRequestDto,
  EmbeddingResponseDto,
  BatchEmbeddingRequestDto,
  BatchEmbeddingResponseDto,
  ProviderInfoDto,
  HealthCheckResponseDto,
  EmbeddingStatsDto,
} from './lib/dto/embedding.dto';

// Configuration exports
export { default as embeddingConfig } from './lib/config/embedding.config';
export { defaultEmbeddingModuleConfig } from './lib/interfaces/embedding.interfaces';
