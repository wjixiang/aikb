import { Controller } from '@nestjs/common';
import { ChunkEmbedService } from './chunkEmbed.service';
import { RabbitRPC } from '@golevelup/nestjs-rabbitmq';
import { ChunkEmbedItemDto } from 'library-shared';

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
}
