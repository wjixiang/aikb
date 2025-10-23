// Export the main worker class and factory functions
export {
  ChunkingEmbeddingWorker,
  createChunkingEmbeddingWorker,
  stopChunkingEmbeddingWorker,
} from './chunking-embedding.worker';

// Export the processor class
export { ChunkingEmbeddingProcessor } from './chunking-embedding.processor';

// Export processing options type
export type { ProcessingOptions } from './chunking-embedding.processor';
