// lib/mongodb.ts
import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

// Try MONGODB_URI first (used in production)
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    'Please add your MongoDB URI to environment variables (MONGODB_URI for production)',
  );
}

// Database name can be from env or use default
const dbName = process.env.DB_NAME || 'aikb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/**
 * 获取 MongoDB 客户端实例
 * @returns MongoDB 客户端实例
 */
export const clientPromise = (async () => {
  const { client } = await connectToDatabase();
  return client;
})();

export async function connectToDatabase(): Promise<{
  client: MongoClient;
  db: Db;
}> {
  // 如果已经有缓存的客户端和数据库实例，直接返回
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // 连接到 MongoDB

  const client = new MongoClient(uri as string);
  await client.connect();

  const db = client.db(dbName);

  // 缓存客户端和数据库实例以便重用
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
