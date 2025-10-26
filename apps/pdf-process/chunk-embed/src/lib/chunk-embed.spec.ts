import { chunkEmbed } from './chunk-embed';

describe('chunkEmbed', () => {
  it('should work', () => {
    expect(chunkEmbed()).toEqual('chunk-embed');
  });
});
