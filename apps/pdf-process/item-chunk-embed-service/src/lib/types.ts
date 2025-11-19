import { BaseRabbitMQMessage } from '@aikb/rabbitmq';
import { ChunkingConfig } from 'chunking';
import { EmbeddingConfig } from 'embedding';

export interface ChunkingEmbeddingGroupCreationConfig {
  groupName: string;
  chunkingConfig: ChunkingConfig;
  embeddingConfig: EmbeddingConfig;
}

export interface ChunkingEmbeddingRequestMessage extends BaseRabbitMQMessage {
  eventType: 'CREATE_CHUNK_EMBED_GROUP';
  itemId: string;
  config: ChunkingEmbeddingGroupCreationConfig;
}
