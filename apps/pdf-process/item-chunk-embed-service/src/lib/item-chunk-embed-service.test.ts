import { itemChunkEmbedService } from './item-chunk-embed-service';

describe('itemChunkEmbedService', () => {
  it('should create new chunkEmbed group', () => {
    expect(itemChunkEmbedService()).toEqual('item-chunk-embed-service');
  });
});

describe('communicate with rabbitMQ');
