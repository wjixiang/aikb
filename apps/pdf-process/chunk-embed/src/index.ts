// Main worker exports
export { ChunkingEmbeddingWorker, createChunkingEmbeddingWorker, stopChunkingEmbeddingWorker } from './chunk-embedding.worker';

// Processor exports
export { ChunkingEmbeddingProcessor } from './chunking-embedding.processor';

// Service exports
export { RabbitMQService } from './rabbitmq.service';
export { AmqpMessageService } from './amqp-message-service';
export { StompMessageService } from './stomp-message-service';
export { createMessageService } from './message-service-factory';

// Interface exports
export type { IMessageService, MessageProtocol, ConnectionStatus, HealthCheckResult, QueueInfo, ConsumerOptions, MessageConsumer } from './message-service.interface';
export type { IRabbitMQService } from './rabbitmq-service.interface';

// Type exports
export type {
  BaseRabbitMQMessage,
  ChunkingEmbeddingRequestMessage,
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  MultiVersionChunkingEmbeddingProgressMessage,
  MultiVersionChunkingEmbeddingCompletedMessage,
  PdfProcessingStatus,
} from './message.types';

// Constant exports
export {
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_EXCHANGES,
} from './message.types';

// Re-export dependencies for convenience
export type { ILibraryStorage } from '@aikb/bibliography';
export { ChunkingStrategy } from '@aikb/chunking';
export { Embedding } from '@aikb/embedding';
export { ChunkingManager } from '@aikb/chunking';
