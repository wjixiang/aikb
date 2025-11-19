import { IdUtils } from './utils.js';

describe('IdUtils', () => {
  it('should generate a unique ID', () => {
    const id1 = IdUtils.generateId();
    const id2 = IdUtils.generateId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should generate a UUID', () => {
    const uuid1 = IdUtils.generateUUID();
    const uuid2 = IdUtils.generateUUID();

    expect(uuid1).toBeDefined();
    expect(uuid2).toBeDefined();
    expect(uuid1).not.toBe(uuid2);
    expect(uuid1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should generate a unique chunk ID', () => {
    const itemId = 'test-item-123';
    const chunkIndex = 5;
    
    const chunkId1 = IdUtils.generateChunkId(itemId, chunkIndex);
    const chunkId2 = IdUtils.generateChunkId(itemId, chunkIndex);
    
    expect(chunkId1).toBeDefined();
    expect(chunkId2).toBeDefined();
    expect(chunkId1).not.toBe(chunkId2);
    expect(chunkId1).toMatch(/^chunk-test-item-123-5-[a-zA-Z0-9_-]{6}$/);
    expect(chunkId2).toMatch(/^chunk-test-item-123-5-[a-zA-Z0-9_-]{6}$/);
  });

  it('should generate different chunk IDs for different items', () => {
    const chunkId1 = IdUtils.generateChunkId('item-1', 0);
    const chunkId2 = IdUtils.generateChunkId('item-2', 0);
    
    expect(chunkId1).not.toBe(chunkId2);
    expect(chunkId1).toContain('item-1');
    expect(chunkId2).toContain('item-2');
  });

  it('should generate different chunk IDs for different indices', () => {
    const itemId = 'test-item';
    const chunkId1 = IdUtils.generateChunkId(itemId, 0);
    const chunkId2 = IdUtils.generateChunkId(itemId, 1);
    
    expect(chunkId1).not.toBe(chunkId2);
    expect(chunkId1).toContain('test-item-0');
    expect(chunkId2).toContain('test-item-1');
  });
});
