import { MongoClient, Db, Collection } from 'mongodb';
import { connectToDatabase } from '../db/mongodb';
import { Redis } from 'ioredis'; // Import Redis

export type cacheType = 'llmMessage' | 'query' | 'keywords';

export default class CacheManager {
  private db!: Db;
  private redisClient?: Redis; // Optional Redis client

  constructor(redisUri?: string) {
    this.initializeDatabase();
    if (redisUri) {
      this.initializeRedis(redisUri);
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      this.db = db;
      console.log('CacheManager connected to MongoDB');
    } catch (error) {
      console.error('Failed to connect to MongoDB for CacheManager:', error);
      throw error;
    }
  }

  private initializeRedis(redisUri: string): void {
    try {
      this.redisClient = new Redis(redisUri);
      this.redisClient.on('connect', () =>
        console.log('CacheManager connected to Redis'),
      );
      this.redisClient.on('error', (err) => {
        console.error('Redis error in CacheManager:', err);
        // Optionally, you could set this.redisClient to undefined here
        // to stop attempting Redis operations until a reconnect
      });
    } catch (error) {
      console.error(
        'Failed to initialize Redis client for CacheManager:',
        error,
      );
      // Continue without Redis
      this.redisClient = undefined;
    }
  }

  private getCollectionName(type: cacheType): string {
    return `cache_${type}`;
  }

  private getCollection(type: cacheType): Collection {
    if (!this.db) {
      throw new Error(
        'Database not initialized. Call initializeDatabase first.',
      );
    }
    return this.db.collection(this.getCollectionName(type));
  }

  private getRedisKey(type: cacheType, key: string): string {
    return `${type}:${key}`;
  }

  /**
   * Sets a value in the cache.
   * @param cacheType The type of cache.
   * @param key The key for the cache entry.
   * @param value The value to cache.
   */
  public async set(type: cacheType, key: string, value: any): Promise<void> {
    await this.initializeDatabase(); // Ensure DB is initialized

    const redisKey = this.getRedisKey(type, key);
    const stringifiedValue = JSON.stringify(value);

    // Attempt to set in Redis first
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        // Set with a TTL, e.g., 24 hours (86400 seconds)
        await this.redisClient.set(redisKey, stringifiedValue, 'EX', 86400);
      } catch (error) {
        console.error(
          `Failed to set data in Redis for key ${redisKey}:`,
          error,
        );
        // Continue to set in MongoDB even if Redis fails
      }
    }

    // Always set in MongoDB for persistence
    const collection = this.getCollection(type);
    const now = new Date();
    await collection.updateOne(
      { _id: key } as any,
      {
        $set: { value: value, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  /**
   * Gets a value from the cache.
   * @param cacheType The type of cache.
   * @param key The key for the cache entry.
   * @returns The cached value, or null if not found.
   */
  public async get(type: cacheType, key: string): Promise<any | null> {
    await this.initializeDatabase(); // Ensure DB is initialized

    const redisKey = this.getRedisKey(type, key);

    // Attempt to get from Redis first
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const cachedValue = await this.redisClient.get(redisKey);
        if (cachedValue !== null) {
          return JSON.parse(cachedValue);
        }
      } catch (error) {
        console.error(
          `Failed to get data from Redis for key ${redisKey}:`,
          error,
        );
        // Fallback to MongoDB if Redis fails
      }
    }

    // Fallback to MongoDB
    const collection = this.getCollection(type);
    const doc = await collection.findOne({ _id: key } as any);
    return doc ? doc.value : null;
  }

  /**
   * Deletes a value from the cache.
   * @param cacheType The type of cache.
   * @param key The key for the cache entry.
   */
  public async delete(type: cacheType, key: string): Promise<void> {
    await this.initializeDatabase(); // Ensure DB is initialized

    const redisKey = this.getRedisKey(type, key);

    // Attempt to delete from Redis
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.del(redisKey);
      } catch (error) {
        console.error(
          `Failed to delete data from Redis for key ${redisKey}:`,
          error,
        );
        // Continue to delete from MongoDB even if Redis fails
      }
    }

    // Delete from MongoDB
    const collection = this.getCollection(type);
    await collection.deleteOne({ _id: key } as any);
  }

  /**
   * Flushes all entries for a specific cache type.
   * @param cacheType The type of cache to flush.
   */
  public async flush(type: cacheType): Promise<void> {
    await this.initializeDatabase(); // Ensure DB is initialized

    // Attempt to flush Redis keys for this type
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        // Note: FLUSHALL or FLUSHDB is generally not recommended in production
        // A safer approach would be to find keys by pattern and delete them in batches.
        // For simplicity here, we'll just log a warning or skip Redis flush.
        // A more robust implementation would scan keys with the pattern and delete.
        console.warn(
          `Redis flush for type ${type} not fully implemented. Requires scanning keys.`,
        );
        // Example (requires 'scan' command and batch deletion):
        // let cursor = '0';
        // do {
        //     const [nextCursor, keys] = await this.redisClient.scan(cursor, 'MATCH', `${type}:*`, 'COUNT', 100);
        //     cursor = nextCursor;
        //     if (keys.length > 0) {
        //         await this.redisClient.del(keys);
        //     }
        // } while (cursor !== '0');
      } catch (error) {
        console.error(
          `Failed to flush data from Redis for type ${type}:`,
          error,
        );
        // Continue to flush MongoDB even if Redis fails
      }
    }

    // Flush MongoDB collection
    const collection = this.getCollection(type);
    await collection.deleteMany({});
  }
}
