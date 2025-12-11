import { Controller } from '@nestjs/common';
import { ChunkEmbedService } from './chunk-embed.service';
import { RabbitRPC } from '@golevelup/nestjs-rabbitmq';
import { ChunkEmbedItemDto, CreateGroupAndChunkEmbedDto } from 'llm-shared/';
import { ChunkEmbedGroupConfig } from 'item-vector-storage';
import { ChunkingStrategy } from 'chunking';
import { EmbeddingProvider, OpenAIModel } from 'embedding';

@Controller()
export class ChunkEmbedController {
  constructor(private readonly chunkEmbedService: ChunkEmbedService) {}

  @RabbitRPC({
    exchange: 'library',
    routingKey: 'item.vector.chunkEmbed',
    queue: 'item-vector-chunkEmbed-queue',
  })
  async chunkEmbedItem(data: ChunkEmbedItemDto) {
    console.log('Controller received chunk embed request', data);
    return this.chunkEmbedService.handleChunkEmbedRequest(data);
  }

  @RabbitRPC({
    exchange: 'library',
    routingKey: 'item.vector.createGroupAndChunkEmbed',
    queue: 'item-vector-createGroupAndChunkEmbed-queue',
  })
  async createGroupAndChunkEmbedItemHandler(data: CreateGroupAndChunkEmbedDto) {
    console.log(
      'Controller received create group and chunk embed request',
      data,
    );
    return this.createGroupAndChunkEmbedItem(data);
  }

  /**
   * Creates a new chunk embed group and processes an item for chunk embedding
   * This is a convenience method that combines group creation and chunk embedding in one call
   */
  async createGroupAndChunkEmbedItem(data: CreateGroupAndChunkEmbedDto) {
    // Create a default configuration if not provided
    const config: ChunkEmbedGroupConfig = {
      itemId: data.itemId,
      name: data.groupName,
      description:
        data.groupDescription || `Chunk embed group for item ${data.itemId}`,
      chunkingConfig: {
        strategy: data.chunkingConfig?.strategy || ChunkingStrategy.PARAGRAPH,
        maxChunkSize: data.chunkingConfig?.maxChunkSize || 1000,
        minChunkSize: data.chunkingConfig?.minChunkSize || 100,
        overlap: data.chunkingConfig?.overlap || 0,
      },
      embeddingConfig: {
        provider: data.embeddingConfig?.provider || EmbeddingProvider.OPENAI,
        model:
          data.embeddingConfig?.model || OpenAIModel.TEXT_EMBEDDING_ADA_002,
        dimension: data.embeddingConfig?.dimension || 1536,
        batchSize: data.embeddingConfig?.batchSize || 10,
        maxRetries: data.embeddingConfig?.maxRetries || 3,
        timeout: data.embeddingConfig?.timeout || 30000,
      },
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      tags: [],
    };

    // Create the new chunk embed group
    const newChunkEmbedGroupMetadata =
      await this.chunkEmbedService.createChunkEmbedGroup(config);

    // Process the item for chunk embedding using the newly created group
    const result = await this.chunkEmbedService.handleChunkEmbedRequest({
      itemId: data.itemId,
      chunkEmbedGroupMetadata: newChunkEmbedGroupMetadata,
    });

    return {
      groupMetadata: newChunkEmbedGroupMetadata,
      chunkEmbedResult: result,
    };
  }
}
