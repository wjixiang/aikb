// Main exports
export {
  Embedding,
  EmbeddingProvider,
  OpenAIModel,
  AlibabaModel,
  OnnxModel,
  type EmbeddingConfig,
  defaultEmbeddingConfig,
  embeddingService,
} from './embedding.js';

export { EmbeddingManager, embeddingManager } from './embedding-manager.js';

export {
  EmbeddingProviderBase,
  OpenAIEmbeddingProvider,
  AlibabaEmbeddingProvider,
  ONNXEmbeddingProvider,
} from './embedding-providers.js';
