import ChunkStorage from '@/kgrag/database/chunkStorage';
import { surrealDBClient } from '@/kgrag/database/surrrealdbClient';
import { embedding } from '@/kgrag/lib/embedding';

export default class CardStorage {
  tableName = 'markdown_files';
  async retrieve(query: string) {
    const db = await surrealDBClient.getDb();
    const chunkStorage = new ChunkStorage(
      db,
      this.tableName,
      embedding,
      0.2, // cosine_better_than_threshold
    );

    const result = await chunkStorage.query(query, 10);
    return result;
  }
}
