import { registerAs } from '@nestjs/config';
import {
  EmbeddingModuleConfig,
  defaultEmbeddingModuleConfig,
} from '../interfaces/embedding.interfaces';

export default registerAs('embedding', (): EmbeddingModuleConfig => {
  return {
    defaultProvider:
      (process.env['EMBEDDING_DEFAULT_PROVIDER'] as any) ||
      defaultEmbeddingModuleConfig.defaultProvider,
    defaultConcurrencyLimit: parseInt(
      process.env['EMBEDDING_DEFAULT_CONCURRENCY_LIMIT'] || '5',
      10,
    ),
    enableHealthCheck:
      process.env['EMBEDDING_ENABLE_HEALTH_CHECK'] === 'true' ||
      defaultEmbeddingModuleConfig.enableHealthCheck,
    healthCheckInterval: parseInt(
      process.env['EMBEDDING_HEALTH_CHECK_INTERVAL'] || '30000',
      10,
    ),
  };
});
